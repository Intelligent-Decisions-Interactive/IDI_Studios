import { env } from "cloudflare:workers";

type RuntimeEnv = {
  WOW_TOTP_SECRET?: string;
  WOW_SESSION_SECRET?: string;
};

export const WOW_SESSION_COOKIE = "idi_wow_access";
export const WOW_SESSION_SECONDS = 12 * 60 * 60;

const TOTP_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const textEncoder = new TextEncoder();

function runtimeSecrets() {
  const runtime = env as unknown as RuntimeEnv;
  const totpSecret = runtime.WOW_TOTP_SECRET?.trim().replace(/\s+/g, "") || "";
  const sessionSecret = runtime.WOW_SESSION_SECRET?.trim() || "";

  if (!totpSecret || !sessionSecret) {
    throw new Error("WOW_TOTP_SECRET and WOW_SESSION_SECRET must be configured.");
  }

  return { totpSecret, sessionSecret };
}

function decodeBase32(value: string) {
  const normalized = value.toUpperCase().replace(/=+$/g, "");
  const output: number[] = [];
  let bits = 0;
  let buffer = 0;

  for (const character of normalized) {
    const index = TOTP_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("WOW_TOTP_SECRET is not valid base32.");
    buffer = (buffer << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
      buffer &= bits ? (1 << bits) - 1 : 0;
    }
  }

  if (output.length < 20) {
    throw new Error("WOW_TOTP_SECRET must contain at least 160 bits.");
  }

  return new Uint8Array(output);
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function signHmac(
  algorithm: "SHA-1" | "SHA-256",
  secret: Uint8Array,
  value: Uint8Array,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    secret.slice().buffer as ArrayBuffer,
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, value.slice().buffer as ArrayBuffer),
  );
}

async function totpAt(secret: Uint8Array, timestamp: number) {
  const counter = Math.floor(timestamp / 30_000);
  const message = new Uint8Array(8);
  const view = new DataView(message.buffer);
  view.setUint32(0, Math.floor(counter / 0x1_0000_0000));
  view.setUint32(4, counter >>> 0);

  const digest = await signHmac("SHA-1", secret, message);
  const offset = digest[digest.length - 1] & 0x0f;
  const number =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(number % 1_000_000).padStart(6, "0");
}

export async function verifyWowTotp(code: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return false;
  const { totpSecret } = runtimeSecrets();
  const decodedSecret = decodeBase32(totpSecret);

  for (const offset of [-1, 0, 1]) {
    const expected = await totpAt(decodedSecret, now + offset * 30_000);
    if (constantTimeEqual(code, expected)) return true;
  }
  return false;
}

async function sessionSignature(payload: string) {
  const { sessionSecret } = runtimeSecrets();
  return base64Url(
    await signHmac(
      "SHA-256",
      textEncoder.encode(sessionSecret),
      textEncoder.encode(payload),
    ),
  );
}

export async function createWowSession(now = Date.now()) {
  const issuedAt = Math.floor(now / 1000);
  const expiresAt = issuedAt + WOW_SESSION_SECONDS;
  const nonce = new Uint8Array(16);
  crypto.getRandomValues(nonce);
  const payload = `v1.${issuedAt}.${expiresAt}.${base64Url(nonce)}`;
  return `${payload}.${await sessionSignature(payload)}`;
}

export async function verifyWowSession(token: string | undefined, now = Date.now()) {
  if (!token || token.length > 512) return false;
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== "v1") return false;

  const issuedAt = Number(parts[1]);
  const expiresAt = Number(parts[2]);
  const currentTime = Math.floor(now / 1000);
  if (
    !Number.isInteger(issuedAt) ||
    !Number.isInteger(expiresAt) ||
    issuedAt > currentTime + 300 ||
    expiresAt <= currentTime ||
    expiresAt - issuedAt !== WOW_SESSION_SECONDS
  ) {
    return false;
  }

  try {
    const payload = parts.slice(0, 4).join(".");
    const expected = await sessionSignature(payload);
    return constantTimeEqual(parts[4], expected);
  } catch {
    return false;
  }
}

export function readCookie(cookieHeader: string, name: string) {
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    if (key === name) return decodeURIComponent(item.slice(separator + 1).trim());
  }
  return undefined;
}

export function sessionCookie(value: string, secure = true) {
  const attributes = [
    `${WOW_SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/wow",
    `Max-Age=${WOW_SESSION_SECONDS}`,
    "HttpOnly",
    "SameSite=Strict",
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

export function expiredSessionCookie(secure = true) {
  const attributes = [
    `${WOW_SESSION_COOKIE}=`,
    "Path=/wow",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "SameSite=Strict",
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}
