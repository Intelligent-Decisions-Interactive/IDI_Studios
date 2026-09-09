import { env } from "cloudflare:workers";
import type { AutoBattleCheckoutQuote } from "./autobattle-db";

export const STRIPE_API_VERSION = "2026-02-25.clover";

type RuntimeEnv = {
  AUTOBATTLE_PUBLIC_ORIGIN?: string;
  STRIPE_ALLOW_LIVE_MODE?: string;
  STRIPE_AUTOBATTLE_TAX_CODE?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
};

export type StripeEvent = {
  id: string;
  type: string;
  livemode: boolean;
  data: { object: Record<string, unknown> };
};

export class StripeConfigurationError extends Error {}

export class StripeRequestError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(`Stripe request failed (${status}, ${code || "unknown"}).`);
  }
}

function runtimeConfiguration() {
  return env as unknown as RuntimeEnv;
}

function liveModeAllowed(runtime: RuntimeEnv) {
  return runtime.STRIPE_ALLOW_LIVE_MODE?.trim().toLowerCase() === "true";
}

function stripeSecretKey() {
  const runtime = runtimeConfiguration();
  const secretKey = runtime.STRIPE_SECRET_KEY?.trim() || "";
  if (!/^sk_(test|live)_/.test(secretKey)) {
    throw new StripeConfigurationError("Stripe checkout is not configured.");
  }
  if (secretKey.startsWith("sk_live_") && !liveModeAllowed(runtime)) {
    throw new StripeConfigurationError("Live Stripe checkout is disabled.");
  }
  return secretKey;
}

export function stripeLiveModeAllowed() {
  return liveModeAllowed(runtimeConfiguration());
}

function checkoutConfiguration() {
  const runtime = runtimeConfiguration();
  const originValue = runtime.AUTOBATTLE_PUBLIC_ORIGIN?.trim() || "";
  const taxCode = runtime.STRIPE_AUTOBATTLE_TAX_CODE?.trim() || "";
  let origin: URL;
  try {
    origin = new URL(originValue);
  } catch {
    throw new StripeConfigurationError("AutoBattle's public checkout origin is not configured.");
  }
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new StripeConfigurationError("AutoBattle's public checkout origin must be an HTTPS origin.");
  }
  if (!/^txcd_[0-9]+$/.test(taxCode)) {
    throw new StripeConfigurationError("AutoBattle's Stripe Tax code is not configured.");
  }
  return { origin: origin.origin, secretKey: stripeSecretKey(), taxCode };
}

function metadata(params: URLSearchParams, name: string, value: string) {
  params.set(`metadata[${name}]`, value);
  params.set(`payment_intent_data[metadata][${name}]`, value);
}

export async function createAutoBattleCheckout(input: {
  userId: string;
  email: string;
  quote: AutoBattleCheckoutQuote;
  idempotencyKey: string;
}) {
  const { origin, secretKey, taxCode } = checkoutConfiguration();
  const { quote } = input;
  const params = new URLSearchParams({
    mode: "payment",
    customer_creation: "always",
    customer_email: input.email,
    client_reference_id: input.userId,
    success_url: `${origin}/AutoBattle/account?checkout=success`,
    cancel_url: `${origin}/AutoBattle/account?checkout=cancelled`,
    "automatic_tax[enabled]": "true",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": quote.currency,
    "line_items[0][price_data][unit_amount]": String(quote.totalCents),
    "line_items[0][price_data][tax_behavior]": "exclusive",
    "line_items[0][price_data][product_data][name]": `${quote.paidTokens} AutoBattle tokens`,
    "line_items[0][price_data][product_data][description]": quote.bonusTokens
      ? `Includes ${quote.bonusTokens} bonus tokens. One token authorizes one automation cycle.`
      : "One token authorizes one automation cycle.",
    "line_items[0][price_data][product_data][tax_code]": taxCode,
  });

  metadata(params, "autobattle_flow", "token_pack_v1");
  metadata(params, "autobattle_user_id", input.userId);
  metadata(params, "autobattle_sku", quote.sku);
  metadata(params, "autobattle_subtotal_cents", String(quote.subtotalCents));
  metadata(params, "autobattle_discount_cents", String(quote.discountCents));
  metadata(params, "autobattle_discount_percent", String(quote.discountPercent));
  metadata(params, "autobattle_discount_entitlement_id", quote.discountEntitlementId || "");

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `autobattle-checkout:${input.userId}:${input.idempotencyKey}`,
      "Stripe-Version": STRIPE_API_VERSION,
    },
    body: params.toString(),
  });
  const body = await response.json() as {
    id?: unknown;
    url?: unknown;
    error?: { code?: unknown };
  };
  if (!response.ok) {
    throw new StripeRequestError(
      response.status,
      typeof body.error?.code === "string" ? body.error.code : "",
    );
  }
  if (typeof body.id !== "string" || typeof body.url !== "string") {
    throw new StripeRequestError(502, "invalid_checkout_response");
  }
  const checkoutUrl = new URL(body.url);
  if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.stripe.com") {
    throw new StripeRequestError(502, "invalid_checkout_url");
  }
  return { id: body.id, url: checkoutUrl.toString() };
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function hmacSha256Hex(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyStripeEvent(payload: string, signatureHeader: string | null) {
  const runtime = runtimeConfiguration();
  const secret = runtime.STRIPE_WEBHOOK_SECRET?.trim() || "";
  if (!secret.startsWith("whsec_")) {
    throw new StripeConfigurationError("Stripe webhook verification is not configured.");
  }
  const entries = (signatureHeader || "").split(",").map((part) => part.trim().split("=", 2));
  const timestampValue = entries.find(([key]) => key === "t")?.[1] || "";
  const signatures = entries.filter(([key]) => key === "v1").map(([, value]) => value || "");
  const timestamp = Number(timestampValue);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) {
    throw new Error("Invalid Stripe webhook timestamp.");
  }
  const expected = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
  if (!signatures.some((signature) => timingSafeEqual(signature, expected))) {
    throw new Error("Invalid Stripe webhook signature.");
  }
  const event = JSON.parse(payload) as Partial<StripeEvent>;
  if (
    typeof event.id !== "string" ||
    typeof event.type !== "string" ||
    typeof event.livemode !== "boolean" ||
    !event.data ||
    !event.data.object ||
    typeof event.data.object !== "object"
  ) {
    throw new Error("Invalid Stripe event.");
  }
  return event as StripeEvent;
}
