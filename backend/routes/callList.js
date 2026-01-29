const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const mongoose = require("mongoose");
const multer = require("multer");

const router = express.Router();

const authenticate = require("../middleware/auth");
const CallRecord = require("../models/CallRecord");
const Agent = require("../models/Agent");

const RECORDS_CSV_PATH = path.resolve(__dirname, "..", "..", "Records.csv");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve(__dirname, "..", "..", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [".csv"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only CSV files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

async function processUploadedCsv(filePath) {
  const records = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        try {
          const recordNo = Number(
            row["Record no"] || row["record no"] || row["Record"] || row["record"],
          );
          const name = row["Name"] || row["name"];
          const mobileRaw =
            row["Mobile no"] || row["mobile no"] || row["Mobile"] || row["mobile"];
          const email = (row["Email"] || row["email"] || "").toString().trim();

          if (!name || !mobileRaw || !email || Number.isNaN(recordNo)) {
            return;
          }

          const mobile = mobileRaw.toString().trim();

          records.push({
            recordNo,
            name: name.toString().trim(),
            mobile,
            email,
            status: "pending",
          });
        } catch {
          // skip malformed row
        }
      })
      .on("end", resolve)
      .on("error", reject);
  });

  fs.unlinkSync(filePath);

  if (records.length === 0) {
    const error = new Error("No valid records found in the uploaded CSV file");
    error.statusCode = 400;
    throw error;
  }

  await CallRecord.deleteMany({});
  await CallRecord.insertMany(records, { ordered: false });

  return records.length;
}

async function distributeCallRecords() {
  const agents = await Agent.find();
  if (agents.length === 0) {
    const error = new Error("No agents found. Please create agents first.");
    error.statusCode = 400;
    throw error;
  }

  const records = await CallRecord.find().sort({ recordNo: 1 });
  if (records.length === 0) {
    const error = new Error("No call records to distribute.");
    error.statusCode = 400;
    throw error;
  }

  const activeAgents = agents.slice(0, 5);
  const updates = [];
  let agentIndex = 0;

  records.forEach((record) => {
    const agent = activeAgents[agentIndex];
    updates.push({
      updateOne: {
        filter: { _id: record._id },
        update: { $set: { agentId: agent._id } },
      },
    });
    agentIndex = (agentIndex + 1) % activeAgents.length;
  });

  if (updates.length > 0) {
    await CallRecord.bulkWrite(updates);
  }

  return { totalRecords: records.length, totalAgents: activeAgents.length };
}

// Get all call records
router.get("/", authenticate, async (req, res) => {
  try {
    const records = await CallRecord.find()
      .sort({ recordNo: 1 })
      .populate("agentId", "name email mobile");

    res.json({
      callList: records.map((r) => ({
        id: r._id,
        recordNo: r.recordNo,
        name: r.name,
        mobile: r.mobile,
        email: r.email,
        status: r.status,
        agent: r.agentId
          ? {
              id: r.agentId._id,
              name: r.agentId.name,
              email: r.agentId.email,
              mobile: r.agentId.mobile,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Get call list error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/complete", authenticate, async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid call record ID" });
    }

    const record = await CallRecord.findById(id);

    if (!record) {
      return res.status(404).json({ message: "Call record not found" });
    }

    if (record.status === "completed") {
      return res.json({
        message: "Call already marked as completed",
        record: {
          id: record._id,
          status: record.status,
        },
      });
    }

    record.status = "completed";
    await record.save();

    return res.json({
      message: "Call marked as completed",
      record: {
        id: record._id,
        status: record.status,
      },
    });
  } catch (error) {
    console.error("Complete call record error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/upload", authenticate, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const totalRecords = await processUploadedCsv(req.file.path);
    const distribution = await distributeCallRecords();

    return res.json({
      message: "Call list uploaded and distributed successfully",
      totalRecords,
      distribution,
    });
  } catch (error) {
    console.error("Upload call list error:", error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message || "Server error" });
  }
});

// Alternate endpoint using the same handler, in case the frontend posts directly to /api/call-list
router.post("/", authenticate, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const totalRecords = await processUploadedCsv(req.file.path);
    const distribution = await distributeCallRecords();

    return res.json({
      message: "Call list uploaded and distributed successfully",
      totalRecords,
      distribution,
    });
  } catch (error) {
    console.error("Upload call list error (root):", error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message || "Server error" });
  }
});

// Delete all call records (clear call list)
router.delete("/", authenticate, async (req, res) => {
  try {
    await CallRecord.deleteMany({});
    return res.json({ message: "All call records have been removed" });
  } catch (error) {
    console.error("Delete all call records error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Distribute call records among agents (round robin)
router.post("/distribute", authenticate, async (req, res) => {
  try {
    const distribution = await distributeCallRecords();

    return res.json({
      message: "Call records distributed among agents successfully",
      ...distribution,
    });
  } catch (error) {
    console.error("Distribute call records error:", error);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message || "Server error" });
  }
});

module.exports = router;

