// Tests for the FurFind Customer Support API.
// Covers valid and invalid input, repeated submissions, server restarts and a damaged data file.
// Run: npm test

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Use a temporary data file so the tests never touch the real support-requests.json.
const dataFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "furfind-")), "support-requests.json");
process.env.SUPPORT_DATA_FILE = dataFile;
const { createApp } = require("../server");

let server;
let url;

function startServer() {
    return new Promise(function (resolve) {
        server = createApp().listen(0, function () {
            url = "http://127.0.0.1:" + server.address().port + "/api/support";
            resolve();
        });
    });
}

function stopServer() {
    return new Promise(function (resolve) {
        server.close(resolve);
    });
}

function send(body, options) {
    options = options || {};
    return fetch(url, {
        method: "POST",
        headers: options.headers || { "Content-Type": "application/json" },
        body: options.raw !== undefined ? options.raw : JSON.stringify(body)
    });
}

const goodRequest = {
    subject: "Wrong pet photo",
    email: "ailyn@test.com",
    category: "Correction Request",
    message: "The photo on my lost pet report is wrong, please update it."
};

function savedCount() {
    return fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, "utf8")).length : 0;
}

before(startServer);
after(stopServer);

test("valid request is saved (201)", async function () {
    const response = await send(goodRequest);
    assert.strictEqual(response.status, 201);
    const body = await response.json();
    assert.strictEqual(body.request.subject, "Wrong pet photo");
    assert.strictEqual(savedCount(), 1);
});

test("same request sent again is not saved twice", async function () {
    const response = await send(goodRequest);
    assert.strictEqual(response.status, 200);
    assert.strictEqual((await response.json()).duplicate, true);
    assert.strictEqual(savedCount(), 1);
});

test("missing subject, bad email, bad category and short message are rejected (400)", async function () {
    const response = await send({ subject: " ", email: "not-an-email", category: "Spam", message: "short" });
    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.errors.length, 4);
});

test("too long subject and message are rejected (400)", async function () {
    const response = await send(Object.assign({}, goodRequest, { subject: "s".repeat(101), message: "m".repeat(1001) }));
    assert.strictEqual(response.status, 400);
    assert.strictEqual((await response.json()).errors.length, 2);
});

test("fields that are not text are rejected (400), not a crash", async function () {
    const response = await send(Object.assign({}, goodRequest, { subject: { $ne: null } }));
    assert.strictEqual(response.status, 400);
});

test("< and > in the subject are rejected (400)", async function () {
    const response = await send(Object.assign({}, goodRequest, { subject: "<script>alert(1)</script>" }));
    assert.strictEqual(response.status, 400);
});

test("request without JSON is rejected (400), not a crash", async function () {
    const response = await send(null, { headers: { "Content-Type": "text/plain" }, raw: "hello" });
    assert.strictEqual(response.status, 400);
});

test("broken JSON gets a JSON error (400)", async function () {
    const response = await send(null, { raw: "{broken" });
    assert.strictEqual(response.status, 400);
    assert.ok((await response.json()).errors);
});

test("very large request gets a JSON error (413)", async function () {
    const response = await send(Object.assign({}, goodRequest, { message: "x".repeat(20000) }));
    assert.strictEqual(response.status, 413);
    assert.ok((await response.json()).errors);
});

test("unknown API route gets a JSON 404", async function () {
    const response = await fetch(url.replace("/support", "/nothing-here"));
    assert.strictEqual(response.status, 404);
    assert.ok((await response.json()).errors);
});

test("saved requests are still there after a server restart", async function () {
    await stopServer();
    await startServer();
    const response = await send(Object.assign({}, goodRequest, { subject: "Second request" }));
    assert.strictEqual(response.status, 201);
    assert.strictEqual(savedCount(), 2);
});

test("a damaged data file does not stop new requests", async function () {
    fs.writeFileSync(dataFile, "{damaged");
    const response = await send(Object.assign({}, goodRequest, { subject: "After damage" }));
    assert.strictEqual(response.status, 201);
    assert.strictEqual(savedCount(), 1);
    const backups = fs.readdirSync(path.dirname(dataFile)).filter(function (name) {
        return name.includes(".broken-");
    });
    assert.strictEqual(backups.length, 1);
});
