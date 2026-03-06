import express from "express";
import { pool } from "../db.js";

export const aircraftRouter = express.Router();

/**
 * GET /api/aircraft?minLat=&maxLat=&minLon=&maxLon=
 * Returns aircraft states in the bounding box.
 * Also upserts into aircraft_latest.
 */
aircraftRouter.get("/", async (req, res) => {
  try {
    const minLat = Number(req.query.minLat);
    const maxLat = Number(req.query.maxLat);
    const minLon = Number(req.query.minLon);
    const maxLon = Number(req.query.maxLon);

    if (![minLat, maxLat, minLon, maxLon].every(Number.isFinite)) {
      return res.status(400).json({ message: "Provide minLat,maxLat,minLon,maxLon as numbers." });
    }

    const [rows] = await pool.query(
      `
      SELECT *
      FROM aircraft_latest
      WHERE latitude BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
      LIMIT 3000
      `,
      [minLat, maxLat, minLon, maxLon]
    );

    return res.json({ source: "cache", states: rows });
  } catch (e) {
    console.error("AIRCRAFT CACHE ERROR:", e);
    return res.status(500).json({ message: "Server error", error: String(e.message || e) });
  }
});

// Past Positions for an  aircraft
aircraftRouter.get("/:icao/track", async (req, res) => {
  try {
    const icao = req.params.icao;

    const [rows] = await pool.query(
      `
      SELECT lat, lon
      FROM aircraft_positions
      WHERE icao = ?
      ORDER BY time ASC
      `,
      [icao]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get aircraft track" });
  }
});