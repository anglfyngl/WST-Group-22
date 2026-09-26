const reportForm = document.querySelector(".report-form");
const petPhoto = document.querySelector("#pet-photo");

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
                missingSince: document.querySelector("#missing-since").value,
                image: compressedImage
            };

            const savedPets =
                JSON.parse(localStorage.getItem("furfindPets")) || [];

            savedPets.push(petReport);

            localStorage.setItem(
                "furfindPets",
                JSON.stringify(savedPets)
            );

            document.querySelector("#report-message").textContent =
                "Lost pet report submitted successfully!";

            setTimeout(function() {
                window.location.href = "recent-pets.html";
            }, 800);
        };

        image.src = reader.result;
    };

    reader.readAsDataURL(file);
});