let cachedToken = null;
let cachedExpMs = 0;

export async function getOpenSkyToken() {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET in .env");
  }

  // reuse token until 1 minute before expiry
  if (cachedToken && Date.now() < cachedExpMs - 90_000) {
    return cachedToken;
  }

  const tokenUrl =
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret
  });

  const r = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`OpenSky token request failed (${r.status}): ${text}`);
  }

  const data = await r.json();
  cachedToken = data.access_token;

  // token expires ~30 mins per OpenSky docs :contentReference[oaicite:1]{index=1}
  const expiresInSec = Number(data.expires_in || 1800);
  cachedExpMs = Date.now() + expiresInSec * 1000;

  return cachedToken;
}