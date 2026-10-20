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

The Customer Support form sends requests to a small **Express.js** server instead of only staying in the browser.

**Run it:**
```bash
cd server
npm install
npm start          # open http://localhost:3000/support.html
```

**API:** `POST /api/support` with `subject`, `email`, `category` and `message` (JSON).

- **Validation (server side):** all fields must be text; subject is required (max 100 characters, no `<` or `>`); the email must be valid; the category must be one of the four options; the message must be 10–1000 characters.
- **Repeated submissions:** the same request sent again within 10 minutes (for example a double-click) is not saved twice.
- **Error handling:** invalid or broken requests, requests that are too large and unknown API routes all get a clear JSON error message; the page shows it in red, and success in green.
- **Storage:** requests are saved in `server/support-requests.json` (not uploaded to GitHub). The file is written safely, and a damaged file is backed up instead of crashing the server.

**Tests:** `cd server && npm test` (valid and invalid input, repeated submissions, server restart, damaged data file).

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