/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  AUTOBATTLE_AUTH_RATE_LIMITER: RateLimitBinding;
  AUTOBATTLE_LINK_RATE_LIMITER: RateLimitBinding;
  AUTOBATTLE_PAYMENT_RATE_LIMITER: RateLimitBinding;
  AUTOBATTLE_CYCLE_RATE_LIMITER: RateLimitBinding;
  AUTOBATTLE_DOWNLOAD_RATE_LIMITER: RateLimitBinding;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.js.stripe.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.stripe.com https://*.stripe.com https://link.com https://*.link.com https://*.supabase.co https://challenges.cloudflare.com",
  "frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://*.stripe.com https://link.com https://*.link.com https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

function secured(response: Response, request: Request) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  headers.set("X-Frame-Options", "DENY");
  if (new URL(request.url).protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  if (headers.get("Content-Type")?.toLowerCase().includes("text/html")) {
    headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonError(message: string, status: number, retryAfter?: number) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  if (retryAfter) headers.set("Retry-After", String(retryAfter));
  return new Response(JSON.stringify({ error: message }), { status, headers });
}

function requestIp(request: Request) {
  return request.headers.get("cf-connecting-ip")?.trim() || "unknown";
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function enforceAutoBattleRateLimit(request: Request, env: Env) {
  const url = new URL(request.url);
  const path = url.pathname;
  let limiter: RateLimitBinding | undefined;
  let category = "";
  let credential = "";

  if (path === "/api/autobattle/auth/request-code" || path === "/api/autobattle/auth/verify-code") {
    limiter = env.AUTOBATTLE_AUTH_RATE_LIMITER;
    category = "auth";
  } else if (path === "/api/autobattle/mobile/link") {
    limiter = env.AUTOBATTLE_LINK_RATE_LIMITER;
    category = "link";
  } else if (path === "/api/autobattle/download" && (request.method === "GET" || request.method === "HEAD")) {
    limiter = env.AUTOBATTLE_DOWNLOAD_RATE_LIMITER;
    category = "download";
    credential = request.headers.get("cookie") || "";
  } else if (
    path === "/api/autobattle/payment-intent" ||
    path === "/api/autobattle/mobile/marketplace/quote" ||
    path === "/api/autobattle/mobile/marketplace/payment-intent"
  ) {
    limiter = env.AUTOBATTLE_PAYMENT_RATE_LIMITER;
    category = "payment";
    credential = request.headers.get("authorization") || request.headers.get("cookie") || "";
  } else if (path.startsWith("/api/autobattle/mobile/cycles/")) {
    limiter = env.AUTOBATTLE_CYCLE_RATE_LIMITER;
    category = "cycle";
    credential = request.headers.get("authorization") || "";
  }

  if (!limiter) return null;
  try {
    const key = await sha256(`${category}:${requestIp(request)}:${credential}`);
    const result = await limiter.limit({ key });
    return result.success
      ? null
      : jsonError("Too many requests. Wait a minute and try again.", 429, 60);
  } catch (error) {
    console.error("AutoBattle rate limiter failed closed", { category, error });
    return jsonError("The account service is temporarily unavailable.", 503, 60);
  }
}

async function boundAutoBattleRequestBody(request: Request) {
  const url = new URL(request.url);
  const isAutoBattleApi =
    url.pathname.startsWith("/api/autobattle/") ||
    url.pathname.startsWith("/admin/api/autobattle/") ||
    url.pathname.startsWith("/beta/admin/api/autobattle/");
  if (!isAutoBattleApi || !["POST", "PUT", "PATCH"].includes(request.method)) {
    return { request };
  }

  const contentLengthHeader = request.headers.get("content-length");
  const declaredLength = Number(contentLengthHeader || "0");
  const maxBytes = url.pathname === "/api/autobattle/stripe/webhook" ? 1_048_576 : 16_384;
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { response: jsonError("Request body is too large.", 413) };
  }
  if (!request.body || contentLengthHeader === "0") return { request };
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.startsWith("application/json")) {
    return { response: jsonError("Content-Type must be application/json.", 415) };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { response: jsonError("Request body is too large.", 413) };
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { request: new Request(request, { body }) };
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return secured(response, request);
    }

    const rateLimitResponse = await enforceAutoBattleRateLimit(request, env);
    if (rateLimitResponse) return secured(rateLimitResponse, request);
    const bounded = await boundAutoBattleRequestBody(request);
    if (bounded.response) return secured(bounded.response, request);
    return secured(await handler.fetch(bounded.request || request, env, ctx), request);
  },
};

export default worker;
