# FurFind — Lost Pet Finder

## Project Links

- **GitHub Repository:** [WST-Group-22](https://github.com/anglfyngl/WST-Group-22)
- **Live Website:** [FurFind Website](https://anglfyngl.github.io/WST-Group-22/)

## Project Documents

- **Workflow Worksheet:** [View Workflow Worksheet](https://docs.google.com/spreadsheets/d/1ehxZ_Hk_Yg6CMx9fKeJsHOQdvIn2HprCVwBDlrG7Phg/edit?usp=sharing)
- **AI Use Statement:** [View AI Use Statement](https://docs.google.com/document/d/1WDnkQrSIMfYSjVCsPTMEYGuYvGN_BRGvDPF2elI0JZU/edit?usp=sharing)

## Purpose

FurFind is a website that helps people report and find lost pets. Users can submit lost pet reports, view recent reports, and contact customer support.

## Developers — Group 22

- Angel Faye Nogal
- Ailyn Grana
- Aldrin Cañete
- Genesis Jontilano

## About FurFind

FurFind helps pet owners and the community share information about missing pets.

### Features

- Submit lost pet reports
- View recent lost pet reports
- Upload pet images
- Validate pet information and missing dates
- Submit customer support requests
- Store pet reports and support requests in MongoDB

### Pages

- Home
- Report a Lost Pet
- Recent Lost Pets
- Customer Support

### Design

[View FurFind Canva Design](https://www.canva.com/)

## Backend Setup

### Requirements

- Node.js and npm
- A MongoDB database, such as MongoDB Atlas

### 1. Install Dependencies

Open a terminal in the project folder and run:

```bash
npm install
```

### 2. Configure MongoDB

Create a `.env` file in the project root and add your MongoDB connection string:

```env
MONGODB_URI=your_mongodb_connection_string
```

Replace the placeholder with your actual MongoDB connection string. Keep your database credentials private and do not commit your `.env` file.

### 3. Start the Backend

Run this command in the project root:

```bash
npm start
```

The backend runs at `http://localhost:3000`.

Keep the terminal open. Check for database connection errors before testing.

### 4. Start the Frontend

Open a second terminal in the project root and run:

```bash
npx http-server . -p 8080
```

Open the website in your browser:

`http://127.0.0.1:8080/frontend/index.html`

Keep both terminals running while testing.

## API Endpoints

### Pet Reports

- `GET /api/pets` — Retrieves pet reports.
- `POST /api/pets` — Submits a lost pet report.

### Customer Support

- `POST /api/support` — Submits a customer support request.

The backend validates submitted information and checks for duplicate pet reports and support requests within 10 minutes.

### Validation Rules

- Required fields must be completed.
- Email addresses must be valid.
- Support subjects cannot exceed 100 characters or contain `<` or `>`.
- Support categories must be one of the four supported categories.
- Support messages must contain 10–1,000 characters.
- Missing pet dates must be valid dates before today. Today and future dates are not allowed.
- Duplicate submissions are checked by the backend.

## Testing

### 1. Run Automated Tests

Open a terminal in the project root and run:

```bash
npm test
```

The tests check API validation, pet reports, customer support requests, duplicate detection, and error handling.

**Important:** Automated tests use in-memory test models. They test API behavior but do not confirm that data is saved to a live MongoDB database.

### 2. Test the Website Manually

1. Start the backend and frontend.
2. Open the website in your browser.
3. Submit a valid lost pet report.
4. Check whether the report appears on the Recent Lost Pets page.
5. Try submitting incomplete information.
6. Try selecting today's date or a future date for a missing pet.
7. Submit a valid customer support request.
8. Try invalid email details and incomplete fields.
9. Submit the same report or support request again within 10 minutes to test duplicate detection.

### 3. Verify MongoDB

To confirm that data is actually saved:

1. Open your MongoDB Atlas dashboard.
2. Select the database configured in your `.env` file.
3. Submit a test pet report or support request through the website.
4. Open the corresponding collection and look for the new document.
5. Restart the backend and check whether the saved data is still available.

A success message alone does not prove that the database saved the data. Check MongoDB directly.

## Testing Limitations

- Automated tests use in-memory models and do not independently verify live database storage.
- Manual testing checks whether the frontend and backend work together.
- Checking MongoDB directly verifies actual database persistence.
- Live database testing requires a valid connection string, database permissions, and network access.

Passing automated tests does not guarantee that the live MongoDB connection is configured correctly.