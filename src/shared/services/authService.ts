import { useAuthStore } from '../stores/authStore';

const BASE_URL = 'https://sana-api-771646345314.us-central1.run.app';

let cachedToken: string | null  = null;
let tokenExpiry: number         = 0;           // epoch ms

export async function getAuthToken(role: 'demo' | 'patient' | 'doctor' = 'demo'): Promise<string> {
  // Si el usuario autenticado tiene un token real de registro, usarlo
  const user = useAuthStore.getState().user;
  if (user?.token) {
    return user.token;
  }

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

export async function requestOtp(curp: string, phone: string): Promise<{ status: string; expires_in: number; debug_otp?: string }> {
  const res = await fetch(`${BASE_URL}/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 'request_otp', curp, phone })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `Error ${res.status}`);
  }
  return res.json();
}

export async function verifyOtpAndRegister(
  curp: string,
  phone: string,
  otp: string,
  sex: 'H' | 'M',
  dob: string
): Promise<{ status: string; user_id: string; access_token: string; role: string; is_demo: boolean }> {
  const res = await fetch(`${BASE_URL}/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 'verify_otp', curp, phone, otp, sex, dob })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `Error ${res.status}`);
  }
  return res.json();
}

export { BASE_URL };
