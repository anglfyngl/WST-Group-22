const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));

app.post("/api/support", function (req, res) {
    const supportRequest = req.body;

    console.log("New support request:", supportRequest);

    res.status(201).json({ message: "Support request received." });
});

app.listen(PORT, function () {
    console.log("FurFind server running at http://localhost:" + PORT);
});