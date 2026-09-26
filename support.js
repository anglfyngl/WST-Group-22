const supportForm = document.querySelector(".support-form");
const supportStatus = document.querySelector("#support-message-status");

supportForm.addEventListener("submit", function(event) {
    event.preventDefault();

    supportStatus.textContent =
    "Your support request has been submitted successfully! We’ll reach out as soon as possible. Please check your email for updates.";
});