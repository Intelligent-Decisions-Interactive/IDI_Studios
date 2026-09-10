import { env } from "cloudflare:workers";
import type { AutoBattleCheckoutQuote } from "./autobattle-db";

export const STRIPE_API_VERSION = "2026-02-25.clover";

type RuntimeEnv = {
  STRIPE_ALLOW_LIVE_MODE?: string;
  STRIPE_AUTOBATTLE_TAX_CODE?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
};

export type AutoBattleBillingAddress = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type AutoBattleMobileTaxQuote = {
  id: string;
  sku: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  expiresAt: number;
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
    throw new StripeConfigurationError("Stripe payments are not configured.");
  }
  if (secretKey.startsWith("sk_live_") && !liveModeAllowed(runtime)) {
    throw new StripeConfigurationError("Live Stripe payments are disabled.");
  }
  return secretKey;
}

export function stripeLiveModeAllowed() {
  return liveModeAllowed(runtimeConfiguration());
}

function paymentConfiguration() {
  const runtime = runtimeConfiguration();
  const publishableKey = runtime.STRIPE_PUBLISHABLE_KEY?.trim() || "";
  const taxCode = runtime.STRIPE_AUTOBATTLE_TAX_CODE?.trim() || "";
  const secretKey = stripeSecretKey();
  if (!/^pk_(test|live)_/.test(publishableKey)) {
    throw new StripeConfigurationError("Stripe payments are not configured.");
  }
  if (secretKey.startsWith("sk_test_") !== publishableKey.startsWith("pk_test_")) {
    throw new StripeConfigurationError("Stripe payment keys are from different modes.");
  }
  if (!/^txcd_[0-9]+$/.test(taxCode)) {
    throw new StripeConfigurationError("AutoBattle's Stripe Tax code is not configured.");
  }
  return { publishableKey, secretKey, taxCode };
}

export function autoBattleStripePublishableKey() {
  return paymentConfiguration().publishableKey;
}

function checkoutReference(userId: string, sku: string, idempotencyKey: string) {
  return `autobattle:${userId}:${sku}:${idempotencyKey}`;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function integerValue(value: unknown) {
  return Number.isSafeInteger(value) ? Number(value) : -1;
}

async function stripeJson<T>(
  url: string,
  init: RequestInit,
  secretKey: string,
  idempotencyKey?: string,
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Stripe-Version": STRIPE_API_VERSION,
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await response.json() as T & { error?: { code?: unknown } };
  if (!response.ok) {
    throw new StripeRequestError(
      response.status,
      typeof body.error?.code === "string" ? body.error.code : "",
    );
  }
  return body;
}

export async function createAutoBattleMobileTaxQuote(input: {
  userId: string;
  quote: AutoBattleCheckoutQuote;
  address: AutoBattleBillingAddress;
  idempotencyKey: string;
}): Promise<AutoBattleMobileTaxQuote> {
  const { secretKey, taxCode } = paymentConfiguration();
  const params = new URLSearchParams({
    currency: input.quote.currency,
    "line_items[0][amount]": String(input.quote.totalCents),
    "line_items[0][reference]": checkoutReference(input.userId, input.quote.sku, input.idempotencyKey),
    "line_items[0][tax_behavior]": "inclusive",
    "line_items[0][tax_code]": taxCode,
    "customer_details[address][line1]": input.address.line1,
    "customer_details[address][city]": input.address.city,
    "customer_details[address][state]": input.address.state,
    "customer_details[address][postal_code]": input.address.postalCode,
    "customer_details[address][country]": input.address.country,
    "customer_details[address_source]": "billing",
    "expand[0]": "line_items",
  });
  if (input.address.line2) params.set("customer_details[address][line2]", input.address.line2);
  const body = await stripeJson<{
    id?: unknown;
    object?: unknown;
    amount_total?: unknown;
    tax_amount_exclusive?: unknown;
    tax_amount_inclusive?: unknown;
    currency?: unknown;
    expires_at?: unknown;
  }>(
    "https://api.stripe.com/v1/tax/calculations",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
    secretKey,
    `autobattle-tax:${input.userId}:${input.idempotencyKey}`,
  );
  const id = stringValue(body.id);
  const amountTotal = integerValue(body.amount_total);
  const exclusiveTax = integerValue(body.tax_amount_exclusive);
  const taxCents = integerValue(body.tax_amount_inclusive);
  const expiresAt = integerValue(body.expires_at);
  if (
    body.object !== "tax.calculation" ||
    !/^taxcalc_[A-Za-z0-9_]+$/.test(id) ||
    stringValue(body.currency).toLowerCase() !== input.quote.currency ||
    exclusiveTax !== 0 ||
    taxCents < 0 ||
    taxCents > input.quote.totalCents ||
    amountTotal !== input.quote.totalCents ||
    expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    throw new StripeRequestError(502, "invalid_tax_calculation");
  }
  return {
    id,
    sku: input.quote.sku,
    subtotalCents: input.quote.totalCents,
    taxCents,
    totalCents: amountTotal,
    currency: input.quote.currency,
    expiresAt,
  };
}

function normalizedAddressValue(value: unknown) {
  return stringValue(value).normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function matchingBillingAddress(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
) {
  return ["line1", "line2", "city", "state", "postal_code", "country"].every(
    (field) => normalizedAddressValue(left[field]) === normalizedAddressValue(right[field]),
  );
}

export async function createAutoBattleMobilePaymentIntent(input: {
  userId: string;
  email: string;
  quote: AutoBattleCheckoutQuote;
  taxCalculationId: string;
  confirmationTokenId: string;
  idempotencyKey: string;
  channel?: "mobile" | "web";
}) {
  const { secretKey, taxCode } = paymentConfiguration();
  const calculationUrl = new URL(`https://api.stripe.com/v1/tax/calculations/${input.taxCalculationId}`);
  calculationUrl.searchParams.append("expand[]", "line_items");
  const [calculation, confirmationToken] = await Promise.all([
    stripeJson<{
      id?: unknown;
      object?: unknown;
      amount_total?: unknown;
      tax_amount_exclusive?: unknown;
      tax_amount_inclusive?: unknown;
      currency?: unknown;
      expires_at?: unknown;
      customer_details?: { address?: Record<string, unknown> };
      line_items?: { data?: Array<Record<string, unknown>> };
    }>(calculationUrl.toString(), { method: "GET" }, secretKey),
    stripeJson<{
      id?: unknown;
      object?: unknown;
      expires_at?: unknown;
      livemode?: unknown;
      payment_intent?: unknown;
      payment_method_preview?: { billing_details?: { address?: Record<string, unknown> } };
    }>(`https://api.stripe.com/v1/confirmation_tokens/${input.confirmationTokenId}`, { method: "GET" }, secretKey),
  ]);
  const taxCents = integerValue(calculation.tax_amount_inclusive);
  const amountTotal = integerValue(calculation.amount_total);
  const lineItems = calculation.line_items?.data || [];
  const lineItem = lineItems[0] || {};
  const expectedReference = checkoutReference(input.userId, input.quote.sku, input.idempotencyKey);
  const calculatedAddress = calculation.customer_details?.address || {};
  const paymentAddress = confirmationToken.payment_method_preview?.billing_details?.address || {};
  const secretIsLive = secretKey.startsWith("sk_live_");
  if (
    calculation.object !== "tax.calculation" ||
    stringValue(calculation.id) !== input.taxCalculationId ||
    stringValue(calculation.currency).toLowerCase() !== input.quote.currency ||
    integerValue(calculation.tax_amount_exclusive) !== 0 ||
    taxCents < 0 ||
    taxCents > input.quote.totalCents ||
    amountTotal !== input.quote.totalCents ||
    integerValue(calculation.expires_at) <= Math.floor(Date.now() / 1000) ||
    lineItems.length !== 1 ||
    integerValue(lineItem.amount) !== input.quote.totalCents ||
    integerValue(lineItem.amount_tax) !== taxCents ||
    stringValue(lineItem.reference) !== expectedReference ||
    stringValue(lineItem.tax_behavior) !== "inclusive" ||
    stringValue(lineItem.tax_code) !== taxCode ||
    confirmationToken.object !== "confirmation_token" ||
    stringValue(confirmationToken.id) !== input.confirmationTokenId ||
    Boolean(confirmationToken.livemode) !== secretIsLive ||
    integerValue(confirmationToken.expires_at) <= Math.floor(Date.now() / 1000) ||
    confirmationToken.payment_intent != null ||
    !matchingBillingAddress(calculatedAddress, paymentAddress)
  ) {
    throw new StripeRequestError(
      400,
      input.channel === "web" ? "invalid_web_checkout" : "invalid_mobile_checkout",
    );
  }

  const params = new URLSearchParams({
    amount: String(amountTotal),
    currency: input.quote.currency,
    receipt_email: input.email,
    description: `${input.quote.paidTokens} AutoBattle tokens${input.quote.bonusTokens ? ` + ${input.quote.bonusTokens} bonus` : ""}`,
    "automatic_payment_methods[enabled]": "true",
    "hooks[inputs][tax][calculation]": input.taxCalculationId,
    "metadata[autobattle_flow]": input.channel === "web"
      ? "token_pack_web_v1"
      : "token_pack_mobile_v1",
    "metadata[autobattle_user_id]": input.userId,
    "metadata[autobattle_sku]": input.quote.sku,
    "metadata[autobattle_subtotal_cents]": String(input.quote.subtotalCents),
    "metadata[autobattle_discount_cents]": String(input.quote.discountCents),
    "metadata[autobattle_discount_percent]": String(input.quote.discountPercent),
    "metadata[autobattle_discount_entitlement_id]": input.quote.discountEntitlementId || "",
    "metadata[autobattle_pretax_total_cents]": String(input.quote.totalCents),
    "metadata[autobattle_tax_cents]": String(taxCents),
    "metadata[autobattle_tax_calculation_id]": input.taxCalculationId,
  });
  const intent = await stripeJson<{
    id?: unknown;
    object?: unknown;
    client_secret?: unknown;
    amount?: unknown;
    currency?: unknown;
  }>(
    "https://api.stripe.com/v1/payment_intents",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
    secretKey,
    `autobattle-${input.channel === "web" ? "web" : "mobile"}-intent:${input.userId}:${input.idempotencyKey}`,
  );
  const id = stringValue(intent.id);
  const clientSecret = stringValue(intent.client_secret);
  if (
    intent.object !== "payment_intent" ||
    !/^pi_[A-Za-z0-9_]+$/.test(id) ||
    !clientSecret.startsWith(`${id}_secret_`) ||
    integerValue(intent.amount) !== amountTotal ||
    stringValue(intent.currency).toLowerCase() !== input.quote.currency
  ) {
    throw new StripeRequestError(502, "invalid_payment_intent_response");
  }
  return { id, clientSecret };
}

export async function createAutoBattleWebPaymentIntent(input: {
  userId: string;
  email: string;
  quote: AutoBattleCheckoutQuote;
  confirmationTokenId: string;
  idempotencyKey: string;
}) {
  const { secretKey } = paymentConfiguration();
  const confirmationToken = await stripeJson<{
    id?: unknown;
    object?: unknown;
    expires_at?: unknown;
    livemode?: unknown;
    payment_intent?: unknown;
    payment_method_preview?: { billing_details?: { address?: Record<string, unknown> } };
  }>(
    `https://api.stripe.com/v1/confirmation_tokens/${input.confirmationTokenId}`,
    { method: "GET" },
    secretKey,
  );
  const source = confirmationToken.payment_method_preview?.billing_details?.address || {};
  const address: AutoBattleBillingAddress = {
    line1: stringValue(source.line1),
    line2: stringValue(source.line2),
    city: stringValue(source.city),
    state: stringValue(source.state),
    postalCode: stringValue(source.postal_code),
    country: stringValue(source.country).toUpperCase(),
  };
  if (
    confirmationToken.object !== "confirmation_token" ||
    stringValue(confirmationToken.id) !== input.confirmationTokenId ||
    Boolean(confirmationToken.livemode) !== secretKey.startsWith("sk_live_") ||
    integerValue(confirmationToken.expires_at) <= Math.floor(Date.now() / 1000) ||
    confirmationToken.payment_intent != null ||
    !address.line1 ||
    !address.city ||
    !address.postalCode ||
    !/^[A-Z]{2}$/.test(address.country)
  ) {
    throw new StripeRequestError(400, "invalid_web_checkout");
  }

  const taxQuote = await createAutoBattleMobileTaxQuote({
    userId: input.userId,
    quote: input.quote,
    address,
    idempotencyKey: input.idempotencyKey,
  });
  const intent = await createAutoBattleMobilePaymentIntent({
    ...input,
    taxCalculationId: taxQuote.id,
    channel: "web",
  });
  return { ...intent, quote: taxQuote };
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
