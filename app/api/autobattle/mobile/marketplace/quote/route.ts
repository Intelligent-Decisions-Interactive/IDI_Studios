import { deviceSession, noStoreJson, publicAccountError } from "@/app/autobattle-api";
import { getAutoBattleCheckoutQuote } from "@/app/autobattle-db";
import {
  createAutoBattleMobileTaxQuote,
  StripeConfigurationError,
  StripeRequestError,
  type AutoBattleBillingAddress,
} from "@/app/autobattle-stripe";

export const dynamic = "force-dynamic";

const SKU_PATTERN = /^tokens_(5|25|50|100|250|500)$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function field(value: unknown, limit: number) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, limit)
    : "";
}

function address(value: unknown): AutoBattleBillingAddress | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const normalized = {
    line1: field(source.line1, 200),
    line2: field(source.line2, 200),
    city: field(source.city, 100),
    state: field(source.state, 100),
    postalCode: field(source.postalCode, 20),
    country: field(source.country, 2).toUpperCase(),
  };
  if (!normalized.line1 || !normalized.city || !normalized.postalCode || !/^[A-Z]{2}$/.test(normalized.country)) {
    return null;
  }
  return normalized;
}

export async function POST(request: Request) {
  try {
    const session = await deviceSession(request);
    if (!session) return noStoreJson({ error: "Link this device to buy tokens." }, 401);
    const body = await request.json() as Record<string, unknown>;
    const sku = typeof body.sku === "string" && SKU_PATTERN.test(body.sku) ? body.sku : "";
    const idempotencyKey = typeof body.idempotencyKey === "string" && UUID_PATTERN.test(body.idempotencyKey)
      ? body.idempotencyKey
      : "";
    const billingAddress = address(body.address);
    if (!sku || !idempotencyKey || !billingAddress) {
      return noStoreJson({ error: "Choose a pack and enter a complete billing address." }, 400);
    }
    const quote = await getAutoBattleCheckoutQuote(session.user_id, sku);
    const taxQuote = await createAutoBattleMobileTaxQuote({
      userId: session.user_id,
      quote,
      address: billingAddress,
      idempotencyKey,
    });
    return noStoreJson({ ok: true, quote: taxQuote });
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      console.error("AutoBattle mobile tax configuration failed", error.message);
      return noStoreJson({ error: "In-app purchases are not available yet." }, 503);
    }
    if (error instanceof StripeRequestError) {
      console.error("AutoBattle mobile tax quote failed", { status: error.status, code: error.code });
      const message = error.code === "customer_tax_location_invalid"
        ? "Check your billing address and postal code."
        : "Stripe could not calculate the final total. Try again shortly.";
      return noStoreJson({ error: message }, error.status >= 500 ? 502 : 400);
    }
    const publicError = publicAccountError(error);
    console.error("AutoBattle mobile tax quote failed", error);
    return noStoreJson({ error: publicError.message }, publicError.status);
  }
}
