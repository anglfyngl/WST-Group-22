const resourceButtons = document.querySelectorAll(".resource-arrow");

resourceButtons.forEach(function (button) {
    button.onclick = function () {
        const detailsId = button.getAttribute("aria-controls");
        const details = document.getElementById(detailsId);
        const isOpen = button.getAttribute("aria-expanded") === "true";
        const resourceName = details.querySelector("h3").textContent;

        details.hidden = isOpen;
        button.setAttribute("aria-expanded", String(!isOpen));
        button.textContent = isOpen ? "➤" : "▼";

        button.setAttribute(
            "aria-label",
            (isOpen ? "Show" : "Hide") + " details for " + resourceName
        );
    };
});