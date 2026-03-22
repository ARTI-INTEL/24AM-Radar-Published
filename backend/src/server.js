// File: server.js
// Project: 24Air Radar
// Author: Muhammad Faiq Imran
// Last Modified: 15/03/2026

// Description:
//  This file sets up the Express server for the 24Air Radar application. 
//  It configures middleware for security (Helmet), CORS, and JSON parsing. 
//  It defines routes for authentication, user management, airports, and aircraft data. 
//  The server also serves static files from the public directory and includes a health check endpoint. 
// 
// Dependencies:
//  - mysql2
//  - dotenv
//  - express
//  - cors
//  - helmet
//  - Path
//  - Other backend Files(Routes, middleware, jobs and Database)

import express from "express";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";
import { authRouter } from "./routes/auth.routes.js";
import { pool } from "./db.js";
import { userRouter } from "./routes/user.routes.js";
import { AirportsRouter } from "./routes/airports.routes.js";
import { AircraftRouter } from "./routes/aircraft.routes.js";
import path from "path";
import { fileURLToPath } from "url";
import { startAircraftPoller } from "./jobs/aircraftPoller.js";

startAircraftPoller();

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "https://unpkg.com"],
        "style-src": ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        "img-src": ["'self'", "data:", "blob:", "https://*.tile.openstreetmap.org", "https://*.basemaps.cartocdn.com", "https://tile.openweathermap.org"],
        "connect-src": ["'self'", "https://tile.openweathermap.org", "https://*.basemaps.cartocdn.com", "https://*.tile.openstreetmap.org"],
        "worker-src": ["'self'", "blob:"],
      },
    },
  })
);
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve entire public folder
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/html/index.html"));
});

app.use(
  cors()
);

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "connected" });
  } catch (e) {
    res.status(500).json({ ok: false, db: "error", error: String(e.message || e) });
  }
});

app.use("/api/auth", authRouter);

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`Running on ${port}`));

app.use("/api/user", userRouter);

app.use("/api/Airports", AirportsRouter);

app.use("/api/Aircraft", AircraftRouter);

// ======================================================
// AirCRAFT CLEANUP JOB
// Deletes Aircraft not updated in last 5 minutes
// Runs every 15 minutes
// ======================================================

setInterval(async () => {
  try {
    const [result] = await pool.query(
      `DELETE FROM Aircraft_latest
       WHERE updated_at < (NOW() - INTERVAL 5 MINUTE)`
    );

    console.log(`Aircraft cleanup: removed ${result.affectedRows} old Aircraft  at ${new Date().getHours()}:${new Date().getMinutes()}:${new Date().getSeconds()} - ${new Date().getDate()}/${new Date().getMonth() + 1}/${new Date().getFullYear()}`);
  } catch (err) {
    console.error("Aircraft cleanup failed:", err.message);
  }
}, 15 * 60 * 1000);

app.get("/net-test", async (req, res) => {
  try {
    const r = await fetch("https://example.com");
    res.json({ status: r.status });
  } catch (e) {
    res.json({
      error: e.message,
      cause: e.cause?.message
    });
  }
});

// Past positions cleanup (older than 24h)
setInterval(async () => {
  try {
    await pool.query(`
      DELETE FROM aircraft_positions
      WHERE time < (NOW() - INTERVAL 12 HOUR)
    `);
    console.log(`Past positions cleanup completed at ${new Date().getHours()}:${new Date().getMinutes()}:${new Date().getSeconds()} - ${new Date().getDate()}/${new Date().getMonth() + 1}/${new Date().getFullYear()}`);
  } catch (err) {
    console.error("Past positions cleanup failed:", err.message);
  }
}, 15 * 60 * 1000);