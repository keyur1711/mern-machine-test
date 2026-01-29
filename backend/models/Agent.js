const mongoose = require("mongoose");

const mobileRegex = /^\+91\d{10}$/;

const agentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      match: [mobileRegex, "Mobile must be in format +91 followed by 10 digits"],
    },
    password: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

agentSchema.index({ email: 1 }, { unique: true });
agentSchema.index({ mobile: 1 }, { unique: true });

module.exports = mongoose.model("Agent", agentSchema);
