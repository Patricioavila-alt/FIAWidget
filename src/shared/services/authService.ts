// ============================================================
// FiA API — Auth Service
// GET /auth/token?role=demo  →  { access_token, expires_in }
// El token dura 24h — lo cacheamos en memoria para no repetir.
// ============================================================

const BASE_URL = 'https://sana-api-771646345314.us-central1.run.app';

let cachedToken: string | null  = null;
let tokenExpiry: number         = 0;           // epoch ms

export async function getAuthToken(role: 'demo' | 'patient' | 'doctor' = 'demo'): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) {
    return cachedToken;
  }

  const res = await fetch(`${BASE_URL}/auth/token?role=${role}`);
  if (!res.ok) throw new Error(`Auth error ${res.status}`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;   // expires_in en segundos

  return cachedToken;
}

export { BASE_URL };
