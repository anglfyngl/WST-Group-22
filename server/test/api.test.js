// Tests for the FurFind backend API, including support requests and lost pet reports.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { createApp } = require("../../index");

class MemorySupportRequest {
    static requests = [];
    static nextId = 1;

    constructor(fields) {
        Object.assign(this, fields);
        this._id = String(MemorySupportRequest.nextId++);
        this.submittedAt = new Date();
    }

    static async findOne(query) {
        return this.requests.find((request) =>
            request.email === query.email &&
            request.subject === query.subject &&
            request.message === query.message &&
            request.submittedAt >= query.submittedAt.$gte
        ) || null;
    }

    async save() {
        MemorySupportRequest.requests.push(this);
        return this;
    }
}

class MemoryPet {
    static records = [];
    static nextId = 1;

    constructor(fields) {
        Object.assign(this, fields);
        this._id = "pet-" + MemoryPet.nextId++;
        this.createdAt = new Date();
    }

    async validate() {
        return this;
    }

    static async findOne(query) {
        const fields = [
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

        return this.records.find((record) =>
            fields.every((field) => record[field] === query[field]) &&
            record.createdAt >= query.createdAt.$gte
        ) || null;
    }

    static find() {
        return {
            sort: async (order) => {
                assert.deepStrictEqual(order, { createdAt: -1 });
                return this.records;
            }
        };
    }

    async save() {
        MemoryPet.records.push(this);
        return this;
    }
}

const app = createApp({
    Pet: MemoryPet,
    SupportRequest: MemorySupportRequest
});
let server;
let url;

function startServer() {
    return new Promise((resolve) => {
        server = app.listen(0, () => {
            url = "http://127.0.0.1:" + server.address().port;
            resolve();
        });
    });
}

function stopServer() {
    return new Promise((resolve) => server.close(resolve));
}

function send(body, options = {}) {
    return fetch(url + "/api/support", {
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

const goodPetReport = {
    name: "Milo",
    type: "Cat",
    breed: "Tabby",
    age: 3,
    ageUnit: "Years",
    gender: "Male",
    location: "Quezon City",
    contact: "09123456789",
    missingSince: getDateOffset(-1),
    image: "data:image/jpeg;base64,example"
};

function getDateOffset(offset) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

before(startServer);
after(stopServer);

test("valid request is saved through the support model (201)", async () => {
    const response = await send(goodRequest);
    assert.strictEqual(response.status, 201);
    const body = await response.json();
    assert.strictEqual(body.request.subject, "Wrong pet photo");
    assert.strictEqual(MemorySupportRequest.requests.length, 1);
});

test("same email, subject and message within ten minutes is not saved twice", async () => {
    const response = await send(Object.assign({}, goodRequest, {
        email: "  AILYN@Test.com  "
    }));
    assert.strictEqual(response.status, 200);
    assert.strictEqual((await response.json()).duplicate, true);
    assert.strictEqual(MemorySupportRequest.requests.length, 1);
});

test("missing subject, bad email, bad category and short message are rejected (400)", async () => {
    const response = await send({
        subject: " ",
        email: "not-an-email",
        category: "Spam",
        message: "short"
    });
    assert.strictEqual(response.status, 400);
    assert.strictEqual((await response.json()).errors.length, 4);
});

test("too long subject and message are rejected (400)", async () => {
    const response = await send(Object.assign({}, goodRequest, {
        subject: "s".repeat(101),
        message: "m".repeat(1001)
    }));
    assert.strictEqual(response.status, 400);
    assert.strictEqual((await response.json()).errors.length, 2);
});

test("fields that are not text are rejected (400), not a crash", async () => {
    const response = await send(Object.assign({}, goodRequest, {
        subject: { $ne: null }
    }));
    assert.strictEqual(response.status, 400);
});

test("< and > in the subject are rejected (400)", async () => {
    const response = await send(Object.assign({}, goodRequest, {
        subject: "<script>alert(1)</script>"
    }));
    assert.strictEqual(response.status, 400);
});

test("request without JSON is rejected (400), not a crash", async () => {
    const response = await send(null, {
        headers: { "Content-Type": "text/plain" },
        raw: "hello"
    });
    assert.strictEqual(response.status, 400);
});

test("broken JSON gets a JSON error (400)", async () => {
    const response = await send(null, { raw: "{broken" });
    assert.strictEqual(response.status, 400);
    assert.ok((await response.json()).errors);
});

test("very large support request gets a JSON error (413)", async () => {
    const response = await send(Object.assign({}, goodRequest, {
        message: "x".repeat(20000)
    }));
    assert.strictEqual(response.status, 413);
    assert.ok((await response.json()).errors);
});

test("unknown API route gets a JSON 404", async () => {
    const response = await fetch(url + "/api/nothing-here");
    assert.strictEqual(response.status, 404);
    assert.ok((await response.json()).errors);
});

test("the route continues to use the same stored requests after a server restart", async () => {
    await stopServer();
    await startServer();
    const response = await send(Object.assign({}, goodRequest, {
        subject: "Second request"
    }));
    assert.strictEqual(response.status, 201);
    assert.strictEqual(MemorySupportRequest.requests.length, 2);
});

test("existing pet report routes remain available", async () => {
    MemoryPet.records.length = 0;
    const saved = await sendPetReport(goodPetReport);
    assert.strictEqual(saved.status, 201);
    assert.deepStrictEqual(await saved.json(), {
        message: "Lost pet report saved successfully!",
        petId: "pet-1"
    });

    const reports = await fetch(url + "/api/pets");
    assert.strictEqual(reports.status, 200);
    assert.strictEqual((await reports.json())[0].name, "Milo");
});

test("malformed pet report JSON gets a clear JSON error (400)", async () => {
    const response = await fetch(url + "/api/pets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{broken"
    });

    assert.strictEqual(response.status, 400);
    assert.match((await response.json()).message, /pet report request could not be read/i);
});

test("pet report with a valid past missing date is accepted", async () => {
    MemoryPet.records.length = 0;
    const response = await sendPetReport(Object.assign({}, goodPetReport, {
        missingSince: getDateOffset(-1)
    }));

    assert.strictEqual(response.status, 201);
    assert.strictEqual(MemoryPet.records.length, 1);
});

test("pet report with today's missing date is rejected", async () => {
    const response = await sendPetReport(Object.assign({}, goodPetReport, {
        missingSince: getDateOffset(0)
    }));

    assert.strictEqual(response.status, 400);
    assert.match((await response.json()).message, /before today/);
});

test("pet report with a future missing date is rejected", async () => {
    const response = await sendPetReport(Object.assign({}, goodPetReport, {
        missingSince: getDateOffset(1)
    }));

    assert.strictEqual(response.status, 400);
});

test("pet report with a missing date is rejected", async () => {
    const report = Object.assign({}, goodPetReport);
    delete report.missingSince;
    const response = await sendPetReport(report);

    assert.strictEqual(response.status, 400);
});

test("pet report with an invalid or impossible missing date is rejected", async (context) => {
    for (const missingSince of ["not-a-date", "2026-02-30"]) {
        await context.test(missingSince, async () => {
            const response = await sendPetReport(Object.assign({}, goodPetReport, {
                missingSince
            }));
            assert.strictEqual(response.status, 400);
        });
    }
});

test("matching pet report within ten minutes is not saved twice", async () => {
    MemoryPet.records.length = 0;
    await sendPetReport(goodPetReport);
    const response = await sendPetReport(goodPetReport);

    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.strictEqual(body.duplicate, true);
    assert.match(body.message, /may already have been submitted/);
    assert.strictEqual(MemoryPet.records.length, 1);
});

test("different pet report details are not treated as a duplicate", async () => {
    MemoryPet.records.length = 0;
    await sendPetReport(goodPetReport);
    const response = await sendPetReport(Object.assign({}, goodPetReport, {
        contact: "09987654321"
    }));

    assert.strictEqual(response.status, 201);
    assert.strictEqual(MemoryPet.records.length, 2);
});

test("matching pet report older than ten minutes can be submitted again", async () => {
    MemoryPet.records.length = 0;
    const firstResponse = await sendPetReport(goodPetReport);
    assert.strictEqual(firstResponse.status, 201);
    MemoryPet.records[0].createdAt = new Date(Date.now() - 10 * 60 * 1000 - 1);

    const response = await sendPetReport(goodPetReport);

    assert.strictEqual(response.status, 201);
    assert.strictEqual(MemoryPet.records.length, 2);
});

function sendPetReport(report) {
    return fetch(url + "/api/pets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report)
    });
}
