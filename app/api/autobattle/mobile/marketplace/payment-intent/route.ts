import { deviceSession, noStoreJson, publicAccountError } from "@/app/autobattle-api";
import { getAutoBattleAccount, getAutoBattleCheckoutQuote } from "@/app/autobattle-db";
import {
  createAutoBattleMobilePaymentIntent,
  StripeConfigurationError,
  StripeRequestError,
} from "@/app/autobattle-stripe";

export const dynamic = "force-dynamic";

const SKU_PATTERN = /^tokens_(5|25|50|100|250|500)$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TAX_CALCULATION_PATTERN = /^taxcalc_[A-Za-z0-9_]+$/;
const CONFIRMATION_TOKEN_PATTERN = /^ctoken_[A-Za-z0-9_]+$/;

export async function POST(request: Request) {
  try {
    const session = await deviceSession(request);
    if (!session) return noStoreJson({ error: "Link this device to buy tokens." }, 401);
    const body = await request.json() as Record<string, unknown>;
    const sku = typeof body.sku === "string" && SKU_PATTERN.test(body.sku) ? body.sku : "";
    const idempotencyKey = typeof body.idempotencyKey === "string" && UUID_PATTERN.test(body.idempotencyKey)
      ? body.idempotencyKey
      : "";
    const taxCalculationId = typeof body.taxCalculationId === "string" && TAX_CALCULATION_PATTERN.test(body.taxCalculationId)
      ? body.taxCalculationId
      : "";
    const confirmationTokenId = typeof body.confirmationTokenId === "string" && CONFIRMATION_TOKEN_PATTERN.test(body.confirmationTokenId)
      ? body.confirmationTokenId
      : "";
    if (!sku || !idempotencyKey || !taxCalculationId || !confirmationTokenId) {
      return noStoreJson({ error: "The payment request is incomplete. Start the purchase again." }, 400);
    }
    const [account, quote] = await Promise.all([
      getAutoBattleAccount(session.user_id),
      getAutoBattleCheckoutQuote(session.user_id, sku),
    ]);
    if (!account) return noStoreJson({ error: "Your AutoBattle account is unavailable." }, 404);
    const intent = await createAutoBattleMobilePaymentIntent({
      userId: session.user_id,
      email: account.email,
      quote,
      taxCalculationId,
      confirmationTokenId,
      idempotencyKey,
    });
    return noStoreJson({ ok: true, clientSecret: intent.clientSecret });
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      console.error("AutoBattle mobile payment configuration failed", error.message);
      return noStoreJson({ error: "In-app purchases are not available yet." }, 503);
    }
    if (error instanceof StripeRequestError) {
      console.error("AutoBattle mobile PaymentIntent failed", { status: error.status, code: error.code });
      return noStoreJson({ error: "Stripe could not start this payment. Start the purchase again." }, error.status >= 500 ? 502 : 400);
    }
    const publicError = publicAccountError(error);
    console.error("AutoBattle mobile PaymentIntent failed", error);
    return noStoreJson({ error: publicError.message }, publicError.status);
  }
}
