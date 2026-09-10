import { env } from "cloudflare:workers";
import { insertBetaEvent } from "./supabase";

export { getBetaRequest, getBetaRequestEvents } from "./supabase";

type RuntimeEnv = {
  BETA_INVITE_URL?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_POLICY_AUD?: string;
};

type AccessJwk = JsonWebKey & { kid?: string; alg?: string };
type AccessJwtPayload = {
  aud?: string | string[];
  email?: string;
  exp?: number;
  iss?: string;
  nbf?: number;
};

let accessKeys: { expiresAt: number; keys: AccessJwk[] } | null = null;

export const BETA_STATUSES = [
  "pending",
  "approved",
  "invited",
  "active",
  "declined",
] as const;

export type BetaStatus = (typeof BETA_STATUSES)[number];

function normalizeEmail(value: string | null) {
  return value?.trim().toLowerCase() || "";
}

function accessConfiguration() {
  const runtime = env as unknown as RuntimeEnv;
  const teamDomain = runtime.ACCESS_TEAM_DOMAIN?.trim().replace(/\/+$/, "") || "";
  const audience = runtime.ACCESS_POLICY_AUD?.trim() || "";
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(teamDomain) || !audience) {
    return null;
  }
  return { teamDomain, audience };
}

function base64UrlBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function decodeJwtPart<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlBytes(value))) as T;
}

async function fetchAccessKeys(teamDomain: string, force = false) {
  if (!force && accessKeys && accessKeys.expiresAt > Date.now()) return accessKeys.keys;
  const response = await fetch(`${teamDomain}/cdn-cgi/access/certs`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Cloudflare Access keys are unavailable.");
  const body = await response.json() as { keys?: unknown };
  if (!Array.isArray(body.keys) || !body.keys.length) {
    throw new Error("Cloudflare Access returned no signing keys.");
  }
  const keys = body.keys.filter((key): key is AccessJwk => Boolean(
    key && typeof key === "object" && typeof (key as AccessJwk).kid === "string",
  ));
  if (!keys.length) throw new Error("Cloudflare Access returned invalid signing keys.");
  accessKeys = { expiresAt: Date.now() + 60 * 60 * 1000, keys };
  return keys;
}

async function verifyAccessJwt(token: string, teamDomain: string, audience: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid Cloudflare Access token.");
  const header = decodeJwtPart<{ alg?: string; kid?: string }>(parts[0]);
  const payload = decodeJwtPart<AccessJwtPayload>(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Invalid Cloudflare Access algorithm.");

  let keys = await fetchAccessKeys(teamDomain);
  let jwk = keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk) {
    keys = await fetchAccessKeys(teamDomain, true);
    jwk = keys.find((candidate) => candidate.kid === header.kid);
  }
  if (!jwk) throw new Error("Unknown Cloudflare Access signing key.");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw new Error("Invalid Cloudflare Access signature.");

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud || ""];
  if (
    payload.iss !== teamDomain ||
    !audiences.includes(audience) ||
    typeof payload.exp !== "number" || payload.exp <= now - 30 ||
    (typeof payload.nbf === "number" && payload.nbf > now + 30)
  ) {
    throw new Error("Invalid Cloudflare Access claims.");
  }
  const email = normalizeEmail(payload.email || null);
  if (!email) throw new Error("Cloudflare Access token has no email identity.");
  return email;
}

export async function getAdminActorFromHeaders(requestHeaders: Headers) {
  const configuration = accessConfiguration();
  const accessAssertion = requestHeaders.get("cf-access-jwt-assertion")?.trim() || "";
  if (!configuration || !accessAssertion) return null;

  try {
    const email = await verifyAccessJwt(
      accessAssertion,
      configuration.teamDomain,
      configuration.audience,
    );
    const headerEmail = normalizeEmail(requestHeaders.get("cf-access-authenticated-user-email"));
    if (headerEmail && headerEmail !== email) return null;
    return { email, provider: "Cloudflare Zero Trust" };
  } catch (error) {
    console.warn("Cloudflare Access JWT validation failed", error instanceof Error ? error.message : "unknown");
  }

  return null;
}

export function isBetaStatus(value: unknown): value is BetaStatus {
  return (
    typeof value === "string" &&
    (BETA_STATUSES as readonly string[]).includes(value)
  );
}

export async function logBetaEvent(input: {
  requestId: number;
  eventType: string;
  actorEmail: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  details?: Record<string, unknown>;
}) {
  await insertBetaEvent(input);
}

export function adminConfiguration() {
  const runtime = env as unknown as RuntimeEnv;
  return { inviteEnabled: Boolean(runtime.BETA_INVITE_URL?.trim()) };
}
