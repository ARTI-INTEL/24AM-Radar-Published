import { pool } from "../db.js";
import { getOpenSkyToken } from "../openskyToken.js";

const OPENSKY_BASE = "https://opensky-network.org/api";

export function startAircraftPoller() {
  const intervalMs = Number(process.env.AIRCRAFT_POLL_MS || 90_000);

  async function poll() {
    try {
      // Example: poll a fixed region (UAE-ish). You can change these.
      const minLat = -90.0, maxLat = 90.0, minLon = -180.0, maxLon = 180.0;

      const token = await getOpenSkyToken();
      const url = `${OPENSKY_BASE}/states/all?lamin=${minLat}&lamax=${maxLat}&lomin=${minLon}&lomax=${maxLon}`;

      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
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
        .filter(x => x.icao24 && Number.isFinite(Number(x.latitude)) && Number.isFinite(Number(x.longitude)));

      if (!states.length) return;

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

      console.log(`Poll OK: ${states.length} aircraft cached`);
    } catch (e) {
      console.error("Poll FAILED:", e?.message || e);
    }
  }

  // run once immediately, then every interval
  poll();
  setInterval(poll, intervalMs);
}