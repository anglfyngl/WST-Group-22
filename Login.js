document.getElementById("loginForm").addEventListener("submit", function(event) {
    event.preventDefault();

    const username = document.getElementById("admin-username").value;
    const password = document.getElementById("admin-password").value;
    
    const message = document.getElementById("support-message-status");

    if (username === "admin" && password === "1234") {
        message.textContent = "Login successful!";
        message.style.color = "green";

        window.location.href = "recent-pets.html";
    } else {
        message.textContent = "Incorrect username or password.";
        message.style.color = "red";
   
    }

});