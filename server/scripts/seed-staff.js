const path = require("node:path");
const fs = require("node:fs");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const Staff = require("../models/Staff");
const { APPROVED_STAFF_EMAILS } = require("../staff-accounts");
const MIN_PASSWORD_LENGTH = 8;

function promptSecret(label) {
    return new Promise((resolve, reject) => {
        let value = "";
        const input = process.stdin;

        function finish(error) {
            input.removeListener("data", onData);
            input.setRawMode(false);
            process.stdout.write("\n");

            if (error) {
                reject(error);
            } else {
                resolve(value);
            }
        }

        function onData(chunk) {
            for (const character of chunk) {
                if (character === "\u0003") {
                    finish(new Error("Setup cancelled."));
                    return;
                }

                if (character === "\r" || character === "\n") {
                    finish();
                    return;
                }

                if (character === "\u0008" || character === "\u007f") {
                    value = Array.from(value).slice(0, -1).join("");
                } else if (character >= " ") {
                    value += character;
                }
            }
        }

        process.stdout.write(label);
        input.setEncoding("utf8");
        input.setRawMode(true);
        input.resume();
        input.on("data", onData);
    });
}

async function promptForPassword(email) {
    const password = await promptSecret(
        `Password for ${email} (input hidden): `
    );
    const confirmation = await promptSecret("Confirm password (input hidden): ");

    if (password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Passwords must contain at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    if (password !== confirmation) {
        throw new Error("The passwords do not match.");
    }

    return password;
}

function readCredentialsFile(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    const pattern = /^### STAFF ACCOUNT (\d+)\r?\n\*\*EMAIL:\*\* \[([^\]]+)\]\(mailto:([^)]+)\)\r?\n\*\*PASSWORD:\*\* ([^\r\n]+)$/gm;
    const credentials = new Map();
    let match;

    while ((match = pattern.exec(content)) !== null) {
        const [, accountNumber, email, mailto, password] = match;
        const expectedEmail = APPROVED_STAFF_EMAILS[Number(accountNumber) - 1];
        const normalizedEmail = email.trim().toLowerCase();

        if (
            !expectedEmail ||
            expectedEmail !== normalizedEmail ||
            mailto.trim().toLowerCase() !== normalizedEmail ||
            credentials.has(normalizedEmail) ||
            password.length < MIN_PASSWORD_LENGTH
        ) {
            throw new Error("Credential reference file is invalid.");
        }

        credentials.set(normalizedEmail, password);
    }

    if (
        credentials.size !== APPROVED_STAFF_EMAILS.length ||
        APPROVED_STAFF_EMAILS.some((email) => !credentials.has(email))
    ) {
        throw new Error("Credential reference file is invalid.");
    }

    return credentials;
}

function getCredentialsFileArgument() {
    const argumentIndex = process.argv.indexOf("--credentials-file");

    if (argumentIndex === -1) {
        return null;
    }

    const filePath = process.argv[argumentIndex + 1];
    if (!filePath || process.argv.length !== argumentIndex + 2) {
        throw new Error("Provide one file path after --credentials-file.");
    }

    return path.resolve(process.cwd(), filePath);
}

async function seedStaffAccounts() {
    const credentialsFile = getCredentialsFileArgument();
    if (
        !credentialsFile &&
        (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function")
    ) {
        throw new Error(
            "Use --credentials-file in a local terminal or run this command interactively."
        );
    }

    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is not configured in the root .env file.");
    }

    const credentials = credentialsFile
        ? readCredentialsFile(credentialsFile)
        : null;

    await mongoose.connect(process.env.MONGODB_URI);
    await Staff.init();
    const passwordMismatches = [];

    for (const email of APPROVED_STAFF_EMAILS) {
        const password = credentials
            ? credentials.get(email)
            : await promptForPassword(email);
        const existingStaff = await Staff.findOne({ email })
            .select("_id passwordHash")
            .lean();

        if (existingStaff) {
            const passwordMatches = await bcrypt.compare(
                password,
                existingStaff.passwordHash
            );

            if (passwordMatches) {
                console.log(`Existing staff account verified: ${email}`);
            } else {
                passwordMismatches.push(email);
                console.error(`Existing staff account password differs: ${email}`);
            }
            continue;
        }

        const passwordHash = await bcrypt.hash(password, 12);

        try {
            await new Staff({ email, passwordHash }).save();
            console.log(`Created staff account: ${email}`);
        } catch (error) {
            if (error.code === 11000) {
                const racedStaff = await Staff.findOne({ email })
                    .select("passwordHash")
                    .lean();
                const passwordMatches = racedStaff && await bcrypt.compare(
                    password,
                    racedStaff.passwordHash
                );

                if (passwordMatches) {
                    console.log(`Existing staff account verified: ${email}`);
                } else {
                    passwordMismatches.push(email);
                    console.error(`Existing staff account password differs: ${email}`);
                }
                continue;
            }

            throw error;
        }
    }

    if (passwordMismatches.length > 0) {
        throw new Error(
            "Existing account passwords differ for: " +
            `${passwordMismatches.join(", ")}. Existing passwords were not changed.`
        );
    }
}

seedStaffAccounts()
    .catch((error) => {
        if (
            error.message === "Setup cancelled." ||
            error.message === `Passwords must contain at least ${MIN_PASSWORD_LENGTH} characters.` ||
            error.message === "The passwords do not match." ||
            error.message === "MONGODB_URI is not configured in the root .env file." ||
            error.message === "Credential reference file is invalid." ||
            error.message === "Provide one file path after --credentials-file." ||
            error.message.startsWith("Use --credentials-file")
        ) {
            console.error(error.message);
        } else {
            console.error(
                `Could not seed staff accounts (${error.name || "Error"}). ` +
                "Check MongoDB availability, the MONGODB_URI setting, and database permissions."
            );
        }

        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });
