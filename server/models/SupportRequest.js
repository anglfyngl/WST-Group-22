
const mongoose = require("mongoose");

const supportRequestSchema = new mongoose.Schema({
    subject: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
        match: /^[^<>]+$/
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        maxlength: 254,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

    },
    category: {
        type: String,
        required: true,
        enum: [
            "Correction Request",
            "Modification Request",
            "Report an Issue",
            "Other"
        ]
    },
    message: {
        type: String,
        required: true,
        trim: true,
        minlength: 10,
        maxlength: 1000
    },
    submittedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("SupportRequest", supportRequestSchema);
