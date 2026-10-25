
const loginForm = document.getElementById("staff-login-form");
const loginMessage = document.getElementById("login-message");

loginForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const email = document.getElementById("staff-email").value.trim();
    const password = document.getElementById("staff-password").value;

    if (!email || !password) {
        loginMessage.textContent = "Please fill in all fields.";
        loginMessage.style.color = "red";
        return;
    }

    // Demo login only - not connected to a database.
if (email === "staff@furfind.com" && password === "StaffDemo123!") {
        loginMessage.textContent = "Login successful! Welcome, FurFind Staff.";
        loginMessage.style.color = "green";
    } else {
        loginMessage.textContent = "Invalid email or password.";
        loginMessage.style.color = "red";
    }
});
