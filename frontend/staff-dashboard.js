const apiBaseUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
const dashboardMessage = document.getElementById("dashboard-message");
const petReportsContainer = document.getElementById("staff-pet-reports");
const supportRequestsContainer = document.getElementById("staff-support-requests");
const logoutButton = document.getElementById("staff-logout");
const deletePetModal = document.getElementById("delete-pet-modal");
const deletePetModalClose = document.getElementById("delete-pet-modal-close");
const deletePetModalCancel = document.getElementById("delete-pet-modal-cancel");
const deletePetModalConfirm = document.getElementById("delete-pet-modal-confirm");
const deletePetModalName = document.getElementById("delete-pet-modal-pet-name");
const deletePetModalError = document.getElementById("delete-pet-modal-error");
const allowedPetFields = [
    ["name", "Name"],
    ["type", "Type"],
    ["breed", "Breed"],
    ["age", "Age"],
    ["ageUnit", "Age unit"],
    ["gender", "Gender"],
    ["location", "Location"],
    ["contact", "Contact"],
    ["missingSince", "Missing since"]
];

function showMessage(message, isError = false) {
    dashboardMessage.textContent = message;
    dashboardMessage.classList.toggle("status-error", isError);
}

function getTodayLocalDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function createText(tagName, text, className) {
    const element = document.createElement(tagName);
    element.textContent = text;
    if (className) {
        element.className = className;
    }
    return element;
}

function addField(form, labelText, value, name, multiline = false) {
    const label = document.createElement("label");
    label.textContent = labelText;

    const control = multiline
        ? document.createElement("textarea")
        : document.createElement("input");
    control.name = name;
    control.value = value === undefined || value === null ? "" : String(value);
    if (!multiline) {
        control.type = name === "missingSince" ? "date" : "text";
        if (name === "missingSince") {
            control.max = getTodayLocalDate();
        }
    }
    label.append(control);
    form.append(label);
    return control;
}

async function request(path, options = {}) {
    const response = await fetch(`${apiBaseUrl}${path}`, {
        credentials: "include",
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            "X-Client-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
            ...(options.headers || {})
        }
    });

    let result = {};
    if (response.status !== 204) {
        result = await response.json();
    }
    if (!response.ok) {
        const error = new Error(result.message || "The request could not be completed.");
        error.status = response.status;
        throw error;
    }
    return result;
}

let pendingPetDelete = null;
let deleteRequestInProgress = false;

function closeDeletePetModal() {
    if (deleteRequestInProgress || deletePetModal.hidden) {
        return;
    }
    deletePetModal.hidden = true;
    pendingPetDelete = null;
    deletePetModalError.textContent = "";
    deletePetModalError.classList.remove("status-error");
    deletePetModalConfirm.disabled = false;
    deletePetModalCancel.disabled = false;
    deletePetModalClose.disabled = false;
    if (deletePetModal.returnFocus?.isConnected) {
        deletePetModal.returnFocus.focus();
    }
}

function openDeletePetModal(pet, card, recordMessage, deleteButton) {
    pendingPetDelete = { pet, card, recordMessage, deleteButton };
    deletePetModal.returnFocus = deleteButton;
    deletePetModalName.textContent = pet.name || "Unnamed lost pet report";
    deletePetModalError.textContent = "";
    deletePetModalError.classList.remove("status-error");
    deletePetModalConfirm.disabled = false;
    deletePetModalCancel.disabled = false;
    deletePetModalClose.disabled = false;
    deletePetModal.hidden = false;
    deletePetModalCancel.focus();
}

deletePetModalClose.addEventListener("click", closeDeletePetModal);
deletePetModalCancel.addEventListener("click", closeDeletePetModal);
deletePetModal.addEventListener("click", (event) => {
    if (event.target === deletePetModal) {
        closeDeletePetModal();
    }
});
document.addEventListener("keydown", (event) => {
    if (deletePetModal.hidden) {
        return;
    }
    if (event.key === "Escape") {
        event.preventDefault();
        closeDeletePetModal();
        return;
    }
    if (event.key === "Tab") {
        const focusable = [
            deletePetModalClose,
            deletePetModalCancel,
            deletePetModalConfirm
        ].filter((element) => !element.disabled);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }
});
deletePetModalConfirm.addEventListener("click", async () => {
    if (!pendingPetDelete || deleteRequestInProgress) {
        return;
    }

    deleteRequestInProgress = true;
    const { pet, card, recordMessage } = pendingPetDelete;
    deletePetModalConfirm.disabled = true;
    deletePetModalCancel.disabled = true;
    deletePetModalClose.disabled = true;
    deletePetModalError.textContent = "";
    deletePetModalError.classList.remove("status-error");

    try {
        const result = await request(`/api/staff/pets/${encodeURIComponent(pet._id)}`, {
            method: "DELETE"
        });
        if (result.message !== "Pet report deleted.") {
            throw new Error("The server did not confirm report deletion.");
        }
        card.remove();
        deletePetModal.hidden = true;
        pendingPetDelete = null;
        document.getElementById("pet-reports-title").focus();
        showMessage("Pet report deleted.");
    } catch (error) {
        deletePetModalError.textContent = error.message;
        deletePetModalError.classList.add("status-error");
        recordMessage.textContent = error.message;
        recordMessage.classList.add("status-error");
        deletePetModalConfirm.disabled = false;
        deletePetModalCancel.disabled = false;
        deletePetModalClose.disabled = false;
    } finally {
        deleteRequestInProgress = false;
    }
});

function createPetCard(pet) {
    const card = document.createElement("article");
    card.className = "staff-record-card";
    card.append(createText("h3", pet.name || "Lost pet report"));

    const form = document.createElement("form");
    form.className = "staff-edit-form";
    const controls = {};

    for (const [field, label] of allowedPetFields) {
        controls[field] = addField(form, label, pet[field], field);
    }

    const actions = document.createElement("div");
    actions.className = "staff-record-actions";
    const recordMessage = createText("p", "", "staff-record-status");
    recordMessage.setAttribute("role", "status");
    recordMessage.setAttribute("aria-live", "polite");
    const saveButton = createText("button", "Save report changes");
    saveButton.type = "submit";
    saveButton.className = "staff-save-button";
    actions.append(recordMessage);
    actions.append(saveButton);
    let savedValues = Object.fromEntries(
        Object.entries(controls).map(([field, control]) => [field, control.value])
    );
    let hasSavedChanges = false;
    const updateEditStatus = () => {
        const currentValues = Object.fromEntries(
            Object.entries(controls).map(([field, control]) => [field, control.value])
        );
        const matchesSavedValues =
            JSON.stringify(currentValues) === JSON.stringify(savedValues);
        recordMessage.textContent = matchesSavedValues
            ? (hasSavedChanges ? "Changes saved" : "")
            : "Unsaved changes";
        recordMessage.classList.remove("status-error");
    };
    for (const control of Object.values(controls)) {
        control.addEventListener("input", updateEditStatus);
        control.addEventListener("change", updateEditStatus);
    }
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (saveButton.disabled) {
            return;
        }
        recordMessage.textContent = "Saving…";
        recordMessage.classList.remove("status-error");
        const updates = Object.fromEntries(
            Object.entries(controls).map(([field, control]) => [field, control.value])
        );
        const submittedValues = { ...updates };
        updates.age = updates.age.trim() === "" ? "" : Number(updates.age);

        saveButton.disabled = true;
        for (const control of Object.values(controls)) {
            control.disabled = true;
        }
        try {
            const result = await request(`/api/staff/pets/${encodeURIComponent(pet._id)}`, {
                method: "PATCH",
                body: JSON.stringify(updates)
            });
            if (
                result.message !== "Pet report updated." ||
                !result.pet ||
                String(result.pet._id) !== String(pet._id)
            ) {
                throw new Error("The server did not confirm the report update.");
            }
            savedValues = submittedValues;
            hasSavedChanges = true;
            updateEditStatus();
        } catch (error) {
            recordMessage.textContent = error.message;
            recordMessage.classList.add("status-error");
        } finally {
            saveButton.disabled = false;
            for (const control of Object.values(controls)) {
                control.disabled = false;
            }
        }
    });

    const deleteButton = createText("button", "Delete report", "staff-delete-button");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", async () => {
        openDeletePetModal(pet, card, recordMessage, deleteButton);
    });
    actions.append(deleteButton);
    form.append(actions);
    card.append(form);
    return card;
}

function createSupportCard(supportRequest) {
    const card = document.createElement("article");
    card.className = "staff-record-card";
    card.append(createText("h3", supportRequest.subject || "Support request"));
    const details = document.createElement("div");
    details.className = "staff-request-details";
    for (const [label, value] of [
        ["From:", supportRequest.email],
        ["Category:", supportRequest.category]
    ]) {
        const detail = document.createElement("p");
        const detailLabel = createText("strong", label);
        detail.append(detailLabel, createText("span", ` ${value}`));
        details.append(detail);
    }
    details.append(createText("p", "Messages", "staff-request-message-label"));
    details.append(createText("p", supportRequest.message, "staff-request-message"));

    const form = document.createElement("form");
    form.className = "staff-edit-form staff-support-form";
    const statusLabel = document.createElement("label");
    statusLabel.textContent = "Status";
    const status = document.createElement("select");
    status.name = "status";

    for (const [value, label] of [
        ["open", "Open"],
        ["in_progress", "In progress"],
        ["resolved", "Resolved"]
    ]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = (supportRequest.status || "open") === value;
        status.append(option);
    }
    statusLabel.append(status);
    form.append(statusLabel);

    const staffResponse = addField(
        form,
        "Staff response (saved only; not emailed)",
        supportRequest.staffResponse,
        "staffResponse",
        true
    );
    const saveButton = createText("button", "Save support update");
    saveButton.type = "submit";
    const recordMessage = createText("p", "", "staff-record-message");
    recordMessage.setAttribute("role", "status");
    recordMessage.setAttribute("aria-live", "polite");
    form.append(saveButton);
    form.append(recordMessage);
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        recordMessage.textContent = "";
        recordMessage.classList.remove("status-error");
        try {
            await request(
                `/api/staff/support-requests/${encodeURIComponent(supportRequest._id)}`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        status: status.value,
                        staffResponse: staffResponse.value
                    })
                }
            );
            if (status.value === "resolved") {
                card.remove();
                showMessage("Support request marked resolved and removed from the active list.");
                return;
            }
            recordMessage.textContent = "Changes saved. The response has not been emailed.";
        } catch (error) {
            recordMessage.textContent = error.message;
            recordMessage.classList.add("status-error");
        }
    });

    card.append(details, form);
    return card;
}

async function loadDashboard() {
    try {
        await request("/api/staff/session");
    } catch (error) {
        if (error.status === 401) {
            window.location.replace("admin-login.html");
            return;
        }
        showMessage(error.message, true);
        return;
    }

    try {
        const [petResult, supportResult] = await Promise.all([
            request("/api/staff/pets"),
            request("/api/staff/support-requests")
        ]);

        petReportsContainer.replaceChildren(
            ...(petResult.pets.length
                ? petResult.pets.map(createPetCard)
                : [createText("p", "No lost pet reports yet.")])
        );
        supportRequestsContainer.replaceChildren(
            ...(supportResult.requests.filter((request) => request.status !== "resolved").length
                ? supportResult.requests
                    .filter((request) => request.status !== "resolved")
                    .map(createSupportCard)
                : [createText("p", "No customer support requests yet.")])
        );
        showMessage("Staff portal loaded.");
    } catch (error) {
        if (error.status === 401) {
            window.location.replace("admin-login.html");
            return;
        }
        showMessage(error.message, true);
    }
}

logoutButton.addEventListener("click", async () => {
    try {
        await request("/api/staff/logout", { method: "POST" });
        window.location.replace("admin-login.html");
    } catch (error) {
        showMessage(error.message, true);
    }
});

loadDashboard();
