import { pool } from "../db.js";
import { getOpenSkyToken } from "../openskyToken.js";

const OPENSKY_BASE = "https://opensky-network.org/api";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRetry(url, options, attempts = 3) {
  let lastErr;

  for (let i = 1; i <= attempts; i++) {
    try {
      return await fetchWithTimeout(url, options);
    } catch (err) {
      lastErr = err;

      console.error(`Aircraft fetch attempt ${i} failed:`, err?.message);
      console.error("Cause:", err?.cause?.message || err?.cause || "(none)");

      if (i < attempts) {
        await sleep(800 * Math.pow(2, i - 1));
      }
    }
  }

  throw lastErr;
}

export function startAircraftPoller() {
  const intervalMs = Number(process.env.AIRCRAFT_POLL_MS || 90_000);

  async function poll() {
    try {

      const minLat = -90.0, maxLat = 90.0, minLon = -180.0, maxLon = 180.0;

      const token = await getOpenSkyToken();

      const url = `${OPENSKY_BASE}/states/all?lamin=${minLat}&lamax=${maxLat}&lomin=${minLon}&lomax=${maxLon}`;

      const r = await fetchRetry(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!r.ok) {
        const text = await r.text();
        throw new Error(`OpenSky states failed: ${r.status} ${text.slice(0,200)}`);
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
          on_ground: s?.[8] ? 1 : 0,
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

      if (!states.length) {
        console.log("Poll OK: 0 aircraft");
        return;
      }

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
        a.on_ground,
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
        ON DUPLICATE KEY UPDATE
          callsign = VALUES(callsign),
          origin_country = VALUES(origin_country),
          latitude = VALUES(latitude),
          longitude = VALUES(longitude),
          baro_altitude = VALUES(baro_altitude),
          velocity = VALUES(velocity),
          true_track = VALUES(true_track),
          vertical_rate = VALUES(vertical_rate),
          on_ground = VALUES(on_ground),
          squawk = VALUES(squawk),
          time_position = VALUES(time_position),
          last_contact = VALUES(last_contact)
        `,
        [values]
      );

      console.log(`Poll OK: ${states.length} aircraft cached`);
    } catch (err) {
      console.error("Poll FAILED:", err?.message);
      console.error("Poll FAILED cause:", err?.cause?.message || err?.cause || "(none)");
    }
  }

  poll();
  setInterval(poll, intervalMs);
}