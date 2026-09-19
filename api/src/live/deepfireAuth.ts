const TOKEN_URL = "https://api.deepfire.co/v1/token";

// Margen de seguridad antes de que expire el token para refrescarlo.
const REFRESH_SKEW_MS = 30_000;
// Si no se puede leer `exp` del JWT, cuánto lo cacheamos por defecto.
const FALLBACK_TTL_MS = 4 * 60_000;

let cached: { token: string; expiresAt: number } | null = null;

/** Lee `exp` (segundos epoch) del payload del JWT sin verificar la firma. */
function expiryFromJwt(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export async function getDeepfireToken(): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt - REFRESH_SKEW_MS > now) {
    return cached.token;
  }

  const clientId = process.env.DEEPFIRE_CLIENT_ID;
  const clientSecret = process.env.DEEPFIRE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Faltan DEEPFIRE_CLIENT_ID / DEEPFIRE_CLIENT_SECRET. Copia api/.env.example a api/.env y rellénalas.",
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });

  if (!res.ok) {
    throw new Error(`Deepfire token request failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error("Deepfire token response sin access_token");
  }

  const expiresAt = expiryFromJwt(body.access_token) ?? now + FALLBACK_TTL_MS;
  cached = { token: body.access_token, expiresAt };
  return cached.token;
}
