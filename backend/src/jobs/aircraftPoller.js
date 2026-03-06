import { pool } from "../db.js";
import { getOpenSkyToken } from "../openskyToken.js";

const OPENSKY_BASE = "https://opensky-network.org/api";

export function startAircraftPoller() {
  const intervalMs = Number(process.env.AIRCRAFT_POLL_MS || 90_000);

  async function poll() {
    try {
      // Whole world bounds
      const minLat = -90.0,
        maxLat = 90.0,
        minLon = -180.0,
        maxLon = 180.0;

      const token = await getOpenSkyToken();
      const url = `${OPENSKY_BASE}/states/all?lamin=${minLat}&lamax=${maxLat}&lomin=${minLon}&lomax=${maxLon}`;

      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) throw new Error(`OpenSky states failed: ${r.status}`);

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
        // ✅ Safer numeric checks (no weird Number() coercion)
        .filter(
          (x) =>
            x.icao24 &&
            typeof x.latitude === "number" &&
            typeof x.longitude === "number" &&
            Number.isFinite(x.latitude) &&
            Number.isFinite(x.longitude)
        );

      if (!states.length) return;

      // =========================
      // 1) Upsert latest aircraft
      // =========================
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

      // ✅ FIX: correct MySQL ON DUPLICATE KEY UPDATE syntax
      // Make sure aircraft_latest.icao24 is PRIMARY KEY or UNIQUE
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

      // =========================
      // 2) Insert track positions
      // (only: icao, time, lat, lon)
      // =========================
      const trackValues = states.map((a) => [
        a.icao24,
        // optional: use OpenSky last_contact if available (seconds -> ms)
        a.last_contact ? new Date(a.last_contact * 1000) : new Date(),
        a.latitude,
        a.longitude
      ]);

      await pool.query(
        `
        INSERT INTO aircraft_positions (icao, time, lat, lon)
        VALUES ?
        `,
        [trackValues]
      );

      console.log(`Poll OK: ${states.length} aircraft cached`);
    } catch (e) {
      console.error("Poll FAILED:", e?.message || e);
    }
  }

  // Run once immediately, then every interval
  poll();
  setInterval(poll, intervalMs);
}