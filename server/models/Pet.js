const mongoose = require("mongoose");

const petSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ["Cat", "Dog", "Bird", "Rabbit", "Other"]
    },
    breed: {
        type: String,
        required: true,
        trim: true
    },
    age: {
        type: Number,
        required: true,
        min: 0
    },
    ageUnit: {
        type: String,
        required: true,
        enum: ["Years", "Months"]
    },
    gender: {
        type: String,
        required: true,
        enum: ["Male", "Female"]
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    contact: {
        type: String,
        required: true,
        match: /^[0-9]+$/
    },
    missingSince: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Pet", petSchema);
