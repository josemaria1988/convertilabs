import { createECDH, ECDH, timingSafeEqual } from "node:crypto";

export const PUSH_SCHEDULE = { localTime: "09:00", timeZone: "America/Montevideo" } as const;
export class PushError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function validDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
export function localDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PUSH_SCHEDULE.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function addDays(day: string, offset: number) {
  if (!validDay(day)) throw new PushError(400, "Fecha no válida.");
  const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function isPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096 || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    const host = url.hostname;
    return url.protocol === "https:" && !url.username && !url.password && !url.hash
      && (!url.port || url.port === "443") && url.pathname.length > 1
      && (host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com"
        || host === "web.push.apple.com" || /^[a-z0-9-]+\.notify\.windows\.com$/.test(host));
  } catch { return false; }
}
function decodedKey(value: unknown, length: number) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const bytes = Buffer.from(value, "base64url");
  return bytes.length === length && bytes.toString("base64url") === value ? bytes : null;
}
export type BrowserSubscription = { endpoint: string; keys: { p256dh: string; auth: string }; expirationTime?: number | null };
export function validateSubscription(value: unknown): BrowserSubscription {
  if (!value || typeof value !== "object") throw new PushError(400, "Suscripción no válida.");
  const input = value as Partial<BrowserSubscription>;
  const key = decodedKey(input.keys?.p256dh, 65);
  if (!isPushEndpoint(input.endpoint) || !key || key[0] !== 4 || !decodedKey(input.keys?.auth, 16)) {
    throw new PushError(400, "El proveedor o las claves de notificaciones no son válidos.");
  }
  try { ECDH.convertKey(key, "prime256v1"); } catch { throw new PushError(400, "Clave de suscripción no válida."); }
  if (input.expirationTime != null && (!Number.isFinite(input.expirationTime) || input.expirationTime <= Date.now()
    || input.expirationTime > 8640000000000000)) throw new PushError(400, "La suscripción venció o tiene una fecha no válida.");
  return { endpoint: input.endpoint, keys: input.keys!, expirationTime: input.expirationTime ?? null };
}
export function validateIdentity(slug: unknown, deviceId: unknown) {
  if (typeof slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)
    || typeof deviceId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId)) {
    throw new PushError(400, "Empresa o dispositivo no válido.");
  }
  return { slug, deviceId };
}
export type VapidConfig = { publicKey: string; privateKey: string; subject: string };
export function readVapidConfig(env = process.env): VapidConfig | null {
  const publicKey = env.WEB_PUSH_VAPID_PUBLIC_KEY; const privateKey = env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = env.WEB_PUSH_VAPID_SUBJECT;
  const pub = decodedKey(publicKey, 65); const priv = decodedKey(privateKey, 32);
  if (!pub || pub[0] !== 4 || !priv || !subject || !/^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(subject)) return null;
  try {
    const ecdh = createECDH("prime256v1"); ecdh.setPrivateKey(priv);
    const actual = ecdh.getPublicKey();
    if (!timingSafeEqual(pub, actual)) return null;
  } catch { return null; }
  return { publicKey: publicKey!, privateKey: privateKey!, subject };
}
export function validCronAuthorization(value: string | null, secret = process.env.CRON_SECRET) {
  if (!secret || secret.length < 32 || !value) return false;
  const expected = Buffer.from(`Bearer ${secret}`); const actual = Buffer.from(value);
  return actual.length === expected.length && timingSafeEqual(expected, actual);
}
export function subscriptionStatus(row: { enabled: boolean; vapid_public_key: string; expires_at: string | null; disabled_reason: string | null } | null,
  publicKey: string | null, now = Date.now()) {
  const expired = !!row?.expires_at && !(Date.parse(row.expires_at) > now);
  const keyChanged = !!row && !!publicKey && row.vapid_public_key !== publicKey;
  return { subscribed: !!row?.enabled && row.vapid_public_key === publicKey && !expired,
    requiresRefresh: !!row && (row.disabled_reason === "provider_expired" || expired || keyChanged) };
}
