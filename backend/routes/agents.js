const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Agent = require("../models/Agent");
const ListItem = require("../models/List");
const authenticate = require("../middleware/auth");

const mobileRegex = /^\+91\d{10}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

const updateAgentHandler = async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;
    const agentId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return res.status(400).json({ message: "Invalid agent ID" });
    }

    if (!name || !email || !mobile) {
      return res.status(400).json({ message: "Name, email, and mobile are required" });
    }

    const normalizedMobile = String(mobile).trim();
    if (!mobileRegex.test(normalizedMobile)) {
      return res.status(400).json({ message: "Mobile must be in format +91 followed by 10 digits" });
    }

    if (password && String(password).trim() !== "" && !passwordRegex.test(String(password))) {
      return res.status(400).json({
        message: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
      });
    }

    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingEmail = await Agent.findOne({
      email: normalizedEmail,
      _id: { $ne: agentId },
    });
    if (existingEmail) {
      return res.status(400).json({ message: "Agent with this email already exists" });
    }

    const existingMobile = await Agent.findOne({
      mobile: normalizedMobile,
      _id: { $ne: agentId },
    });
    if (existingMobile) {
      return res.status(400).json({ message: "Agent with this mobile number already exists" });
    }

    agent.name = String(name).trim();
    agent.email = normalizedEmail;
    agent.mobile = normalizedMobile;

    if (password && String(password).trim() !== "") {
      agent.password = await bcrypt.hash(String(password), 10);
    }

    await agent.save();

    const agentResponse = agent.toObject();
    delete agentResponse.password;

    res.json({ message: "Agent updated successfully", agent: agentResponse });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const fieldName = field === "email" ? "email" : field === "mobile" ? "mobile number" : field;
      return res.status(400).json({ message: `Agent with this ${fieldName} already exists` });
    }
    res.status(500).json({ message: error.message || "Server error" });
  }
};

router.get("/", authenticate, async (req, res) => {
  try {
    const agents = await Agent.find().select("-password");
    res.json(agents);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", authenticate, async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;

    if (!name || !email || !mobile || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const normalizedMobile = String(mobile).trim();
    if (!mobileRegex.test(normalizedMobile)) {
      return res.status(400).json({ message: "Mobile must be in format +91 followed by 10 digits" });
    }

    if (!passwordRegex.test(String(password))) {
      return res.status(400).json({
        message: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
      });
    }

    const existingEmail = await Agent.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ message: "Agent with this email already exists" });
    }

    const existingMobile = await Agent.findOne({ mobile: normalizedMobile });
    if (existingMobile) {
      return res.status(400).json({ message: "Agent with this mobile number already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const agent = new Agent({
      name,
      email: email.toLowerCase(),
      mobile: normalizedMobile,
      password: hashedPassword,
    });

    await agent.save();

    const agentResponse = agent.toObject();
    delete agentResponse.password;

    res.status(201).json({
      message: "Agent created successfully",
      agent: agentResponse,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `Agent with this ${field} already exists` 
      });
    }
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id", authenticate, updateAgentHandler);
router.patch("/:id", authenticate, updateAgentHandler);
router.post("/:id", authenticate, updateAgentHandler);

router.delete("/:id", authenticate, async (req, res) => {
  try {
    const agentId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return res.status(400).json({ message: "Invalid agent ID" });
    }

    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    await ListItem.deleteMany({ agentId });
    await Agent.findByIdAndDelete(agentId);

    res.json({ message: "Agent deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
