// File: aircraft.routes.js
// Project: 24Air Radar
// Author: Muhammad Faiq Imran
// Last Modified: 15/03/2026

// Description:
//   This file manages aircraft-related API routes for the 24Air Radar application. 
//   It includes endpoints for retrieving aircraft states within a bounding box and searching for aircraft.
// 
// Dependencies:
//  - express


import express from "express";
import { pool } from "../db.js";

export const AircraftRouter = express.Router();

/**
 * GET /api/Aircraft?minLat=&maxLat=&minLon=&maxLon=
 * Returns Aircraft states in the bounding box.
 * Also upserts into Aircraft_latest.
 */
AircraftRouter.get("/", async (req, res) => {
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
      FROM Aircraft_latest
      WHERE latitude BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
      LIMIT 3000
      `,
      [minLat, maxLat, minLon, maxLon]
    );

    return res.json({ source: "cache", states: rows });
  } catch (e) {
    console.error("AirCRAFT CACHE ERROR:", e);
    return res.status(500).json({ message: "Server error", error: String(e.message || e) });
  }
});

// Past Positions for an  Aircraft
AircraftRouter.get("/:icao/track", async (req, res) => {
  try {
    const icao = req.params.icao;

    const [rows] = await pool.query(
      `
      SELECT lat, lon
      FROM Aircraft_positions
      WHERE icao = ?
      ORDER BY time ASC
      `,
      [icao]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get Aircraft track" });
  }
});