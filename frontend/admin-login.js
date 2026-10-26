const loginForm = document.getElementById("staff-login-form");
const loginMessage = document.getElementById("login-message");
const apiBaseUrl = `${window.location.protocol}//${window.location.hostname}:3000`;

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("staff-email").value.trim();
    const password = document.getElementById("staff-password").value;

    if (!email || !password) {
        loginMessage.textContent = "Invalid email or password.";
        loginMessage.style.color = "red";
        return;
    }

    loginMessage.textContent = "Checking credentials...";
    loginMessage.style.color = "black";

    try {
        const response = await fetch(`${apiBaseUrl}/api/staff/login`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();
        const loginSucceeded = response.ok &&
            result.message === "Credentials verified." &&
            result.staff &&
            typeof result.staff.id === "string" &&
            typeof result.staff.email === "string";

        if (!loginSucceeded) {
            loginMessage.textContent = response.ok
                ? "Unable to verify login response. Please try again."
                : result.message || "Invalid email or password.";
            loginMessage.style.color = "red";
            return;
        }

        loginMessage.textContent = result.message;
        loginMessage.style.color = "green";
        window.location.replace(
            new URL(
                "staff-dashboard.html?v=20261026-save-status-2",
                document.baseURI
            ).href
        );
    } catch (error) {
        console.error("Staff login request failed:", error);
        loginMessage.textContent =
            "Unable to connect to the server. Please try again.";
        loginMessage.style.color = "red";
    }
});
