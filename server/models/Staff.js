
const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: "staff"
  }
}, { timestamps: true });

module.exports = mongoose.model("Staff", staffSchema);
