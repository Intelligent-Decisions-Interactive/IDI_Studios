import { env } from "cloudflare:workers";
import {
  createWowSession,
  sessionCookie,
  verifyWowTotp,
} from "../../wow-auth";

type RuntimeEnv = { TURNSTILE_SECRET_KEY?: string };
type AuthPayload = { code?: unknown; turnstileToken?: unknown };
type TurnstileResult = {
  success?: boolean;
  action?: string;
  hostname?: string;
};
type Attempt = { count: number; resetAt: number };

const attempts = new Map<string, Attempt>();
const ATTEMPT_LIMIT = 5;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

function json(body: object, status: number, extraHeaders?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "Referrer-Policy": "no-referrer",
      ...extraHeaders,
    },
  });
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function allowedHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "idistudios.io" ||
    normalized.endsWith(".idistudios.io") ||
    normalized === "idistudios.sofakingbannon.chatgpt.site" ||
    normalized === "localhost"
  );
}

async function verifyTurnstile(token: string, remoteIp: string) {
  const secret =
    (env as unknown as RuntimeEnv).TURNSTILE_SECRET_KEY?.trim() || "";
  if (!secret || !token) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret,
          response: token,
          remoteip: remoteIp || undefined,
          idempotency_key: crypto.randomUUID(),
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) return false;
    const result = (await response.json()) as TurnstileResult;
    return Boolean(
      result.success &&
        result.action === "wow_access" &&
        result.hostname &&
        allowedHostname(result.hostname),
    );
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function remoteAddress(request: Request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function blocked(key: string, now: number) {
  const current = attempts.get(key);
  if (!current) return false;
  if (current.resetAt <= now) {
    attempts.delete(key);
    return false;
  }
  return current.count >= ATTEMPT_LIMIT;
}

function recordFailure(key: string, now: number) {
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
  } else {
    current.count += 1;
  }
}

export async function POST(request: Request) {
  const now = Date.now();
  const address = remoteAddress(request);
  if (blocked(address, now)) {
    return json(
      { error: "Too many attempts. Wait ten minutes and try again." },
      429,
      { "Retry-After": "600" },
    );
  }

  let payload: AuthPayload;
  try {
    payload = (await request.json()) as AuthPayload;
  } catch {
    return json({ error: "Enter the current six-digit code." }, 400);
  }

  const code = clean(payload.code, 6);
  const turnstileToken = clean(payload.turnstileToken, 2048);
  const human = await verifyTurnstile(turnstileToken, address);
  if (!human) {
    return json(
      { error: "Complete the security check and try again." },
      403,
    );
  }

  try {
    if (!(await verifyWowTotp(code, now))) {
      recordFailure(address, now);
      return json({ error: "That code is invalid or expired." }, 401);
    }

    attempts.delete(address);
    const session = await createWowSession(now);
    const secure = new URL(request.url).protocol === "https:";
    return json(
      { ok: true },
      200,
      { "Set-Cookie": sessionCookie(session, secure) },
    );
  } catch {
    return json(
      { error: "Private access is temporarily unavailable." },
      503,
    );
  }
}
