import express from "express";
import { pool } from "../db.js";

export const aircraftRouter = express.Router();

const OPENSKY_BASE = "https://opensky-network.org/api";
const OPENSKY_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

// --- Simple in-memory token cache ---
let cachedToken = null;
let cachedExpMs = 0;

async function getOpenSkyToken() {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET in .env");
  }

  // Reuse token until 60s before expiry
  if (cachedToken && Date.now() < cachedExpMs - 60_000) {
    return cachedToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret
  });

  const tr = await fetch(OPENSKY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!tr.ok) {
    const text = await tr.text();
    throw new Error(`OpenSky token request failed (${tr.status}): ${text}`);
  }

  const tdata = await tr.json();

  cachedToken = tdata.access_token;
  const expiresInSec = Number(tdata.expires_in || 1800); // OpenSky typically ~30 mins
  cachedExpMs = Date.now() + expiresInSec * 1000;

  return cachedToken;
}

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