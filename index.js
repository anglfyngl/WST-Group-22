// Load environment variables from the .env file.
require("dotenv").config();

// Import the libraries needed to run the backend server.
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Import the pet and support request models and validation functions.
const Pet = require("./server/models/Pet");
const SupportRequest = require("./server/models/SupportRequest");
const Staff = require("./server/models/Staff");
const bcrypt = require("bcryptjs");
const {
    validateSupportRequest,
    DUPLICATE_WINDOW_MS
} = require("./server/support-validation");

// Set the port number used by the backend server.
const PORT = 3000;

// Get today's date in YYYY-MM-DD format using the local date.
function getTodayLocalDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// Check whether the given date is valid and earlier than today.
function isValidPastDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);
    const calendarDate = new Date(0);
    calendarDate.setUTCFullYear(year, month - 1, day);
    calendarDate.setUTCHours(0, 0, 0, 0);

    return calendarDate.toISOString().slice(0, 10) === value &&
        value < getTodayLocalDate();
}

// Format a support request into a clean object to send back to the client.
function formatSupportRequest(request) {
    return {
        id: request._id.toString(),
        subject: request.subject,
        email: request.email,
        category: request.category,
        message: request.message,
        submittedAt: request.submittedAt.toISOString()
    };
}

// Create the Express app and set up the models used by the API.
function createApp(models = {}) {
    const PetModel = models.Pet || Pet;
    const SupportRequestModel = models.SupportRequest || SupportRequest;
    const app = express();
    app.use(express.static(__dirname));

// Allow the frontend to send requests to the backend.
    app.use(cors());


  // Staff Login API - verify credentials against MongoDB.
  app.post("/api/staff/login", express.json({ limit: "10kb" }), async (req, res) => {
    try {
      const { email, password } = req.body || {};

      if (typeof email !== "string" || typeof password !== "string" ||
          !email.trim() || !password) {
        return res.status(400).json({
          message: "Email and password are required."
        });
      }

      const staff = await Staff.findOne({
        email: email.trim().toLowerCase()
      });

      if (!staff) {
        return res.status(401).json({
          message: "Invalid email or password."
        });
      }

      const passwordMatches = await bcrypt.compare(
        password,
        staff.passwordHash
      );

      if (!passwordMatches) {
        return res.status(401).json({
          message: "Invalid email or password."
        });
      }

      return res.status(200).json({
        message: "Credentials verified.",
        staff: {
          id: staff._id,
          email: staff.email,
          role: staff.role
        }
      });

    } catch (error) {
      console.error("Staff login error:", error);
      return res.status(500).json({
        message: "Unable to process login."
      });
    }
  });

// Handle support request submissions and limit the request body size to 10kb.
    app.post("/api/support", express.json({ limit: "10kb" }), async (req, res) => {

// Validate the submitted support request and return errors if the data is invalid.
        const result = validateSupportRequest(req.body);

        if (result.errors) {
            return res.status(400).json({ errors: result.errors });
        }

// Check whether the same support request was submitted within the last 10 minutes.
        try {
            const duplicate = await SupportRequestModel.findOne({
                email: result.request.email,
                subject: result.request.subject,
                message: result.request.message,
                submittedAt: {
                    $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS)
                }
            });

// Return a message if the support request has already been submitted.
            if (duplicate) {
                return res.status(200).json({
                    message: "We already received this request. Our team will get back to you soon.",
                    duplicate: true,
                    request: formatSupportRequest(duplicate)
                });
            }

// Save the valid support request to the database.
            const supportRequest = new SupportRequestModel(result.request);
            await supportRequest.save();

            console.log("Saved support request #" + supportRequest._id);

            return res.status(201).json({
                message: "Support request received.",
                request: formatSupportRequest(supportRequest)
            });
        } catch (error) {
            console.error("Error saving support request:", error);

            return res.status(500).json({
                errors: ["Something went wrong on our side. Please try again later."]
            });
        }
    });

    // Allow pet reports to include compressed photos.
    app.use(express.json({ limit: "10mb" }));

    app.get("/api/test", (req, res) => {
        res.send("FurFind backend is working!");
    });

    app.get("/api/pets", async (req, res) => {
        try {
            const pets = await PetModel.find().sort({ createdAt: -1 });

            res.json(pets);
        } catch (error) {
            console.error("Error retrieving pet reports:", error);

            res.status(500).json({
                message: "Unable to retrieve pet reports."
            });
        }
    });

    app.post("/api/pets", async (req, res) => {
        try {
            const pet = new PetModel(req.body);
            await pet.validate();

            if (!isValidPastDate(pet.missingSince)) {
                return res.status(400).json({
                    message: "Missing Since must be a valid date before today."
                });
            }

            const duplicate = await PetModel.findOne({
                name: pet.name,
                type: pet.type,
                breed: pet.breed,
                age: pet.age,
                ageUnit: pet.ageUnit,
                gender: pet.gender,
                location: pet.location,
                contact: pet.contact,
                missingSince: pet.missingSince,
                createdAt: {
                    $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS)
                }
            });

            if (duplicate) {
                return res.status(200).json({
                    message: "This lost pet report may already have been submitted within the last 10 minutes.",
                    duplicate: true
                });
            }

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

    app.use("/api", (req, res) => {
        res.status(404).json({ errors: ["This API route does not exist."] });
    });

    app.use((error, req, res, next) => {
        const isSupportRequest = req.path === "/api/support";
        const isPetRequest = req.path === "/api/pets";

        if (!isSupportRequest && !isPetRequest) {
            return next(error);
        }

        if (error.type === "entity.parse.failed") {
            if (isPetRequest) {
                return res.status(400).json({
                    message: "The pet report request could not be read. Please check the submitted data."
                });
            }

            return res.status(400).json({
                errors: ["The request could not be read. Please try again."]
            });
        }

        if (error.type === "entity.too.large") {
            if (isPetRequest) {
                return res.status(413).json({
                    message: "The pet report or photo is too large. Please choose a smaller photo and try again."
                });
            }

            return res.status(413).json({ errors: ["Your message is too long."] });
        }

        console.error(error);

        if (isPetRequest) {
            return res.status(500).json({
                message: "Unable to process the pet report. Please try again."
            });
        }

        res.status(500).json({
            errors: ["Something went wrong on our side. Please try again later."]
        });
    });

    return app;
}

const app = createApp();

if (require.main === module) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => {
            console.log("Connected to MongoDB successfully!");

            app.listen(PORT, () => {
                console.log(`FurFind backend is running on port ${PORT}`);
            });
        })
        .catch((error) => {
            console.error("Could not connect to MongoDB.");
            console.error(error.message);
        });
}

module.exports = { app, createApp };