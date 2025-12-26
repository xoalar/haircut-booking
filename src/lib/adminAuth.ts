import crypto from "crypto";

const COOKIE_NAME = "admin_token";

function getSecret() {
  const s = process.env.ADMIN_AUTH_SECRET;
  if (!s) throw new Error("Missing ADMIN_AUTH_SECRET env var");
  return s;
}

export function getAdminCookieName() {
  return COOKIE_NAME;
}

export function signAdminToken(payload: string) {
  const secret = getSecret();
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyAdminToken(token: string) {
  const secret = getSecret();
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;

  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;

  const [tsStr] = payload.split(":");
  const ts = Number(tsStr);
  if (!Number.isFinite(ts)) return false;

  const ageMs = Date.now() - ts;
  return ageMs >= 0 && ageMs < 7 * 24 * 60 * 60 * 1000;
}
