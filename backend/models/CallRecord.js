const mongoose = require("mongoose");

const callRecordSchema = new mongoose.Schema(
  {
    recordNo: {
      type: Number,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
    },
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

callRecordSchema.index({ recordNo: 1 }, { unique: true });

module.exports = mongoose.model("CallRecord", callRecordSchema);

