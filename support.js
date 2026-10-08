const supportForm = document.querySelector(".support-form");
const supportStatus = document.querySelector("#support-message-status");

supportForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const supportRequest = {
        subject:  document.querySelector("#support-subject").value,
        email:    document.querySelector("#support-email").value,
        category: document.querySelector("#issue-category").value,
        message:  document.querySelector("#support-message").value
    };

    supportStatus.textContent = "Sending your request...";

    try {
        const response = await fetch("/api/support", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(supportRequest)
        });

        const result = await response.json();

        if (response.ok) {
            supportStatus.textContent =
                "Your support request has been submitted successfully! We’ll reach out as soon as possible. Please check your email for updates.";
            supportForm.reset();
        } else {
            supportStatus.textContent = result.errors.join(" ");
        }
    } catch (error) {
        supportStatus.textContent = "Sorry, we couldn't reach the server. Please try again later.";
    }
});