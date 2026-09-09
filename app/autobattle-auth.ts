import { env } from "cloudflare:workers";

type RuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
};

type SupabaseAuthUser = {
  id?: unknown;
  email?: unknown;
};

type SupabaseSessionResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  user?: SupabaseAuthUser;
};

export type AutoBattleIdentity = {
  id: string;
  email: string;
};

export type AutoBattleAuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AutoBattleIdentity;
};

export const ACCESS_COOKIE = "idi_ab_access";
export const REFRESH_COOKIE = "idi_ab_refresh";
const REFRESH_COOKIE_SECONDS = 30 * 24 * 60 * 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function configuration() {
  const runtime = env as unknown as RuntimeEnv;
  const url = runtime.SUPABASE_URL?.trim().replace(/\/+$/, "") || "";
  const publishable = runtime.SUPABASE_PUBLISHABLE_KEY?.trim() || "";
  const secret = runtime.SUPABASE_SECRET_KEY?.trim() || "";
  const key = publishable || secret;
  if (!url || !key) {
    throw new Error("AutoBattle account authentication is not configured.");
  }
  return { url, key, usingSecretKey: !publishable && Boolean(secret) };
}

function normalizeSession(body: SupabaseSessionResponse): AutoBattleAuthSession {
  const accessToken = typeof body.access_token === "string" ? body.access_token : "";
  const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token : "";
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 0;
  const id = typeof body.user?.id === "string" ? body.user.id : "";
  const email = normalizeEmail(body.user?.email);
  if (!accessToken || !refreshToken || expiresIn < 1 || !id || !email) {
    throw new Error("Authentication returned an incomplete session.");
  }
  return { accessToken, refreshToken, expiresIn, user: { id, email } };
}

async function authRequest<T>(
  path: string,
  body: Record<string, unknown> | null,
  options: { accessToken?: string; remoteIp?: string } = {},
) {
  const { url, key, usingSecretKey } = configuration();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    apikey: key,
    "X-Client-Info": "idi-autobattle-worker/1.0",
  };
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
  if (usingSecretKey && options.remoteIp) headers["Sb-Forwarded-For"] = options.remoteIp;

  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: body === null ? "GET" : "POST",
    headers,
    body: body === null ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text
    ? (JSON.parse(text) as T & { msg?: string; message?: string })
    : ({} as T & { msg?: string; message?: string });
  if (!response.ok) {
    const error = new Error(parsed.msg || parsed.message || "Authentication failed.") as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  return parsed;
}

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 320) : "";
}

export function validEmail(email: string) {
  return EMAIL_PATTERN.test(email);
}

export async function requestEmailCode(email: string, remoteIp: string) {
  await authRequest("otp", {
    email,
    create_user: true,
    data: { product: "autobattle" },
  }, { remoteIp });
}

export async function verifyEmailCode(email: string, token: string) {
  const body = await authRequest<SupabaseSessionResponse>("verify", {
    type: "email",
    email,
    token,
  });
  return normalizeSession(body);
}

export async function refreshSession(refreshToken: string) {
  const body = await authRequest<SupabaseSessionResponse>("token?grant_type=refresh_token", {
    refresh_token: refreshToken,
  });
  return normalizeSession(body);
}

export async function getIdentity(accessToken: string): Promise<AutoBattleIdentity> {
  const body = await authRequest<SupabaseAuthUser>("user", null, { accessToken });
  const id = typeof body.id === "string" ? body.id : "";
  const email = normalizeEmail(body.email);
  if (!id || !email) throw new Error("The account session is invalid.");
  return { id, email };
}

export async function revokeSession(accessToken: string) {
  await authRequest("logout?scope=local", {}, { accessToken });
}

export function readCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") || "";
  for (const part of cookies.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return "";
}

function cookie(name: string, value: string, maxAge: number, secure: boolean) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

export function appendSessionCookies(headers: Headers, session: AutoBattleAuthSession, request: Request) {
  const secure = new URL(request.url).protocol === "https:";
  headers.append("Set-Cookie", cookie(ACCESS_COOKIE, session.accessToken, session.expiresIn, secure));
  headers.append("Set-Cookie", cookie(REFRESH_COOKIE, session.refreshToken, REFRESH_COOKIE_SECONDS, secure));
  headers.set("Cache-Control", "no-store");
}

export function appendExpiredSessionCookies(headers: Headers, request: Request) {
  const secure = new URL(request.url).protocol === "https:";
  headers.append("Set-Cookie", cookie(ACCESS_COOKIE, "", 0, secure));
  headers.append("Set-Cookie", cookie(REFRESH_COOKIE, "", 0, secure));
  headers.set("Cache-Control", "no-store");
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export function clientAddress(request: Request) {
  return request.headers.get("CF-Connecting-IP")?.trim() || "";
}
