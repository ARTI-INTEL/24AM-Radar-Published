// File: airports.routes.js
// Project: 24Air Radar
// Author: Muhammad Faiq Imran
// Last Modified: 15/03/2026

// Description:
//   This file manages airport-related API routes for the 24Air Radar application. 
//   It includes endpoints for retrieving airports within a bounding box and searching for airports.
// 
// Dependencies:
//  - express

import express from "express";
import { pool } from "../db.js";

export const AirportsRouter = express.Router();

/**
 * GET /api/Airports?minLat=&maxLat=&minLon=&maxLon=
 * Returns Airports within the bounding box
 */
AirportsRouter.get("/", async (req, res) => {
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
      SELECT 
        idAirport, Name, City, Country, IATA, ICAO, Longitude, latidude
      FROM Airport
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

/**
 * GET /api/Airports/search?q=dubai
 * Search Airports by name, city, IATA, ICAO
 */
AirportsRouter.get("/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    if (!q) return res.json([]);

    const exact = q.toUpperCase();
    const like = `%${q}%`;

    const [rows] = await pool.query(
      `
      SELECT
        idAirport, Name, City, Country, IATA, ICAO, Longitude, latidude
      FROM Airport
      WHERE
        IATA = ?
        OR ICAO = ?
        OR Name LIKE ?
        OR City LIKE ?
        OR Country LIKE ?
      ORDER BY
        CASE
          WHEN IATA = ? THEN 0
          WHEN ICAO = ? THEN 1
          WHEN Name LIKE ? THEN 2
          WHEN City LIKE ? THEN 3
          ELSE 4
        END,
        Name ASC
      LIMIT 15
      `,
      [exact, exact, like, like, like, exact, exact, like, like]
    );

    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: "Airport search failed", error: String(e.message || e) });
  }
});