const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const Agent = require("../models/Agent");
const authenticate = require("../middleware/auth");

router.get("/", authenticate, async (req, res) => {
  try {
    const agents = await Agent.find().select("-password");
    res.json(agents);
  } catch (error) {
    console.error("Get agents error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", authenticate, async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;

    if (!name || !email || !mobile || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingAgent = await Agent.findOne({ email: email.toLowerCase() });
    if (existingAgent) {
      return res
        .status(400)
        .json({ message: "Agent with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const agent = new Agent({
      name,
      email: email.toLowerCase(),
      mobile,
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
    console.error("Create agent error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
