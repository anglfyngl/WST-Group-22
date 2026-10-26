# FurFind — Lost Pet Finder

## Project Links

- **GitHub Repository:** [WST-Group-22](https://github.com/anglfyngl/WST-Group-22)
- **Live Website:** [FurFind Website](https://anglfyngl.github.io/WST-Group-22/)

## Project Documents

- **Workflow Worksheet:** [View Workflow Worksheet](https://docs.google.com/spreadsheets/d/1ehxZ_Hk_Yg6CMx9fKeJsHOQdvIn2HprCVwBDlrG7Phg/edit?usp=sharing)
- **AI Use Statement:** [View AI Use Statement](https://docs.google.com/document/d/1WDnkQrSIMfYSjVCsPTMEYGuYvGN_BRGvDPF2elI0JZU/edit?usp=sharing)

## Purpose

FurFind is a lost pet finder website that helps pet owners and community members report missing pets, view recent reports, and contact customer support. It also provides an authenticated staff portal for managing pet reports and customer support requests.

## Developers — Group 22

- Angel Faye Nogal
- Ailyn Grana
- Aldrin Cañete
- Genesis Jontilano

## About FurFind

### Public Features

- Submit lost pet reports.
- View recent lost pet reports.
- Upload pet images.
- Validate pet information and missing dates.
- Submit customer support requests.
- Validate required fields and email addresses.
- Check duplicate submissions.
- Store pet reports and support requests in MongoDB.

### Staff Portal Features

- Staff login using approved staff accounts.
- Server-side sessions with HTTP-only cookies.
- Authentication checks for staff-only features.
- View and update pet reports.
- Delete pet reports.
- View customer support requests.
- Update support request status.
- Write and save staff responses.
- Display save feedback when staff updates are submitted.
- Remove resolved requests from the active support list while retaining their database records.
- Log out and end the staff session.

**Important:** Staff responses are saved in the database only. They are not emailed to customers.

### Pages

- Home
- Report a Lost Pet
- Recent Lost Pets
- Customer Support
- Staff Login
- Staff Dashboard

### Design

[View FurFind Canva Design](https://www.canva.com/)

---

## Requirements

Before running the project locally, install:

- [Node.js and npm](https://nodejs.org/)
- A MongoDB database, such as MongoDB Atlas
- A modern web browser
- A terminal or command prompt

## Local Setup and Testing

### 1. Open the Project Folder

Open the FurFind project folder in VS Code.

Open a terminal and make sure the current directory is the project root, where `package.json` and `index.js` are located.

### 2. Install Dependencies

Run:

```bash
npm install
```

Wait for the installation to finish.

### 3. Configure MongoDB

Create a `.env` file in the project root if it does not already exist.

Add your MongoDB connection string:

```env
MONGODB_URI=your_mongodb_connection_string
```

Replace the placeholder with your actual MongoDB connection string.

Make sure your MongoDB Atlas database user has the required permissions and that your IP address is allowed by the Atlas network access settings.

**Security reminders:**

- Never publish your `.env` file.
- Never put your MongoDB connection string or database password in frontend JavaScript.
- Do not commit secrets to GitHub.

### 4. Start the Backend

In the project root, run:

```bash
npm start
```

The backend should connect to MongoDB and run at:

`http://localhost:3000`

Check the terminal for successful database connection and server startup messages. Leave this terminal running.

If the server reports a database or session-store error, resolve it before continuing.

### 5. Find the Staff Demo Credentials

The approved staff accounts are:

- `staff1@furfind.com`
- `staff2@furfind.com`
- `staff3@furfind.com`
- `staff4@furfind.com`
- `staff5@furfind.com`

The local demo credentials are stored in:

**`.staff-credentials.md`**

To find the file:

1. Open the FurFind project folder in VS Code.
2. In the Explorer panel, look at the project root, at the same level as `package.json` and `index.js`.
3. Open `.staff-credentials.md` to view the demo email and password pairs.

If the file is hidden in the Explorer, check your VS Code file-exclusion settings or open it using the VS Code terminal:

```powershell
Get-Content .staff-credentials.md
```

If the file does not exist, check the staff-seeding instructions below.

**Security:** `.staff-credentials.md` is intended for local use and should remain excluded from Git. Do not commit it, upload it publicly, or share its contents in screenshots or public documentation. The demo passwords should not be reused in a production deployment.

### 6. Seed the Approved Staff Accounts

Make sure MongoDB is reachable and `.env` contains the correct `MONGODB_URI`.

Run this command from the project root:

```bash
npm run seed-staff -- --credentials-file .staff-credentials.md
```

The seeder is intended to create the five approved staff accounts and hash passwords before storing them in MongoDB.

Existing accounts are not automatically overwritten. If an account already exists with a different password, follow the seeder's output and resolve the mismatch using the project's account-management procedure.

If all five accounts already exist and can log in, you generally do not need to seed them again.

### 7. Start the Frontend

Open a **second terminal** in the project root and run:

```bash
npx http-server . -p 8080
```

If prompted to install `http-server`, follow the terminal prompt.

Keep both the backend and frontend terminals running while testing.

### 8. Open the Website

Open the local website:

`http://127.0.0.1:8080/frontend/index.html`

Open the staff login page:

`http://127.0.0.1:8080/frontend/admin-login.html`

Enter one of the approved staff email and password pairs from `.staff-credentials.md`.

After successful login, the application should redirect to:

`http://127.0.0.1:8080/frontend/staff-dashboard.html`

The dashboard should require a valid staff session. Test logout to confirm the session ends and staff-only access is no longer available.

**Note:** GitHub Pages serves static frontend files and does not run this Node.js backend. Local staff login and database-backed staff management should be tested using the local frontend and backend setup above unless the backend has been separately deployed and configured.

---

## Manual Testing Guide

### 1. Test Staff Login

1. Start MongoDB access, the backend, and the frontend.
2. Open the staff login page.
3. Log in using a valid staff email and password.
4. Confirm that successful login redirects to the dashboard.
5. Try an incorrect password.
6. Try an unapproved email address.
7. Confirm unsuccessful logins do not open the dashboard.
8. Log out and verify that the dashboard requires login again.

### 2. Test Pet Reports

1. Open the public website.
2. Submit a valid lost pet report with the required details.
3. Confirm that the report appears on the recent lost pets page.
4. Try submitting a report with missing required fields.
5. Test an invalid email address if the form requests one.
6. Test today's date and a past missing date.
7. Test a future missing date and confirm it is rejected.
8. Try submitting duplicate information within the duplicate-check period.
9. Log in to the staff portal and check that the report appears in staff management.
10. Update a report, save the changes, and refresh the dashboard to verify persistence.
11. If appropriate for your demo data, test deleting a report.

### 3. Test Customer Support

1. Open the public Customer Support page.
2. Submit a valid support request.
3. Confirm that the form accepts valid information.
4. Test missing fields, invalid email addresses, an invalid category, and a message outside the allowed length.
5. Check the staff dashboard for the new support request.
6. Confirm that **Messages** appears above the submitted message.
7. Check that the complete submitted message is displayed.
8. Confirm the status and staff response controls are grouped at the bottom of each support card.
9. Change the status or enter a staff response.
10. Click **Save support update**.
11. Confirm that the save feedback indicates the update succeeded.
12. Refresh the dashboard and confirm the saved values remain.
13. Mark a request as resolved and verify that it disappears from the active list.
14. Check MongoDB to confirm that resolving a request does not delete its stored record.

**Reminder:** Staff responses are saved only. The application does not email the response to the customer.

### 4. Test Access Restrictions

1. Log out of the staff portal.
2. Try opening the staff dashboard directly.
3. Confirm that an unauthenticated visitor is redirected to login or denied access.
4. Confirm that staff-only API requests cannot retrieve or modify protected records without a valid session.
5. Log in again and verify that authorized staff actions work.

---

## Automated Tests

Run the project's automated test suite from the root folder:

```bash
npm test
```

The current reported test result during development was **39 tests passed**. Run the command again on your current project version to verify the latest result.

The tests cover application behavior such as API validation, authentication and session handling, protected staff operations, pet reports, customer support requests, duplicate detection, and error handling.

Automated tests may use mock or in-memory models. Passing tests does not, by itself, prove that real MongoDB records are being saved correctly.

---

## Verify Data in MongoDB Atlas

To confirm that FurFind stores data in the configured database:

1. Sign in to MongoDB Atlas.
2. Open the Atlas project containing your FurFind database.
3. Open the database configured by `MONGODB_URI`.
4. Locate the collections used for pet reports, support requests, and staff accounts. The collection names may differ from the model names.
5. Submit a new pet report through the website.
6. Refresh the corresponding collection and confirm the new document appears.
7. Submit a customer support request and check its collection.
8. Update a pet report or support request through the staff portal.
9. Refresh the relevant collection and verify the changed values.
10. Restart the backend and check that the data remains available.

A successful form submission or dashboard message is not enough to prove database persistence. Verify the stored documents directly when possible.

**Do not share database credentials or grant unrestricted database access merely to demonstrate the application.** If a reviewer needs direct access, arrange appropriately limited permissions.

---

## API Endpoints

### Public Pet Reports

- `GET /api/pets` — Retrieves public pet reports.
- `POST /api/pets` — Submits a lost pet report.

### Public Customer Support

- `POST /api/support` — Submits a customer support request.

### Staff Authentication

- `POST /api/staff/login` — Verifies staff credentials and creates a session.
- `GET /api/staff/session` — Checks the current staff session.
- `POST /api/staff/logout` — Ends the current staff session.

### Staff Management

These endpoints require staff authentication.

- `GET /api/staff/pets` — Retrieves pet reports for staff management.
- `PATCH /api/staff/pets/:id` — Updates a pet report.
- `DELETE /api/staff/pets/:id` — Deletes a pet report.
- `GET /api/staff/support-requests` — Retrieves active support requests.
- `PATCH /api/staff/support-requests/:id` — Updates a support request, including its status and staff response.

---

## Validation Rules

The backend validates submitted data. The current expected rules include:

- Required fields must be completed.
- Email addresses must be valid.
- Support subjects cannot exceed 100 characters or contain `<` or `>`.
- Support categories must match one of the supported categories.
- Support messages must contain 10–1,000 characters.
- Missing pet dates must be valid calendar dates no later than today.
- Future missing dates are rejected.
- Duplicate submissions are checked by the backend.

---

## Session and Deployment Configuration

For local development, the application may generate a temporary session secret if one is not configured.

For a production deployment:

- Configure a strong, randomly generated `STAFF_SESSION_SECRET`.
- Set `FRONTEND_ORIGIN` to the exact trusted frontend origin.
- Use HTTPS so session cookies can be marked secure.
- Keep the MongoDB connection string and session secret in the hosting provider's environment settings, not in public source files.
- Configure MongoDB Atlas network access and database permissions appropriately.
- Use strong, unique staff passwords instead of demo passwords.
- Never expose staff credentials or database secrets in frontend files.
- Verify the deployed frontend and backend origins are configured to work together with session cookies.

A production deployment needs a separately hosted Node.js backend. GitHub Pages alone cannot run the backend or connect directly to MongoDB using private credentials.

---

## Troubleshooting

### Backend Does Not Start

- Confirm that Node.js and npm are installed.
- Run `npm install`.
- Check that `.env` exists in the project root and contains the correct `MONGODB_URI`.
- Check the terminal for MongoDB connection or session-store errors.
- Make sure the configured database is reachable.

### Staff Login Does Not Work

- Confirm the backend is running.
- Check that the frontend is calling the correct backend address.
- Confirm the email belongs to one of the approved staff accounts.
- Verify that the password matches the account stored in MongoDB.
- If an account already existed with a different password, remember that seeding does not automatically overwrite it.
- Check the browser console and backend terminal for errors.
- Refresh the page if the browser may be using cached frontend assets.

### Dashboard Does Not Load or Save

- Confirm that you are logged in.
- Check whether the session has expired.
- Confirm that the backend is running and MongoDB is connected.
- Check the browser console and backend terminal for API errors.
- Verify that staff-only requests include the session cookie.

### Data Does Not Appear in MongoDB

- Verify that the application is connected to the intended database.
- Check the collection corresponding to the relevant model.
- Check backend errors after submitting or saving data.
- Confirm that the database user has appropriate permissions.
- Do not assume that passing automated tests proves live database persistence.

---

## Testing Limitations

- Automated tests may use mock or in-memory models rather than a live MongoDB database.
- Browser tests using fixture data do not confirm that real database records are saved.
- Manual testing checks whether the frontend and backend work together.
- Inspecting MongoDB confirms actual database persistence.
- Live testing requires a working database connection, appropriate permissions, and correct network access.
- Staff responses are stored in the database but are not emailed to customers.

**For a complete demonstration, run the backend and frontend, test the public features, log in to the staff portal