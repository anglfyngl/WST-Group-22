const petGrid = document.querySelector(".pet-grid");
const prevButton = document.querySelector(".prev-button");
const nextButton = document.querySelector(".next-button");

const petColors = [
    "buddy-card",
    "ginger-card",
    "alice-card",
    "shy-card"
];

// Count the sample cards already in the HTML
const existingPetCount = petGrid.children.length;

function formatDate(dateString) {
    const date = new Date(dateString + "T00:00:00");

    return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}

// Create a card for each pet report
function createPetCard(pet, index) {
    const card = document.createElement("article");
    card.className = "pet-card";

    card.classList.add(
        petColors[(existingPetCount + index) % petColors.length]
    );

    const photo = document.createElement("img");
    photo.src = pet.image;
    photo.alt = "Photo of " + pet.name;
    card.appendChild(photo);

    const title = document.createElement("h3");
    title.textContent = pet.name;
    card.appendChild(title);

    function addDetail(label, value) {
        const paragraph = document.createElement("p");
        paragraph.textContent = label + ": " + value;
        card.appendChild(paragraph);
    }

    addDetail("Type", pet.type);
    addDetail("Breed", pet.breed);
    addDetail("Age", pet.age + " " + pet.ageUnit);
    addDetail("Gender", pet.gender);
    addDetail("Last seen", pet.location);
    addDetail("Missing Since", formatDate(pet.missingSince));

    const contactParagraph = document.createElement("p");
    const contact = document.createElement("strong");
    contact.textContent = "Call: " + pet.contact;
    contactParagraph.appendChild(contact);
    card.appendChild(contactParagraph);

    petGrid.appendChild(card);
}

// Set up pagination after the cards are loaded
function setupPagination() {
    const petCards = document.querySelectorAll(".pet-grid .pet-card");

    let currentPage = 1;
    const petsPerPage = 4;

    function showPage() {
        const start = (currentPage - 1) * petsPerPage;
        const end = start + petsPerPage;

        petCards.forEach(function(card, index) {
            card.style.display =
                index >= start && index < end ? "" : "none";
        });

        const totalPages = Math.ceil(petCards.length / petsPerPage);

        prevButton.style.display =
            currentPage > 1 ? "block" : "none";

        nextButton.style.display =
            currentPage < totalPages ? "block" : "none";
    }

    nextButton.onclick = function() {
        const totalPages = Math.ceil(petCards.length / petsPerPage);

        if (currentPage < totalPages) {
            currentPage++;
            showPage();
        }
    };

    prevButton.onclick = function() {
        if (currentPage > 1) {
            currentPage--;
            showPage();
        }
    };

    showPage();
}

// Request saved pet reports from the backend
fetch("http://localhost:3000/api/pets")
    .then(function(response) {
        if (!response.ok) {
            throw new Error("Could not load pet reports.");
        }

        return response.json();
    })
    .then(function(pets) {
        pets.forEach(function(pet, index) {
            createPetCard(pet, index);
        });

        setupPagination();
    })
    .catch(function(error) {
        console.error("Error loading pet reports:", error);

        setupPagination();

        const message = document.createElement("p");
        message.textContent =
            "Could not load new pet reports. Please try again later.";

        petGrid.appendChild(message);
    });