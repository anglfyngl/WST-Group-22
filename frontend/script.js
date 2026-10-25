const reportForm = document.querySelector(".report-form");
const petPhoto = document.querySelector("#pet-photo");
const missingSinceInput = document.querySelector("#missing-since");
const reportMessage = document.querySelector("#report-message");

function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getTodayLocalDate() {
    return formatLocalDate(new Date());
}

function isValidMissingSinceDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value.split("-").map(Number);
    const calendarDate = new Date(0);
    calendarDate.setUTCFullYear(year, month - 1, day);
    calendarDate.setUTCHours(0, 0, 0, 0);

    return calendarDate.toISOString().slice(0, 10) === value &&
        value <= getTodayLocalDate();
}

missingSinceInput.max = getTodayLocalDate();

const invalidDateMessage =
    "Please select today or an earlier date. Future dates are not allowed.";

missingSinceInput.addEventListener("input", function() {
    missingSinceInput.setCustomValidity(
        isValidMissingSinceDate(missingSinceInput.value) ? "" : invalidDateMessage
    );
});

missingSinceInput.addEventListener("invalid", function() {
    if (missingSinceInput.value && missingSinceInput.value > getTodayLocalDate()) {
        reportMessage.textContent = invalidDateMessage;
    }
    missingSinceInput.setCustomValidity(invalidDateMessage);
});


petPhoto.addEventListener("change", function() {
    const file = petPhoto.files[0];

    if (!file) {
        return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.substring(fileName.lastIndexOf("."));

    if (!allowedTypes.includes(file.type) || !allowedExtensions.includes(fileExtension)) {
        alert("Please select a JPG, JPEG, PNG, GIF, or WEBP image only.");
        petPhoto.value = "";
    }
});


reportForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const missingSince = missingSinceInput.value;

    if (!isValidMissingSinceDate(missingSince)) {
        reportMessage.textContent = invalidDateMessage;
        return;
    }

    const contactNumber =
        document.querySelector("#contact-number").value;


    if (!/^[0-9]+$/.test(contactNumber)) {
        alert("Contact number must contain numbers only.");
        return;
    }

    const file = petPhoto.files[0];

    if (!file) {
        return;
    }

    const reader = new FileReader();

    reader.onload = function() {
        const image = new Image();

        image.onload = function() {

            const maxWidth = 600;

            let width = image.width;
            let height = image.height;

            if (width > maxWidth) {
                height = height * (maxWidth / width);
                width = maxWidth;
            }

            const canvas = document.createElement("canvas");

            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext("2d");

            context.drawImage(image, 0, 0, width, height);

            const compressedImage =
                canvas.toDataURL("image/jpeg", 0.7);

            const petReport = {
                id: Date.now(),
                name: document.querySelector("#pet-name").value,
                type: document.querySelector("#type").value,
                breed: document.querySelector("#breed").value,
                age: document.querySelector("#age").value,
                ageUnit: document.querySelector("#age-unit").value,
                gender: document.querySelector("#gender").value,
                location: document.querySelector("#last-seen").value,
                contact: contactNumber,
                missingSince: missingSince,
                image: compressedImage
            };

           fetch("http://localhost:3000/api/pets", {
               method: "POST",
               headers: {
                   "Content-Type": "application/json"
                },
                body: JSON.stringify(petReport)
            })
            .then(async function(response) {
                let result = {};
                const contentType = response.headers.get("content-type") || "";

                if (contentType.includes("application/json")) {
                    try {
                        result = await response.json();
                    } catch (error) {
                        throw new Error(
                            `The backend returned an unreadable response (HTTP ${response.status}).`
                        );
                    }
                } else if (response.ok) {
                    throw new Error(
                        `The backend returned an unexpected response (HTTP ${response.status}).`
                    );
                }

                if (result.duplicate) {
                    reportMessage.textContent =
                        result.message;
                    return;
                }

                if (!response.ok) {
                    const message = result.message ||
                        `The server could not save the report (HTTP ${response.status}).`;
                    const details = result.error ? " " + result.error : "";
                    throw new Error(message + details);
                }

                reportMessage.textContent =
                    "Lost pet report submitted successfully!";

                setTimeout(function() {
                    window.location.href = "recent-pets.html";
                }, 800);
            })
            .catch(function(error) {
                console.error("Error saving pet report:", error);

                reportMessage.textContent = error instanceof TypeError
                    ? "Could not connect to the backend. Check that the server is running and try again."
                    : error.message || "Could not submit the report. Please try again.";
            });
        };

        image.onerror = function() {
            reportMessage.textContent =
                "The selected image could not be loaded. Please choose a valid image and try again.";
        };

        image.src = reader.result;
    };

    reader.onerror = function() {
        reportMessage.textContent =
            "The selected image could not be read. Please choose the image again.";
    };

    reader.readAsDataURL(file);
});