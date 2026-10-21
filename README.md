# FurFind

Helping lost animals find their way home.

## About

FurFind is a browser-based application that helps people report and find lost pets. Users can submit lost pet information, view recent lost pet reports, find animal resources, and contact FurFind Customer Support for help with their reports.

## Features

- Report a lost pet
- Validate pet report information
- View recent lost pets
- View uploaded pet photos and report details
- Navigate through multiple lost pet reports
- Find shelters, rescuers, and veterinary clinics
- Contact FurFind Customer Support
- Responsive layout for different screen sizes

## Pages

- Home
- Report Lost Pet
- Recent Lost Pets
- Resources
- About
- Customer Support

## Design Reference

The Canva design serves as a reference for the website's layout, content, colors, typography, and overall appearance.

[View Canva Design](https://canva.link/s1aeiq7bu58b1f8)

## Customer Support Backend (Milestone 2)

The Customer Support form sends requests to the same **Express.js** server that handles MongoDB pet reports.

**Run it:**
```bash
npm install
npm start           # start the backend on http://localhost:3000
```

**API:** `POST /api/support` with `subject`, `email`, `category` and `message` (JSON).

- **Validation (server side):** all fields must be text; subject is required (max 100 characters, no `<` or `>`); the email must be valid; the category must be one of the four options; the message must be 10–1000 characters.
- **Repeated submissions:** the same request sent again within 10 minutes (for example a double-click) is not saved twice.
- **Lost pet reports:** matching name, type, breed, age/unit, gender, location, contact number and missing date are not saved twice within 10 minutes; a report with differing details can still be submitted.
- **Error handling:** invalid or broken requests, requests that are too large and unknown API routes all get a clear JSON error message; the page shows it in red, and success in green.
- **Storage:** support requests are saved in MongoDB through `server/models/SupportRequest.js`.

**Tests:** `npm test` (validation, repeated submissions, request parsing and API errors).

## Project Links

- **GitHub Repository:** https://github.com/anglfyngl/WST-Group-22
- **Live Website:** https://anglfyngl.github.io/WST-Group-22/

## Project Documents

- **Workflow Worksheet:** [View Workflow Worksheet](https://docs.google.com/spreadsheets/d/1ehxZ_Hk_Yg6CMx9fKeJsHOQdvIn2HprCVwBDlrG7Phg/edit?usp=sharing)
- **AI Use Statement:** [View AI Use Statement](https://docs.google.com/document/d/1WDnkQrSIMfYSjVCsPTMEYGuYvGN_BRGvDPF2elI0JZU/edit?usp=sharing)

## Purpose

FurFind was created to help make finding lost pets easier, faster, and more organized by providing a simple way to report and view lost pet information.

## Developers

**Group 22**

- Angel Faye Nogal
- Ailyn Grana
- Aldrin Cañete
- Genesis Jontilano