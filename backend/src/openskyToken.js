// src/openskyToken.js
let cachedToken = null;
let cachedExpMs = 0;
let inFlightPromise = null;

const TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

// keep this fairly low so your API doesn't hang on Railway
const DEFAULT_TIMEOUT_MS = Number(process.env.OPENSKY_TIMEOUT_MS || 8000);

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export async function getOpenSkyToken() {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET");
  }

  // Reuse token until 60s before expiry
  if (cachedToken && Date.now() < cachedExpMs - 60_000) {
    return cachedToken;
  }

  // Prevent multiple concurrent requests from spamming the token endpoint
  if (inFlightPromise) return inFlightPromise;

  inFlightPromise = (async () => {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret
    });

    let r;
    try {
      r = await fetchWithTimeout(
        TOKEN_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body
        },
        DEFAULT_TIMEOUT_MS
      );
    } catch (err) {
      // AbortError or connect timeout, etc.
      throw new Error(`OpenSky token request failed (network/timeout): ${err?.message || err}`);
    }

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      throw new Error(`OpenSky token request failed (${r.status}): ${text}`.trim());
    }

    const data = await r.json();

    cachedToken = data.access_token;

    // expires_in is seconds (commonly ~1800)
    const expiresInSec = Number(data.expires_in || 1800);
    cachedExpMs = Date.now() + expiresInSec * 1000;

    return cachedToken;
  })();

  try {
    return await inFlightPromise;
  } finally {
    inFlightPromise = null;
  }
}

/**
 * Optional helper: Basic Auth header for OpenSky API calls.
 * This is useful if OAuth token endpoint is flaky.
 * Use only if you have OPENSKY_BASIC_USER + OPENSKY_BASIC_PASS.
 */
export function getOpenSkyBasicAuthHeader() {
  const u = process.env.OPENSKY_BASIC_USER;
  const p = process.env.OPENSKY_BASIC_PASS;
  if (!u || !p) return null;

  const b64 = Buffer.from(`${u}:${p}`).toString("base64");
  return `Basic ${b64}`;
}