const express = require("express");
const path = require("path");
const fs = require("fs");

// Where support requests are saved (a different file can be used for tests).
const DATA_FILE = process.env.SUPPORT_DATA_FILE || path.join(__dirname, "support-requests.json");

const CATEGORIES = ["Correction Request", "Modification Request", "Report an Issue", "Other"];

// Field limits, also used by the maxlength attributes on support.html.
const LIMITS = {
    subject: 100,
    email: 254,
    messageMin: 10,
    messageMax: 1000
};

// The same request sent again within this time is treated as a repeated submission.
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;


/* ---------- Saving and reading requests ---------- */

function readRequests() {
    if (!fs.existsSync(DATA_FILE)) {
        return [];
    }

    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
        return Array.isArray(data) ? data : [];
    } catch (error) {
        // A damaged file should not stop new requests: keep a copy and start a new list.
        const backup = DATA_FILE + ".broken-" + Date.now();
        fs.renameSync(DATA_FILE, backup);
        console.error("support-requests.json could not be read. Saved a copy as " + path.basename(backup));
        return [];
    }
}

function saveRequests(requests) {
    // Write to a temporary file first, then replace the real file,
    // so a crash in the middle of saving cannot leave a half-written file.
    const tempFile = DATA_FILE + ".tmp";
    fs.writeFileSync(tempFile, JSON.stringify(requests, null, 2));
    fs.renameSync(tempFile, DATA_FILE);
}


/* ---------- Checking a support request ---------- */

function validateSupportRequest(body) {
    const errors = [];

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { errors: ["Please send the support request as JSON."] };
    }

    // Only plain text is accepted in each field (no objects or lists).
    for (const field of ["subject", "email", "category", "message"]) {
        if (body[field] !== undefined && typeof body[field] !== "string") {
            errors.push("The " + field + " must be text.");
        }
    }
    if (errors.length > 0) {
        return { errors: errors };
    }

    const request = {
        subject: (body.subject || "").trim(),
        email: (body.email || "").trim().toLowerCase(),
        category: (body.category || "").trim(),
        message: (body.message || "").trim()
    };

    if (!request.subject) {
        errors.push("Subject is required.");
    } else if (request.subject.length > LIMITS.subject) {
        errors.push("Subject must be " + LIMITS.subject + " characters or less.");
    }

    if (!EMAIL_PATTERN.test(request.email) || request.email.length > LIMITS.email) {
        errors.push("A valid email address is required.");
    }

    if (!CATEGORIES.includes(request.category)) {
        errors.push("Please choose a valid issue category.");
    }

    if (request.message.length < LIMITS.messageMin) {
        errors.push("Message must be at least " + LIMITS.messageMin + " characters.");
    } else if (request.message.length > LIMITS.messageMax) {
        errors.push("Message must be " + LIMITS.messageMax + " characters or less.");
    }

    if (/[<>]/.test(request.subject)) {
        errors.push("Subject cannot contain < or > characters.");
    }

    return errors.length > 0 ? { errors: errors } : { request: request };
}

function findRecentDuplicate(requests, request) {
    const now = Date.now();
    return requests.find(function (saved) {
        return saved.email === request.email &&
            saved.subject === request.subject &&
            saved.message === request.message &&
            now - new Date(saved.submittedAt).getTime() < DUPLICATE_WINDOW_MS;
    });
}


/* ---------- Server ---------- */

function createApp() {
    const app = express();

    app.use(express.json({ limit: "10kb" }));
    app.use(express.static(path.join(__dirname, "..")));

    app.post("/api/support", function (req, res) {
        const result = validateSupportRequest(req.body);

        if (result.errors) {
            return res.status(400).json({ errors: result.errors });
        }

        const requests = readRequests();

        // Repeated submission (e.g. double-click): do not save the same request twice.
        const duplicate = findRecentDuplicate(requests, result.request);
        if (duplicate) {
            return res.status(200).json({
                message: "We already received this request. Our team will get back to you soon.",
                duplicate: true,
                request: duplicate
            });
        }

        const supportRequest = {
            id: Date.now(),
            subject: result.request.subject,
            email: result.request.email,
            category: result.request.category,
            message: result.request.message,
            submittedAt: new Date().toISOString()
        };

        requests.push(supportRequest);
        saveRequests(requests);

        console.log("Saved support request #" + supportRequest.id);

        res.status(201).json({ message: "Support request received.", request: supportRequest });
    });

    // Unknown API routes answer with JSON instead of an HTML page.
    app.use("/api", function (req, res) {
        res.status(404).json({ errors: ["This API route does not exist."] });
    });

    // Errors (broken JSON, request too large, unexpected problems) are sent back as JSON.
    app.use(function (error, req, res, next) {
        if (error.type === "entity.parse.failed") {
            return res.status(400).json({ errors: ["The request could not be read. Please try again."] });
        }
        if (error.type === "entity.too.large") {
            return res.status(413).json({ errors: ["Your message is too long."] });
        }
        console.error(error);
        res.status(500).json({ errors: ["Something went wrong on our side. Please try again later."] });
    });

    return app;
}

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    createApp().listen(PORT, function () {
        console.log("FurFind server running at http://localhost:" + PORT);
    });
}

module.exports = { createApp, validateSupportRequest, LIMITS };
