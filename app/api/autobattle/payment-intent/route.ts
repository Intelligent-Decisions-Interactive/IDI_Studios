import { noStoreJson, publicAccountError, requireWebMutation, webIdentity } from "@/app/autobattle-api";
import { ensureAutoBattleAccount, getAutoBattleAccount, getAutoBattleCheckoutQuote } from "@/app/autobattle-db";
import {
  autoBattleStripePublishableKey,
  createAutoBattleWebPaymentIntent,
  StripeConfigurationError,
  StripeRequestError,
} from "@/app/autobattle-stripe";

export const dynamic = "force-dynamic";

const SKU_PATTERN = /^tokens_(5|25|50|100|250|500)$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONFIRMATION_TOKEN_PATTERN = /^ctoken_[A-Za-z0-9_]+$/;

export async function GET(request: Request) {
  try {
    const identity = await webIdentity(request);
    if (!identity) return noStoreJson({ error: "Sign in to continue." }, 401);
    await ensureAutoBattleAccount(identity);
    return noStoreJson({ ok: true, publishableKey: autoBattleStripePublishableKey() });
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      console.error("AutoBattle web marketplace configuration failed", error.message);
      return noStoreJson({ error: "Token payments are not available yet." }, 503);
    }
    const publicError = publicAccountError(error);
    console.error("AutoBattle web marketplace configuration failed", error);
    return noStoreJson({ error: publicError.message }, publicError.status);
  }
}

export async function POST(request: Request) {
  if (!requireWebMutation(request)) return noStoreJson({ error: "Invalid request origin." }, 403);
  try {
    const identity = await webIdentity(request);
    if (!identity) return noStoreJson({ error: "Sign in to continue." }, 401);
    const body = await request.json() as Record<string, unknown>;
    const sku = typeof body.sku === "string" && SKU_PATTERN.test(body.sku) ? body.sku : "";
    const idempotencyKey = typeof body.idempotencyKey === "string" && UUID_PATTERN.test(body.idempotencyKey)
      ? body.idempotencyKey
      : "";
    const confirmationTokenId = typeof body.confirmationTokenId === "string" && CONFIRMATION_TOKEN_PATTERN.test(body.confirmationTokenId)
      ? body.confirmationTokenId
      : "";
    if (!sku || !idempotencyKey || !confirmationTokenId) {
      return noStoreJson({ error: "The payment request is incomplete. Review the pack again." }, 400);
    }

    await ensureAutoBattleAccount(identity);
    const [account, quote] = await Promise.all([
      getAutoBattleAccount(identity.id),
      getAutoBattleCheckoutQuote(identity.id, sku),
    ]);
    if (!account) return noStoreJson({ error: "Your AutoBattle account is unavailable." }, 404);
    if (account.accessStatus === "suspended") {
      return noStoreJson({ error: "Purchases are unavailable while this account is suspended." }, 403);
    }
    const intent = await createAutoBattleWebPaymentIntent({
      userId: identity.id,
      email: identity.email,
      quote,
      confirmationTokenId,
      idempotencyKey,
    });
    return noStoreJson({
      ok: true,
      clientSecret: intent.clientSecret,
      quote: intent.quote,
    });
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      console.error("AutoBattle web PaymentIntent configuration failed", error.message);
      return noStoreJson({ error: "Token payments are not available yet." }, 503);
    }
    if (error instanceof StripeRequestError) {
      console.error("AutoBattle web PaymentIntent failed", { status: error.status, code: error.code });
      const message = error.code === "customer_tax_location_invalid"
        ? "Check the billing address and postal code."
        : error.code === "invalid_web_checkout"
          ? "Review the billing and payment details, then try again."
          : "Stripe could not prepare this payment. Try again shortly.";
      return noStoreJson({ error: message }, error.status >= 500 ? 502 : 400);
    }
    const publicError = publicAccountError(error);
    console.error("AutoBattle web PaymentIntent failed", error);
    return noStoreJson({ error: publicError.message }, publicError.status);
  }
}
