const express = require("express");
const path = require("path");

const fs = require("fs");

const DATA_FILE = path.join(__dirname, "support-requests.json");

const CATEGORIES = ["Correction Request", "Modification Request", "Report an Issue", "Other"];

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));

app.post("/api/support", function (req, res) {
    const subject  = (req.body.subject  || "").trim();
    const email    = (req.body.email    || "").trim();
    const category = (req.body.category || "").trim();
    const message  = (req.body.message  || "").trim();

    const errors = [];
    if (!subject) errors.push("Subject is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("A valid email address is required.");
    if (!CATEGORIES.includes(category)) errors.push("Please choose a valid issue category.");
    if (message.length < 10) errors.push("Message must be at least 10 characters.");

    if (errors.length > 0) {
        return res.status(400).json({ errors: errors });
    }

    const supportRequest = {
        id: Date.now(),
        subject: subject,
        email: email,
        category: category,
        message: message,
        submittedAt: new Date().toISOString()
    };

    let requests = [];
    if (fs.existsSync(DATA_FILE)) {
        requests = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    }

    requests.push(supportRequest);
    fs.writeFileSync(DATA_FILE, JSON.stringify(requests, null, 2));

    console.log("Saved support request #" + supportRequest.id);

    res.status(201).json({ message: "Support request received.", request: supportRequest });
});

app.listen(PORT, function () {
    console.log("FurFind server running at http://localhost:" + PORT);
});