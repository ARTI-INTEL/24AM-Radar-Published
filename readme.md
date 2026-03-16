# 24Air Radar

24Air Radar is a web-based aircraft tracking system that displays live air traffic on an interactive world map.
The system retrieves aircraft position data from the OpenSky Network API and visualizes it using Leaflet.js.

This project was developed as part of the **HT8C 48 Software Development – Graded Unit 2 (GU2)** assessment.

---

# Project Overview

The purpose of the 24Air Radar system is to allow users to monitor aircraft movements across the world using an interactive map interface.

Users can view aircraft positions, inspect flight information, search for airports, and interact with map overlays to better understand air traffic.

The system demonstrates full-stack web development including frontend UI design, backend API integration, and database management.

---

# Features

• Live aircraft tracking using OpenSky API
• Interactive world map using Leaflet.js
• Aircraft position markers with information popups
• Airport search functionality
• Map filters and overlays (such as day/night view)
• User authentication system (login/register)
• User settings page
• Responsive UI for desktop and mobile devices

---

# Technologies Used

## Frontend

HTML
CSS
JavaScript
Leaflet.js


## Backend

Node.js
Express.js
dotenv
mysql2

## Database

MySQL

## APIs

OpenSky Network API
Terminator Daynight Map API
Openweather Weather Map API

---

# System Requirements

To run the system locally you will need:

Node.js (v18 or later recommended)
MySQL Server
A modern web browser (Chrome, Edge, Firefox)

---

# Installation

## 1. Clone the Repository

git clone https://github.com/yourusername/24air-radar.git

Navigate into the project folder:

cd 24air-radar

---

## 2. Install Backend Dependencies

Navigate to the backend folder and install dependencies:

npm install

---

## 3. Configure Environment Variables

Create a file called `.env` inside the backend folder.

Example configuration:

OPENSKY_CLIENT_ID=your_opensky_id
OPENSKY_CLIENT_SECRET=your_opensky_secret

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=24air_radar

---

## 4. Setup the Database

Create the database in MySQL:

CREATE DATABASE 24air_radar;

Import the provided SQL schema file if included in the project.

---

## 5. Start the Backend Server

Run the backend server:

npm start

or

node src/server.js

The backend API will run on:

http://localhost:5000

---

## 6. Launch the Frontend

Open the main HTML file in your browser:

public/index.html

The application interface will load and display the aircraft map.

---

# Project Structure

24Air-Radar
│
├── Backend
│   ├── src
│   │   ├── routes
│   │   ├── controllers
│   │   ├── jobs
│   │   └── server.js
│
├── html
├── css
├── js
├── assets
│
│
└── README.md

---

# API Endpoints

GET /api/aircraft
Returns aircraft positions currently tracked by the system.

GET /api/aircraft/:id
Returns detailed information about a specific aircraft.

POST /api/auth/login
Authenticates a user.

POST /api/auth/register
Creates a new user account.

PATCH /api/user/username
Updates a user's username.

---

# Future Improvements

Possible enhancements to the system include:

• Flight tracking notifications
• Mobile application version
• Historical aircraft playback
• Advanced aircraft filtering
• Weather radar overlay

---

# Author

Muhammad Faiq Imran
Organization: University Of Stirling

---
