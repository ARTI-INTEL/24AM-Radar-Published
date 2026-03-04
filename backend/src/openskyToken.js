// openskyToken.js

let cachedToken = null;
let cachedExpMs = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 25_000) {
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
      return await fetchWithTimeout(url, options, 25_000);
    } catch (err) {
      lastErr = err;

      // Log both message + underlying cause (Node fetch often uses err.cause)
      console.error(`OpenSky token fetch attempt ${i} failed:`, err?.message || err);
      if (err?.cause) {
        console.error("OpenSky token fetch cause:", err.cause?.message || err.cause);
      }

      if (i < attempts) {
        // 0.8s, 1.6s, 3.2s backoff
        await sleep(800 * Math.pow(2, i - 1));
      }
    }
  }

  throw lastErr;
}

export async function getOpenSkyToken() {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET in .env");
  }

  // Reuse token until 90 seconds before expiry
  if (cachedToken && Date.now() < cachedExpMs - 90_000) {
    return cachedToken;
  }

  // Your existing token endpoint (kept the same)
  const tokenUrl =
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret
  });

  const r = await fetchRetry(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const text = await r.text();

  if (!r.ok) {
    // Include status + body snippet to help debug auth vs network
    throw new Error(`OpenSky token request failed (${r.status}): ${text.slice(0, 500)}`);
  }

  const data = JSON.parse(text);
  cachedToken = data.access_token;

  // Default expiry fallback 30 mins
  const expiresInSec = Number(data.expires_in || 1800);
  cachedExpMs = Date.now() + expiresInSec * 1000;

  console.log("OpenSky token obtained/refreshed");
  return cachedToken;
}