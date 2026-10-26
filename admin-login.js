
const loginForm = document.getElementById("staff-login-form");
const loginMessage = document.getElementById("login-message");

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const email = document.getElementById("staff-email").value.trim();
  const password = document.getElementById("staff-password").value;

  if (!email || !password) {
    loginMessage.textContent = "Please fill in all fields.";
    loginMessage.style.color = "red";
    return;
  }

  loginMessage.textContent = "Checking credentials...";
  loginMessage.style.color = "black";

  try {
    const response = await fetch("http://localhost:3000/api/staff/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();

    if (response.ok) {
      loginMessage.textContent =
        "Credentials verified. Welcome, FurFind Staff!";
      loginMessage.style.color = "green";
    } else {
      loginMessage.textContent =
        result.message || "Invalid email or password.";
      loginMessage.style.color = "red";
    }
  } catch (error) {
    console.error("Staff login request failed:", error);
    loginMessage.textContent =
      "Unable to connect to the server. Please try again.";
    loginMessage.style.color = "red";
  }
});
