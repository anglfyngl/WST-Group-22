const petGrid = document.querySelector(".pet-grid");
const prevButton = document.querySelector(".prev-button");
const nextButton = document.querySelector(".next-button");

const savedPets =
    JSON.parse(localStorage.getItem("furfindPets")) || [];

const petColors = [
    "buddy-card",
    "ginger-card",
    "alice-card",
    "shy-card"
];

const existingPetCount = petGrid.children.length;

function formatDate(dateString) {
    const date = new Date(dateString + "T00:00:00");

    return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}

savedPets.forEach(function(pet, index) {

    const petCard = document.createElement("article");

    petCard.className = "pet-card";

    const colorClass =
        petColors[(existingPetCount + index) % petColors.length];

    petCard.classList.add(colorClass);

    petCard.innerHTML = `
        <img src="${pet.image}" alt="${pet.name}">
        <h3>${pet.name}</h3>
        <p>Type: ${pet.type}</p>
        <p>Breed: ${pet.breed}</p>
        <p>Age: ${pet.age} ${pet.ageUnit}</p>
        <p>Gender: ${pet.gender}</p>
        <p>Last seen: ${pet.location}</p>
        <p>Missing Since: ${formatDate(pet.missingSince)}</p>
        <p><strong>Call: ${pet.contact}</strong></p>
    `;

    petGrid.appendChild(petCard);
});

const petCards = document.querySelectorAll(".pet-card");

let currentPage = 1;
const petsPerPage = 4;

function showPage() {

    const start = (currentPage - 1) * petsPerPage;
    const end = start + petsPerPage;

    petCards.forEach(function(card, index) {

        if (index >= start && index < end) {
            card.style.display = "";
        } else {
            card.style.display = "none";
        }

    });

    const totalPages = Math.ceil(petCards.length / petsPerPage);

    prevButton.style.display =
        currentPage > 1 ? "block" : "none";

    nextButton.style.display =
        currentPage < totalPages ? "block" : "none";
}

nextButton.addEventListener("click", function() {

    currentPage++;
    showPage();

});

prevButton.addEventListener("click", function() {

    currentPage--;
    showPage();

});

showPage();