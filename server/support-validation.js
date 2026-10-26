const CATEGORIES = ["Correction Request", "Modification Request", "Report an Issue", "Other"];

const LIMITS = {
    subject: 100,
    email: 254,
    messageMin: 10,
    messageMax: 1000
};

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateSupportRequest(body) {
    const errors = [];

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { errors: ["Please send the support request as JSON."] };
    }

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

module.exports = {
    validateSupportRequest,
    LIMITS,
    EMAIL_PATTERN,
    CATEGORIES,
    DUPLICATE_WINDOW_MS
};
