import express from "express";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";
import { authRouter } from "./routes/auth.routes.js";
import { pool } from "./db.js";
import { userRouter } from "./routes/user.routes.js";
import { airportsRouter } from "./routes/airports.routes.js";
import { aircraftRouter } from "./routes/aircraft.routes.js";
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
  cors({
    origin: process.env.CORS_ORIGIN?.split(",").map(s => s.trim()) ?? "*",
    credentials: false
  })
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

app.use("/api/airports", airportsRouter);

app.use("/api/aircraft", aircraftRouter);

// ======================================================
// AIRCRAFT CLEANUP JOB
// Deletes aircraft not updated in last 5 minutes
// Runs every 15 minutes
// ======================================================

setInterval(async () => {
  try {
    const [result] = await pool.query(
      `DELETE FROM aircraft_latest
       WHERE updated_at < (NOW() - INTERVAL 5 MINUTE)`
    );

    console.log(`Aircraft cleanup: removed ${result.affectedRows} old aircraft`);
  } catch (err) {
    console.error("Aircraft cleanup failed:", err.message);
  }
}, 15 * 60 * 1000);