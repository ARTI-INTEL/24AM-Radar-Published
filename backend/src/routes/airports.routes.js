import express from "express";
import { pool } from "../db.js";

export const airportsRouter = express.Router();

/**
 * GET /api/airports?minLat=&maxLat=&minLon=&maxLon=
 * Returns airports within the bounding box
 */
airportsRouter.get("/", async (req, res) => {
  try {
    const minLat = Number(req.query.minLat);
    const maxLat = Number(req.query.maxLat);
    const minLon = Number(req.query.minLon);
    const maxLon = Number(req.query.maxLon);

    // Basic validation
    if (![minLat, maxLat, minLon, maxLon].every(Number.isFinite)) {
      return res.status(400).json({ message: "Provide minLat,maxLat,minLon,maxLon as numbers." });
    }

    // NOTE: your column is spelled `latidude` (typo) in your DB table
    const [rows] = await pool.query(
      `
      SELECT 
        idAirport, Name, City, Country, IATA, ICAO, Longitude, latidude
      FROM airport
      WHERE latidude BETWEEN ? AND ?
        AND Longitude BETWEEN ? AND ?
        AND ICAO IS NOT NULL
      LIMIT 3000
      `,
      [minLat, maxLat, minLon, maxLon]
    );

    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: "Server error", error: String(e.message || e) });
  }
});