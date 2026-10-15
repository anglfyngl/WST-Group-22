const supportForm = document.querySelector(".support-form");
const supportStatus = document.querySelector("#support-message-status");
const submitButton = supportForm.querySelector("button[type='submit']");

// Shows a message under the form; errors and success use different colors.
function showStatus(text, type) {
    supportStatus.textContent = text;
    supportStatus.className = type ? "status-" + type : "";
}

supportForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    // Stop double-clicks from sending the same request twice.
    if (submitButton.disabled) {
        return;
    }

    const supportRequest = {
        subject:  document.querySelector("#support-subject").value,
        email:    document.querySelector("#support-email").value,
        category: document.querySelector("#issue-category").value,
        message:  document.querySelector("#support-message").value
    };

    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
    showStatus("Sending your request...", "info");

    try {
        const response = await fetch("/api/support", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(supportRequest)
        });

        // The server always answers with JSON; if it does not, show a general error.
        let result = {};
        try {
            result = await response.json();
        } catch (error) {
            result = {};
        }

        if (response.status === 201) {
            showStatus("Your support request has been submitted successfully! We’ll reach out as soon as possible. Please check your email for updates.", "success");
            supportForm.reset();
        } else if (response.ok && result.duplicate) {
            showStatus(result.message, "info");
        } else if (result.errors) {
            showStatus(result.errors.join(" "), "error");
        } else {
            showStatus("Something went wrong (error " + response.status + "). Please try again later.", "error");
        }
    } catch (error) {
        showStatus("Sorry, we couldn't reach the server. Please check your connection and try again.", "error");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Request";
    }
});
