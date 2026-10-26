// Tests for the FurFind backend API, including support requests and lost pet reports.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const bcrypt = require("bcryptjs");
const fs = require("node:fs");
const session = require("express-session");
const vm = require("node:vm");
const { createApp } = require("../../index");
const PetModel = require("../models/Pet");

class MemorySupportRequest {
    static requests = [];
    static nextId = 1;

    constructor(fields) {
        Object.assign(this, fields);
        this._id = String(MemorySupportRequest.nextId++);
        this.submittedAt = new Date();
        this.status = this.status || "open";
        this.staffResponse = this.staffResponse || "";
    }

    static async findOne(query) {
        return this.requests.find((request) =>
            request.email === query.email &&
            request.subject === query.subject &&
            request.message === query.message &&
            request.submittedAt >= query.submittedAt.$gte
        ) || null;
    }

    static async findById(id) {
        return this.requests.find((request) => request._id === id) || null;
    }

    static find(query = {}) {
        return {
            sort: async (order) => {
                assert.deepStrictEqual(order, { submittedAt: -1 });
                return this.requests.filter((request) =>
                    query.status?.$ne === undefined ||
                    request.status !== query.status.$ne
                );
            }
        };
    }

    async validate() {
        if (!["open", "in_progress", "resolved"].includes(this.status)) {
            const error = new Error("Invalid support status.");
            error.name = "ValidationError";
            throw error;
        }
        return this;
    }

    async save() {
        if (!MemorySupportRequest.requests.includes(this)) {
            MemorySupportRequest.requests.push(this);
        }
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

    static async findById(id) {
        return this.records.find((record) => record._id === id) || null;
    }

    static async findByIdAndDelete(id) {
        const index = this.records.findIndex((record) => record._id === id);
        if (index === -1) {
            return null;
        }
        return this.records.splice(index, 1)[0];
    }

    async save() {
        MemoryPet.records.push(this);
        return this;
    }
}

class MemoryStaff {
    static account = null;

    static async findOne(query) {
        return this.account && this.account.email === query.email
            ? this.account
            : null;
    }
}

const app = createApp({
    Pet: MemoryPet,
    SupportRequest: MemorySupportRequest,
    Staff: MemoryStaff,
    sessionStore: new session.MemoryStore()
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

function sendStaffLogin(body, options = {}) {
    return fetch(url + "/api/staff/login", {
        method: "POST",
        headers: options.headers || {
            "Content-Type": "application/json",
            Origin: "http://localhost:8080"
        },
        body: options.raw !== undefined ? options.raw : JSON.stringify(body)
    });
}

function sendStaffRequest(path, options = {}) {
    const headers = {
        Origin: "http://localhost:8080",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.cookie ? { Cookie: options.cookie } : {}),
        ...(options.headers || {})
    };
    return fetch(url + path, {
        method: options.method || "GET",
        headers,
        body: options.body
    });
}

async function loginStaff() {
    const password = "staff-test-password";
    MemoryStaff.account = {
        _id: "staff-1",
        email: "staff1@furfind.com",
        passwordHash: await bcrypt.hash(password, 4),
        role: "staff"
    };

    const response = await sendStaffLogin({
        email: MemoryStaff.account.email,
        password
    });
    assert.strictEqual(response.status, 200);
    const setCookie = response.headers.get("set-cookie");
    assert.ok(setCookie);
    return setCookie.split(";")[0];
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

function getDateOffsetInTimeZone(offset, timeZone) {
    const dateParts = Object.fromEntries(
        new Intl.DateTimeFormat("en", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(new Date()).map(({ type, value }) => [type, value])
    );
    const date = new Date(Date.UTC(
        Number(dateParts.year),
        Number(dateParts.month) - 1,
        Number(dateParts.day) + offset
    ));
    return date.toISOString().slice(0, 10);
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

test("staff login verifies a bcrypt password and normalizes email", async () => {
    const password = "test-only-password";
    MemoryStaff.account = {
        _id: "staff-1",
        email: "staff1@furfind.com",
        passwordHash: await bcrypt.hash(password, 4),
        role: "admin"
    };

    const response = await sendStaffLogin({
        email: "  STAFF1@FURFIND.COM ",
        password
    });

    assert.strictEqual(response.status, 200);
    assert.match(response.headers.get("set-cookie"), /HttpOnly/i);
    assert.match(response.headers.get("set-cookie"), /SameSite=Strict/i);
    assert.match(response.headers.get("set-cookie"), /Path=\/api\/staff/i);
    assert.deepStrictEqual(await response.json(), {
        message: "Credentials verified.",
        staff: {
            id: "staff-1",
            email: "staff1@furfind.com",
            role: "admin"
        }
    });
});

test("staff login rejects an unknown email with a generic message", async () => {
    const password = "test-only-password";
    MemoryStaff.account = {
        _id: "staff-unknown",
        email: "unknown@furfind.com",
        passwordHash: await bcrypt.hash(password, 4),
        role: "staff"
    };

    const response = await sendStaffLogin({
        email: MemoryStaff.account.email,
        password
    });

    assert.strictEqual(response.status, 401);
    assert.strictEqual(response.headers.get("set-cookie"), null);
    assert.deepStrictEqual(await response.json(), {
        message: "Invalid email or password."
    });
});

test("staff login rejects a wrong password with a generic message", async () => {
    MemoryStaff.account = {
        _id: "staff-1",
        email: "staff1@furfind.com",
        passwordHash: await bcrypt.hash("correct-test-password", 4),
        role: "staff"
    };

    const response = await sendStaffLogin({
        email: "staff1@furfind.com",
        password: "incorrect-test-password"
    });

    assert.strictEqual(response.status, 401);
    assert.deepStrictEqual(await response.json(), {
        message: "Invalid email or password."
    });
});

test("staff login rejects a missing email with a generic message", async () => {
    const response = await sendStaffLogin({
        email: "",
        password: "test-only-password"
    });

    assert.strictEqual(response.status, 401);
    assert.deepStrictEqual(await response.json(), {
        message: "Invalid email or password."
    });
});

test("staff login rejects a missing password with a generic message", async () => {
    const response = await sendStaffLogin({
        email: "staff1@furfind.com",
        password: ""
    });

    assert.strictEqual(response.status, 401);
    assert.deepStrictEqual(await response.json(), {
        message: "Invalid email or password."
    });
});

test("staff login rejects malformed JSON with a generic message (400)", async () => {
    const response = await sendStaffLogin(null, { raw: "{broken" });

    assert.strictEqual(response.status, 400);
    assert.deepStrictEqual(await response.json(), {
        message: "Invalid email or password."
    });
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

test("staff APIs reject unauthenticated reads and updates", async () => {
    MemoryPet.records.length = 0;
    MemorySupportRequest.requests.length = 0;
    const pet = new MemoryPet(goodPetReport);
    await pet.save();
    const request = new MemorySupportRequest(goodRequest);
    await request.save();

    const petList = await sendStaffRequest("/api/staff/pets");
    const supportList = await sendStaffRequest("/api/staff/support-requests");
    const petUpdate = await sendStaffRequest(`/api/staff/pets/${pet._id}`, {
        method: "PATCH",
        body: JSON.stringify({ location: "Updated location" })
    });
    const petDelete = await sendStaffRequest(`/api/staff/pets/${pet._id}`, {
        method: "DELETE"
    });
    const supportUpdate = await sendStaffRequest(
        `/api/staff/support-requests/${request._id}`,
        {
            method: "PATCH",
            body: JSON.stringify({ status: "resolved" })
        }
    );

    assert.strictEqual(petList.status, 401);
    assert.strictEqual(supportList.status, 401);
    assert.strictEqual(petUpdate.status, 401);
    assert.strictEqual(petDelete.status, 401);
    assert.strictEqual(supportUpdate.status, 401);
    assert.strictEqual(pet.location, goodPetReport.location);
    assert.strictEqual(MemoryPet.records.length, 1);
    assert.strictEqual(request.status, "open");
});

test("authenticated staff can view and update pet reports and support requests", async () => {
    MemoryPet.records.length = 0;
    MemorySupportRequest.requests.length = 0;
    const pet = new MemoryPet(goodPetReport);
    await pet.save();
    const supportRequest = new MemorySupportRequest(goodRequest);
    await supportRequest.save();
    const cookie = await loginStaff();

    const sessionResponse = await sendStaffRequest("/api/staff/session", { cookie });
    assert.strictEqual(sessionResponse.status, 200);
    assert.strictEqual((await sessionResponse.json()).staff.email, "staff1@furfind.com");

    const petsResponse = await sendStaffRequest("/api/staff/pets", { cookie });
    assert.strictEqual(petsResponse.status, 200);
    assert.strictEqual((await petsResponse.json()).pets.length, 1);

    const petUpdate = await sendStaffRequest(`/api/staff/pets/${pet._id}`, {
        method: "PATCH",
        cookie,
        body: JSON.stringify({ location: "Makati City" })
    });
    assert.strictEqual(petUpdate.status, 200);
    assert.strictEqual(pet.location, "Makati City");
    const refreshedPetList = await sendStaffRequest("/api/staff/pets", { cookie });
    const refreshedPets = await refreshedPetList.json();
    assert.strictEqual(refreshedPets.pets[0].location, "Makati City");

    const supportResponse = await sendStaffRequest("/api/staff/support-requests", {
        cookie
    });
    assert.strictEqual(supportResponse.status, 200);
    assert.strictEqual((await supportResponse.json()).requests.length, 1);

    const supportUpdate = await sendStaffRequest(
        `/api/staff/support-requests/${supportRequest._id}`,
        {
            method: "PATCH",
            cookie,
            body: JSON.stringify({
                status: "in_progress",
                staffResponse: "We are reviewing this request."
            })
        }
    );
    assert.strictEqual(supportUpdate.status, 200);
    const updateBody = await supportUpdate.json();
    assert.strictEqual(supportRequest.status, "in_progress");
    assert.strictEqual(
        supportRequest.staffResponse,
        "We are reviewing this request."
    );
    assert.match(updateBody.message, /has not been emailed/);
});

test("authenticated staff can delete only the selected pet report", async () => {
    MemoryPet.records.length = 0;
    const firstPet = new MemoryPet(goodPetReport);
    const secondPet = new MemoryPet(Object.assign({}, goodPetReport, {
        name: "Luna"
    }));
    await firstPet.save();
    await secondPet.save();
    const cookie = await loginStaff();

    const response = await sendStaffRequest(`/api/staff/pets/${firstPet._id}`, {
        method: "DELETE",
        cookie
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(MemoryPet.records.length, 1);
    assert.strictEqual(MemoryPet.records[0]._id, secondPet._id);
});

test("staff dashboard confirms pet edits only after the API confirms and keeps failed edits", async () => {
    class MockElement {
        constructor(tagName = "div") {
            this.tagName = tagName;
            this.children = [];
            this.listeners = {};
            this.attributes = {};
            this.classes = new Set();
            this.hidden = false;
            this.disabled = false;
            this.isConnected = true;
            this.classList = {
                add: (name) => this.classes.add(name),
                remove: (name) => this.classes.delete(name),
                toggle: (name, force) => {
                    if (force) {
                        this.classes.add(name);
                    } else {
                        this.classes.delete(name);
                    }
                }
            };
        }

        append(...children) {
            for (const child of children) {
                child.parent = this;
            }
            this.children.push(...children);
        }

        replaceChildren(...children) {
            for (const child of children) {
                child.parent = this;
            }
            this.children = children;
        }

        addEventListener(type, handler) {
            this.listeners[type] = handler;
        }

        focus() {
            activeState.element = this;
        }

        setAttribute(name, value) {
            this.attributes[name] = value;
        }

        remove() {
            this.removed = true;
        }
    }

    const activeState = { element: null };
    const elements = {
        "dashboard-message": new MockElement(),
        "pet-reports-title": new MockElement("h2"),
        "staff-pet-reports": new MockElement(),
        "staff-support-requests": new MockElement(),
        "staff-logout": new MockElement(),
        "delete-pet-modal": new MockElement(),
        "delete-pet-modal-close": new MockElement("button"),
        "delete-pet-modal-cancel": new MockElement("button"),
        "delete-pet-modal-confirm": new MockElement("button"),
        "delete-pet-modal-pet-name": new MockElement("p"),
        "delete-pet-modal-error": new MockElement("p")
    };
    const report = {
        _id: "pet-ui-1",
        name: "Milo",
        type: "Cat",
        breed: "Tabby",
        age: 3,
        ageUnit: "Years",
        gender: "Male",
        location: "Quezon City",
        contact: "09123456789",
        missingSince: getDateOffset(-1)
    };
    const secondReport = {
        ...report,
        _id: "pet-ui-2",
        name: "Luna"
    };
    const supportRecord = {
        _id: "support-ui-1",
        subject: "Lost pet report correction",
        email: "customer@example.com",
        category: "Correction Request",
        message: "Please correct the location on this pet report.",
        status: "open",
        staffResponse: ""
    };
    const longSupportRecord = {
        ...supportRecord,
        _id: "support-ui-2",
        subject: "A longer customer request",
        email: "another-customer@example.com",
        message: "Please review these details. ".repeat(30)
    };
    let failUpdate = true;
    let waitForUpdate = false;
    let updateCalls = 0;
    let resolveUpdate;
    let failDelete = true;
    let deleteCalls = 0;
    let resolveDelete;
    let waitForDelete = false;

    const context = {
        document: {
            getElementById: (id) => elements[id],
            createElement: (tagName) => new MockElement(tagName),
            addEventListener(type, handler) {
                this.listeners[type] = handler;
            },
            listeners: {},
            get activeElement() {
                return activeState.element;
            }
        },
        window: {
            location: {
                protocol: "http:",
                hostname: "localhost",
                replace() {}
            },
            confirm: () => {
                throw new Error("Native confirmation must not be used.");
            }
        },
        Intl,
        Date,
        fetch: async (url, options = {}) => {
            if (url.endsWith("/api/staff/session")) {
                return jsonResponse(200, { staff: { email: "staff1@furfind.com" } });
            }
            if (url.endsWith("/api/staff/pets")) {
                return jsonResponse(200, { pets: [report, secondReport] });
            }
            if (url.endsWith("/api/staff/support-requests")) {
                return jsonResponse(200, {
                    requests: [supportRecord, longSupportRecord]
                });
            }
            if (url.endsWith(`/api/staff/support-requests/${supportRecord._id}`)) {
                supportRecord.status = JSON.parse(options.body).status;
                return jsonResponse(200, { message: "Support request updated." });
            }
            if (url.endsWith(`/api/staff/pets/${report._id}`) && options.method === "PATCH") {
                updateCalls += 1;
                if (waitForUpdate) {
                    return new Promise((resolve) => {
                        resolveUpdate = resolve;
                    });
                }
                if (failUpdate) {
                    return jsonResponse(500, { message: "Unable to save changes." });
                }
                return jsonResponse(200, {
                    message: "Pet report updated.",
                    pet: { ...report, ...JSON.parse(options.body) }
                });
            }
            if (url.endsWith(`/api/staff/pets/${report._id}`) && options.method === "DELETE") {
                deleteCalls += 1;
                if (waitForDelete) {
                    return new Promise((resolve) => {
                        resolveDelete = resolve;
                    });
                }
                return failDelete
                    ? jsonResponse(500, { message: "Unable to delete the report." })
                    : jsonResponse(200, { message: "Pet report deleted." });
            }
            throw new Error(`Unexpected dashboard request: ${url}`);
        },
        console
    };

    function jsonResponse(status, body) {
        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => body
        };
    }

    vm.runInNewContext(
        fs.readFileSync("frontend/staff-dashboard.js", "utf8"),
        context
    );
    await new Promise((resolve) => setImmediate(resolve));

    const card = elements["staff-pet-reports"].children[0];
    const secondCard = elements["staff-pet-reports"].children[1];
    const form = card.children[1];
    const actions = form.children[form.children.length - 1];
    const recordMessage = actions.children[0];
    const saveButton = actions.children[1];
    const deleteButton = actions.children[2];
    const nameInput = form.children
        .map((label) => label.children[0])
        .find((control) => control.name === "name");
    assert.strictEqual(recordMessage.attributes.role, "status");
    assert.strictEqual(recordMessage.attributes["aria-live"], "polite");
    assert.strictEqual(recordMessage.parent, actions);
    assert.strictEqual(recordMessage.textContent, "");
    assert.strictEqual(secondCard.children[1].children.at(-1).children[0].textContent, "");
    nameInput.value = "Milo updated";
    nameInput.listeners.input();
    assert.strictEqual(recordMessage.textContent, "Unsaved changes");
    assert.strictEqual(secondCard.children[1].children.at(-1).children[0].textContent, "");

    waitForUpdate = true;
    const firstSavePromise = form.listeners.submit({ preventDefault() {} });
    assert.strictEqual(recordMessage.textContent, "Saving…");
    assert.strictEqual(saveButton.disabled, true);
    await form.listeners.submit({ preventDefault() {} });
    assert.strictEqual(updateCalls, 1);
    resolveUpdate(jsonResponse(500, { message: "Unable to save changes." }));
    await firstSavePromise;
    waitForUpdate = false;
    assert.strictEqual(recordMessage.textContent, "Unable to save changes.");
    assert.strictEqual(secondCard.children[1].children.at(-1).children[0].textContent, "");
    assert.strictEqual(recordMessage.classes.has("status-error"), true);
    assert.strictEqual(nameInput.value, "Milo updated");

    failUpdate = false;
    await form.listeners.submit({ preventDefault() {} });
    assert.strictEqual(recordMessage.textContent, "Changes saved");
    assert.strictEqual(recordMessage.classes.has("status-error"), false);
    assert.strictEqual(secondCard.children[1].children.at(-1).children[0].textContent, "");
    nameInput.value = "Milo edited again";
    nameInput.listeners.input();
    assert.strictEqual(recordMessage.textContent, "Unsaved changes");
    waitForUpdate = true;
    const savePromise = form.listeners.submit({ preventDefault() {} });
    assert.strictEqual(saveButton.disabled, true);
    await form.listeners.submit({ preventDefault() {} });
    assert.strictEqual(updateCalls, 3);
    resolveUpdate(jsonResponse(200, {
        message: "Pet report updated.",
        pet: { ...report, name: "Milo edited again" }
    }));
    await savePromise;
    waitForUpdate = false;
    assert.strictEqual(saveButton.disabled, false);
    assert.strictEqual(recordMessage.textContent, "Changes saved");

    await deleteButton.listeners.click();
    assert.strictEqual(elements["delete-pet-modal"].hidden, false);
    assert.strictEqual(elements["delete-pet-modal-pet-name"].textContent, "Milo");
    assert.strictEqual(activeState.element, elements["delete-pet-modal-cancel"]);
    await elements["delete-pet-modal-cancel"].listeners.click();
    assert.strictEqual(elements["delete-pet-modal"].hidden, true);
    assert.strictEqual(activeState.element, deleteButton);
    assert.strictEqual(deleteCalls, 0);

    await deleteButton.listeners.click();
    await elements["delete-pet-modal-close"].listeners.click();
    assert.strictEqual(elements["delete-pet-modal"].hidden, true);

    await deleteButton.listeners.click();
    const escapeEvent = {
        key: "Escape",
        preventDefault() {
            this.prevented = true;
        }
    };
    context.document.listeners.keydown(escapeEvent);
    assert.strictEqual(escapeEvent.prevented, true);
    assert.strictEqual(elements["delete-pet-modal"].hidden, true);

    await deleteButton.listeners.click();
    elements["delete-pet-modal"].listeners.click({
        target: elements["delete-pet-modal"]
    });
    assert.strictEqual(elements["delete-pet-modal"].hidden, true);

    await deleteButton.listeners.click();
    const focusEvent = {
        key: "Tab",
        shiftKey: false,
        preventDefault() {
            this.prevented = true;
        }
    };
    activeState.element = elements["delete-pet-modal-confirm"];
    context.document.listeners.keydown(focusEvent);
    assert.strictEqual(activeState.element, elements["delete-pet-modal-close"]);
    assert.strictEqual(focusEvent.prevented, true);

    failDelete = true;
    await elements["delete-pet-modal-confirm"].listeners.click();
    assert.strictEqual(card.removed, undefined);
    assert.strictEqual(recordMessage.textContent, "Unable to delete the report.");
    assert.strictEqual(elements["delete-pet-modal"].hidden, false);
    assert.strictEqual(elements["delete-pet-modal-error"].textContent, "Unable to delete the report.");

    failDelete = false;
    waitForDelete = true;
    const deletePromise = elements["delete-pet-modal-confirm"].listeners.click();
    assert.strictEqual(elements["delete-pet-modal-confirm"].disabled, true);
    assert.strictEqual(elements["delete-pet-modal-cancel"].disabled, true);
    assert.strictEqual(elements["delete-pet-modal-close"].disabled, true);
    await elements["delete-pet-modal-confirm"].listeners.click();
    assert.strictEqual(deleteCalls, 2);
    resolveDelete(jsonResponse(200, { message: "Pet report deleted." }));
    await deletePromise;
    assert.strictEqual(elements["delete-pet-modal"].hidden, true);
    assert.strictEqual(card.removed, true);
    assert.strictEqual(activeState.element, elements["pet-reports-title"]);

    const dashboardSource = fs.readFileSync("frontend/staff-dashboard.js", "utf8");
    assert.doesNotMatch(dashboardSource, /window\.confirm/);
    const dashboardHtml = fs.readFileSync("frontend/staff-dashboard.html", "utf8");
    assert.match(dashboardHtml, /role="dialog"/);
    assert.match(dashboardHtml, /aria-modal="true"/);
    assert.match(dashboardHtml, /Delete Report/);

    const supportCard = elements["staff-support-requests"].children[0];
    const longSupportCard = elements["staff-support-requests"].children[1];
    const supportDetails = supportCard.children[1];
    const supportForm = supportCard.children.find((child) => child.tagName === "form");
    assert.strictEqual(supportDetails.children[0].children[0].tagName, "strong");
    assert.strictEqual(supportDetails.children[0].children[0].textContent, "From:");
    assert.strictEqual(
        supportDetails.children[0].children[1].textContent,
        ` ${supportRecord.email}`
    );
    assert.strictEqual(supportDetails.children[1].children[0].tagName, "strong");
    assert.strictEqual(supportDetails.children[1].children[0].textContent, "Category:");
    assert.strictEqual(
        supportDetails.children[1].children[1].textContent,
        ` ${supportRecord.category}`
    );
    assert.strictEqual(supportDetails.children[2].textContent, "Messages");
    assert.strictEqual(supportDetails.children[3].textContent, supportRecord.message);
    assert.strictEqual(supportDetails.children[2].className, "staff-request-message-label");
    assert.strictEqual(
        longSupportCard.children[1].children[3].textContent,
        longSupportRecord.message
    );
    assert.strictEqual(supportForm.children[0].textContent, "Status");
    assert.strictEqual(
        supportForm.children[1].textContent,
        "Staff response (saved only; not emailed)"
    );
    assert.strictEqual(supportForm.children[2].textContent, "Save support update");
    assert.strictEqual(supportForm.children[3].attributes.role, "status");
    assert.strictEqual(supportForm.children[3].attributes["aria-live"], "polite");
    const statusSelect = supportForm.children[0].children[0];
    statusSelect.value = "resolved";
    await supportForm.listeners.submit({ preventDefault() {} });
    assert.strictEqual(supportRecord.status, "resolved");
    assert.strictEqual(supportCard.removed, true);
});

test("active support requests exclude resolved records without deleting them", async () => {
    MemorySupportRequest.requests.length = 0;
    const activeRequest = new MemorySupportRequest(goodRequest);
    const resolvedRequest = new MemorySupportRequest(Object.assign({}, goodRequest, {
        subject: "Resolved reference",
        status: "resolved"
    }));
    await activeRequest.save();
    await resolvedRequest.save();
    const cookie = await loginStaff();

    const response = await sendStaffRequest("/api/staff/support-requests", { cookie });
    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.deepStrictEqual(body.requests.map((request) => request._id), [
        activeRequest._id
    ]);

    const updateResponse = await sendStaffRequest(
        `/api/staff/support-requests/${activeRequest._id}`,
        {
            method: "PATCH",
            cookie,
            body: JSON.stringify({ status: "resolved" })
        }
    );
    assert.strictEqual(updateResponse.status, 200);
    const refreshedList = await sendStaffRequest("/api/staff/support-requests", { cookie });
    assert.deepStrictEqual((await refreshedList.json()).requests, []);
    assert.strictEqual(
        MemorySupportRequest.requests.find((request) => request._id === activeRequest._id).status,
        "resolved"
    );
    assert.strictEqual(
        MemorySupportRequest.requests.some((request) => request._id === resolvedRequest._id),
        true
    );
});

test("staff logout destroys the session and protects the dashboard APIs afterward", async () => {
    const cookie = await loginStaff();
    const logoutResponse = await sendStaffRequest("/api/staff/logout", {
        method: "POST",
        cookie
    });
    assert.strictEqual(logoutResponse.status, 204);

    const sessionResponse = await sendStaffRequest("/api/staff/session", { cookie });
    assert.strictEqual(sessionResponse.status, 401);
});

test("existing pet report routes remain available", async () => {
    MemoryPet.records.length = 0;
    MemoryPet.nextId = 1;
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

test("pet report with today's missing date is accepted", async () => {
    MemoryPet.records.length = 0;
    const response = await sendPetReport(Object.assign({}, goodPetReport, {
        missingSince: getDateOffset(0)
    }));

    assert.strictEqual(response.status, 201);
    assert.strictEqual(MemoryPet.records.length, 1);
});

test("backend accepts today in the submitting user's timezone", async () => {
    const timeZone = "Pacific/Kiritimati";
    const response = await sendPetReport(
        Object.assign({}, goodPetReport, {
            missingSince: getDateOffsetInTimeZone(0, timeZone)
        }),
        timeZone
    );

    assert.strictEqual(response.status, 201);
});

test("public API falls back to server-local today for an unusable timezone header", async () => {
    MemoryPet.records.length = 0;
    const response = await sendPetReport(
        Object.assign({}, goodPetReport, {
            missingSince: getDateOffset(0)
        }),
        "Invalid/Timezone"
    );

    assert.strictEqual(response.status, 201);
});

test("Mongo pet schema accepts valid calendar dates and rejects impossible dates", async () => {
    const validToday = new PetModel(Object.assign({}, goodPetReport, {
        missingSince: getDateOffset(0)
    }));
    await assert.doesNotReject(validToday.validate());

    const invalidDate = new PetModel(Object.assign({}, goodPetReport, {
        missingSince: "2026-02-30"
    }));
    await assert.rejects(invalidDate.validate(), { name: "ValidationError" });
});

test("public report date input uses today's local date as its maximum", () => {
    const fields = {
        ".report-form": { addEventListener() {} },
        "#pet-photo": { addEventListener() {} },
        "#missing-since": {
            addEventListener(type, handler) {
                this.listeners[type] = handler;
            },
            setCustomValidity(message) {
                this.validationMessage = message;
            },
            listeners: {}
        },
        "#report-message": { textContent: "" }
    };
    const context = {
        document: { querySelector: (selector) => fields[selector] },
        Date,
        Intl,
        console
    };
    vm.runInNewContext(fs.readFileSync("frontend/script.js", "utf8"), context);

    assert.strictEqual(fields["#missing-since"].max, getDateOffset(0));
    fields["#missing-since"].value = getDateOffset(0);
    fields["#missing-since"].listeners.input();
    assert.strictEqual(fields["#missing-since"].validationMessage, "");

    fields["#missing-since"].value = getDateOffset(1);
    fields["#missing-since"].listeners.input();
    assert.match(fields["#missing-since"].validationMessage, /Future dates are not allowed/);

    fields["#missing-since"].value = "2026-02-30";
    fields["#missing-since"].listeners.input();
    assert.match(fields["#missing-since"].validationMessage, /Future dates are not allowed/);
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

function sendPetReport(
    report,
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
) {
    return fetch(url + "/api/pets", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Client-Timezone": timeZone
        },
        body: JSON.stringify(report)
    });
}
