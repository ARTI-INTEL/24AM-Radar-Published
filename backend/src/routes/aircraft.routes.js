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
      return res
        .status(400)
        .json({ message: "Provide minLat,maxLat,minLon,maxLon as numbers." });
    }

    // OpenSky bbox params: lamin, lamax, lomin, lomax
    const url = `${OPENSKY_BASE}/states/all?lamin=${minLat}&lamax=${maxLat}&lomin=${minLon}&lomax=${maxLon}`;

    // OAuth Bearer token
    const token = await getOpenSkyToken();

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!r.ok) {
      // If OpenSky fails, fallback to DB cache
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

      return res.status(200).json({ source: "cache", states: rows });
    }

    const data = await r.json();

    const states = (data.states || [])
      .map((s) => ({
        icao24: (s?.[0] || "").trim(),
        callsign: (s?.[1] || "").trim() || null,
        origin_country: s?.[2] ?? null,
        time_position: s?.[3] ?? null,
        last_contact: s?.[4] ?? null,
        longitude: s?.[5] ?? null,
        latitude: s?.[6] ?? null,
        baro_altitude: s?.[7] ?? null,
        on_ground: s?.[8] ?? null,
        velocity: s?.[9] ?? null,
        true_track: s?.[10] ?? null,
        vertical_rate: s?.[11] ?? null,
        squawk: s?.[14] ?? null
      }))
      .filter(
        (x) =>
          x.icao24 &&
          Number.isFinite(Number(x.latitude)) &&
          Number.isFinite(Number(x.longitude))
      );

    // Upsert (using alias, avoids deprecated VALUES() warnings)
    if (states.length) {
      const values = states.map((a) => [
        a.icao24,
        a.callsign,
        a.origin_country,
        a.latitude,
        a.longitude,
        a.baro_altitude,
        a.velocity,
        a.true_track,
        a.vertical_rate,
        a.on_ground ? 1 : 0,
        a.squawk,
        a.time_position,
        a.last_contact
      ]);

      await pool.query(
        `
        INSERT INTO aircraft_latest (
          icao24, callsign, origin_country,
          latitude, longitude,
          baro_altitude, velocity, true_track, vertical_rate,
          on_ground, squawk,
          time_position, last_contact
        )
        VALUES ?
        AS new
        ON DUPLICATE KEY UPDATE
          callsign = new.callsign,
          origin_country = new.origin_country,
          latitude = new.latitude,
          longitude = new.longitude,
          baro_altitude = new.baro_altitude,
          velocity = new.velocity,
          true_track = new.true_track,
          vertical_rate = new.vertical_rate,
          on_ground = new.on_ground,
          squawk = new.squawk,
          time_position = new.time_position,
          last_contact = new.last_contact
        `,
        [values]
      );
    }

    res.json({ source: "opensky", time: data.time ?? null, states });
  } catch (e) {
    res.status(500).json({ message: "Server error", error: String(e.message || e) });
  }
});