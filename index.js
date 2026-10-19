require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Pet = require("./models/Pet");

const app = express();
const PORT = 3000;

app.use(cors());

// Allow the backend to receive JSON, including compressed pet photos
app.use(express.json({ limit: "10mb" }));

// Test route
app.get("/api/test", (req, res) => {
    res.send("FurFind backend is working!");
});

// Get all saved lost pet reports
app.get("/api/pets", async (req, res) => {
    try {
        const pets = await Pet.find().sort({ createdAt: -1 });

        res.json(pets);
    } catch (error) {
        console.error("Error retrieving pet reports:", error);

        res.status(500).json({
            message: "Unable to retrieve pet reports."
        });
    }
});

// Save a new lost pet report
app.post("/api/pets", async (req, res) => {
    try {
        const pet = new Pet(req.body);

        await pet.save();

        res.status(201).json({
            message: "Lost pet report saved successfully!",
            petId: pet._id
        });
    } catch (error) {
        if (
            error.name === "ValidationError" ||
            error.name === "CastError"
        ) {
            return res.status(400).json({
                message: "Please check the pet report information.",
                error: error.message
            });
        }

        console.error("Error saving pet report:", error);

        res.status(500).json({
            message: "Unable to save the pet report. Please try again."
        });
    }
});

// Connect to MongoDB before starting the server
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("Connected to MongoDB successfully!");

        app.listen(PORT, () => {
            console.log(
                `FurFind backend is running on port ${PORT}`
            );
        });
    })
    .catch((error) => {
        console.error("Could not connect to MongoDB.");
        console.error(error.message);
    });