import { noStoreJson, publicAccountError, requireWebMutation, webIdentity } from "@/app/autobattle-api";
import { ensureAutoBattleAccount, getAutoBattleCheckoutQuote } from "@/app/autobattle-db";
import {
  createAutoBattleCheckout,
  StripeConfigurationError,
  StripeRequestError,
} from "@/app/autobattle-stripe";

export const dynamic = "force-dynamic";

const SKU_PATTERN = /^tokens_(5|25|50|100|250|500)$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!requireWebMutation(request)) return noStoreJson({ error: "Invalid request origin." }, 403);
  try {
    const identity = await webIdentity(request);
    if (!identity) return noStoreJson({ error: "Sign in to continue." }, 401);
    const body = await request.json() as { sku?: unknown; idempotencyKey?: unknown };
    const sku = typeof body.sku === "string" && SKU_PATTERN.test(body.sku) ? body.sku : "";
    const idempotencyKey = typeof body.idempotencyKey === "string" && UUID_PATTERN.test(body.idempotencyKey)
      ? body.idempotencyKey
      : "";
    if (!sku || !idempotencyKey) return noStoreJson({ error: "Choose a valid token pack." }, 400);

    await ensureAutoBattleAccount(identity);
    const quote = await getAutoBattleCheckoutQuote(identity.id, sku);
    const checkout = await createAutoBattleCheckout({
      userId: identity.id,
      email: identity.email,
      quote,
      idempotencyKey,
    });
    return noStoreJson({ ok: true, checkoutUrl: checkout.url });
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      console.error("AutoBattle Stripe configuration failed", error.message);
      return noStoreJson({ error: "Token checkout is not available yet." }, 503);
    }
    if (error instanceof StripeRequestError) {
      console.error("AutoBattle Stripe checkout failed", { status: error.status, code: error.code });
      return noStoreJson({ error: "Stripe could not start checkout. Try again shortly." }, 502);
    }
    const publicError = publicAccountError(error);
    console.error("AutoBattle checkout failed", error);
    return noStoreJson({ error: publicError.message }, publicError.status);
  }
}
