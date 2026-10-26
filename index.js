// Load environment variables from the .env file.
require("dotenv").config();

// Import the libraries needed to run the backend server.
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");

// Import the pet and support request models and validation functions.
const Pet = require("./server/models/Pet");
const SupportRequest = require("./server/models/SupportRequest");
const Staff = require("./server/models/Staff");
const { APPROVED_STAFF_EMAILS } = require("./server/staff-accounts");
const { isDateOnOrBeforeToday } = require("./server/date-validation");
const {
    validateSupportRequest,
    DUPLICATE_WINDOW_MS
} = require("./server/support-validation");

// Set the port number used by the backend server.
const PORT = 3000;
const SESSION_COOKIE_NAME = "furfind.staff.sid";
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const SESSION_SECRET = process.env.STAFF_SESSION_SECRET ||
    (process.env.NODE_ENV === "production"
        ? null
        : crypto.randomBytes(32).toString("hex"));
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGIN ||
    "http://localhost:8080,http://127.0.0.1:8080")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const PET_UPDATE_FIELDS = [
    "name",
    "type",
    "breed",
    "age",
    "ageUnit",
    "gender",
    "location",
    "contact",
    "missingSince"
];
const SUPPORT_STATUSES = ["open", "in_progress", "resolved"];
const STAFF_RESPONSE_MAX_LENGTH = 2000;

function createMongoSessionStore() {
    return MongoStore.create({
        clientPromise: mongoose.connection.asPromise()
            .then((connection) => connection.getClient()),
        collectionName: "staff_sessions",
        ttl: SESSION_MAX_AGE_MS / 1000
    });
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
    const StaffModel = models.Staff || Staff;
    const app = express();
    const sessionStore = models.sessionStore || (
        process.env.NODE_ENV === "production"
            ? createMongoSessionStore()
            : new session.MemoryStore()
    );

    if (!SESSION_SECRET) {
        throw new Error("STAFF_SESSION_SECRET must be set in production.");
    }

    if (process.env.NODE_ENV === "production") {
        app.set("trust proxy", 1);
    }

    app.use(cors({
        origin(origin, callback) {
            callback(null, !origin || FRONTEND_ORIGINS.includes(origin));
        },
        credentials: true
    }));
    app.use(session({
        name: SESSION_COOKIE_NAME,
        secret: SESSION_SECRET,
        store: sessionStore,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: SESSION_MAX_AGE_MS,
            path: "/api/staff"
        }
    }));

    function requireAllowedOrigin(req, res, next) {
        if (!FRONTEND_ORIGINS.includes(req.get("origin"))) {
            return res.status(403).json({
                message: "Request origin is not allowed."
            });
        }

        next();
    }

    function requireStaff(req, res, next) {
        if (!req.session || !req.session.staff) {
            return res.status(401).json({
                message: "Authentication required."
            });
        }

        next();
    }

    app.post("/api/staff/login", requireAllowedOrigin, express.json({ limit: "10kb" }), async (req, res) => {
        try {
            const { email, password } = req.body || {};

            if (
                typeof email !== "string" ||
                typeof password !== "string" ||
                !email.trim() ||
                !password
            ) {
                return res.status(401).json({
                    message: "Invalid email or password."
                });
            }

            const normalizedEmail = email.trim().toLowerCase();
            if (!APPROVED_STAFF_EMAILS.includes(normalizedEmail)) {
                return res.status(401).json({
                    message: "Invalid email or password."
                });
            }

            const staff = await StaffModel.findOne({
                email: normalizedEmail
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

            req.session.regenerate((regenerateError) => {
                if (regenerateError) {
                    console.error("Staff session creation error:", regenerateError);
                    return res.status(500).json({
                        message: "Unable to process login."
                    });
                }

                req.session.staff = {
                    id: staff._id,
                    email: staff.email,
                    role: staff.role
                };

                req.session.save((saveError) => {
                    if (saveError) {
                        console.error("Staff session save error:", saveError);
                        return res.status(500).json({
                            message: "Unable to process login."
                        });
                    }

                    return res.status(200).json({
                        message: "Credentials verified.",
                        staff: req.session.staff
                    });
                });
            });
        } catch (error) {
            console.error("Staff login error:", error);
            return res.status(500).json({
                message: "Unable to process login."
            });
        }
    });

    app.get("/api/staff/session", requireStaff, (req, res) => {
        res.json({ staff: req.session.staff });
    });

    app.post("/api/staff/logout", requireAllowedOrigin, (req, res) => {
        if (!req.session) {
            res.clearCookie(SESSION_COOKIE_NAME, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                path: "/api/staff"
            });
            return res.status(204).end();
        }

        req.session.destroy((error) => {
            if (error) {
                console.error("Staff logout error:", error);
                return res.status(500).json({
                    message: "Unable to log out."
                });
            }

            res.clearCookie(SESSION_COOKIE_NAME, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                path: "/api/staff"
            });
            return res.status(204).end();
        });
    });

    app.get("/api/staff/pets", requireStaff, async (req, res) => {
        try {
            const pets = await PetModel.find().sort({ createdAt: -1 });
            return res.json({ pets });
        } catch (error) {
            console.error("Error retrieving staff pet reports:", error);
            return res.status(500).json({
                message: "Unable to retrieve pet reports."
            });
        }
    });

    app.patch(
        "/api/staff/pets/:id",
        requireAllowedOrigin,
        requireStaff,
        express.json({ limit: "10kb" }),
        async (req, res) => {
            try {
                const updates = req.body;

                if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
                    return res.status(400).json({
                        message: "Provide valid pet report fields to update."
                    });
                }

                const updateKeys = Object.keys(updates);
                if (
                    updateKeys.length === 0 ||
                    updateKeys.some((key) => !PET_UPDATE_FIELDS.includes(key))
                ) {
                    return res.status(400).json({
                        message: "Provide valid pet report fields to update."
                    });
                }

                const pet = await PetModel.findById(req.params.id);
                if (!pet) {
                    return res.status(404).json({
                        message: "Pet report not found."
                    });
                }

                for (const key of updateKeys) {
                    pet[key] = updates[key];
                }

                if (
                    Object.prototype.hasOwnProperty.call(updates, "missingSince") &&
                    !isDateOnOrBeforeToday(
                        pet.missingSince,
                        req.get("X-Client-Timezone")
                    )
                ) {
                    return res.status(400).json({
                        message: "Missing Since must be a valid date no later than today."
                    });
                }

                await pet.validate();
                await pet.save();
                return res.json({
                    message: "Pet report updated.",
                    pet
                });
            } catch (error) {
                if (
                    error.name === "ValidationError" ||
                    error.name === "CastError"
                ) {
                    return res.status(400).json({
                        message: "Please check the pet report information."
                    });
                }

                console.error("Error updating pet report:", error);
                return res.status(500).json({
                    message: "Unable to update the pet report."
                });
            }
        }
    );

    app.delete(
        "/api/staff/pets/:id",
        requireAllowedOrigin,
        requireStaff,
        async (req, res) => {
            try {
                const pet = await PetModel.findByIdAndDelete(req.params.id);
                if (!pet) {
                    return res.status(404).json({
                        message: "Pet report not found."
                    });
                }

                return res.json({ message: "Pet report deleted." });
            } catch (error) {
                if (error.name === "CastError") {
                    return res.status(404).json({
                        message: "Pet report not found."
                    });
                }

                console.error("Error deleting pet report:", error);
                return res.status(500).json({
                    message: "Unable to delete the pet report."
                });
            }
        }
    );

    app.get("/api/staff/support-requests", requireStaff, async (req, res) => {
        try {
            const requests = await SupportRequestModel.find({
                status: { $ne: "resolved" }
            }).sort({ submittedAt: -1 });
            return res.json({ requests });
        } catch (error) {
            console.error("Error retrieving staff support requests:", error);
            return res.status(500).json({
                message: "Unable to retrieve support requests."
            });
        }
    });

    app.patch(
        "/api/staff/support-requests/:id",
        requireAllowedOrigin,
        requireStaff,
        express.json({ limit: "10kb" }),
        async (req, res) => {
            try {
                const updates = req.body;
                const allowedFields = ["status", "staffResponse"];

                if (
                    !updates ||
                    typeof updates !== "object" ||
                    Array.isArray(updates) ||
                    Object.keys(updates).length === 0 ||
                    Object.keys(updates).some((key) => !allowedFields.includes(key))
                ) {
                    return res.status(400).json({
                        message: "Provide a valid support status or response."
                    });
                }

                if (
                    Object.prototype.hasOwnProperty.call(updates, "status") &&
                    !SUPPORT_STATUSES.includes(updates.status)
                ) {
                    return res.status(400).json({
                        message: "Support status must be open, in_progress, or resolved."
                    });
                }

                if (
                    Object.prototype.hasOwnProperty.call(updates, "staffResponse") &&
                    (
                        typeof updates.staffResponse !== "string" ||
                        updates.staffResponse.length > STAFF_RESPONSE_MAX_LENGTH
                    )
                ) {
                    return res.status(400).json({
                        message: `Staff response must be ${STAFF_RESPONSE_MAX_LENGTH} characters or fewer.`
                    });
                }

                const request = await SupportRequestModel.findById(req.params.id);
                if (!request) {
                    return res.status(404).json({
                        message: "Support request not found."
                    });
                }

                if (Object.prototype.hasOwnProperty.call(updates, "status")) {
                    request.status = updates.status;
                }
                if (Object.prototype.hasOwnProperty.call(updates, "staffResponse")) {
                    request.staffResponse = updates.staffResponse.trim();
                }

                await request.validate();
                await request.save();
                return res.json({
                    message: "Support request updated. The response has not been emailed.",
                    request
                });
            } catch (error) {
                if (
                    error.name === "ValidationError" ||
                    error.name === "CastError"
                ) {
                    return res.status(400).json({
                        message: "Please check the support request update."
                    });
                }

                console.error("Error updating support request:", error);
                return res.status(500).json({
                    message: "Unable to update the support request."
                });
            }
        }
    );

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

            if (!isDateOnOrBeforeToday(
                pet.missingSince,
                req.get("X-Client-Timezone")
            )) {
                return res.status(400).json({
                    message: "Missing Since must be a valid date no later than today."
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
        const isStaffLogin = req.path === "/api/staff/login";
        const isStaffApi = req.path.startsWith("/api/staff/");

        if (!isSupportRequest && !isPetRequest && !isStaffApi) {
            return next(error);
        }

        if (error.type === "entity.parse.failed") {
            if (isPetRequest) {
                return res.status(400).json({
                    message: "The pet report request could not be read. Please check the submitted data."
                });
            }

            if (isStaffApi) {
                return res.status(400).json({
                    message: isStaffLogin
                        ? "Invalid email or password."
                        : "Invalid staff request."
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

            if (isStaffApi) {
                return res.status(413).json({
                    message: isStaffLogin
                        ? "Invalid email or password."
                        : "Staff request is too large."
                });
            }

            return res.status(413).json({ errors: ["Your message is too long."] });
        }

        console.error(error);

        if (isStaffApi) {
            return res.status(500).json({
                message: isStaffLogin
                    ? "Unable to process login."
                    : "Unable to process staff request."
            });
        }

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

let app = require.main === module ? null : createApp();

if (require.main === module) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => {
            console.log("Connected to MongoDB successfully!");

            const sessionStore = createMongoSessionStore();
            app = createApp({ sessionStore });
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