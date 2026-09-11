import { noStoreJson } from "@/app/autobattle-api";
import {
  fulfillAutoBattleStripeCheckout,
  recordAutoBattleStripeEvent,
  recordAutoBattleStripeReviewEvent,
} from "@/app/autobattle-db";
import {
  StripeConfigurationError,
  stripeConfiguredLiveMode,
  stripeLiveModeAllowed,
  stripePaymentIntentForCharge,
  verifyStripeEvent,
} from "@/app/autobattle-stripe";

export const dynamic = "force-dynamic";

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function integerValue(value: unknown) {
  const parsed = typeof value === "string" && /^[0-9]+$/.test(value) ? Number(value) : value;
  return Number.isSafeInteger(parsed) ? Number(parsed) : -1;
}

function objectId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) return stringValue((value as { id?: unknown }).id);
  return "";
}

async function recordReviewEvent(
  event: Awaited<ReturnType<typeof verifyStripeEvent>>,
  status: "failed" | "ignored",
) {
  const object = event.data.object;
  await recordAutoBattleStripeEvent({
    eventId: event.id,
    eventType: event.type,
    objectId: stringValue(object.id),
    liveMode: event.livemode,
    status,
    details: {
      paymentIntentId: objectId(object.payment_intent),
      amount: integerValue(object.amount),
      amountRefunded: integerValue(object.amount_refunded),
      reason: status,
    },
  });
}

async function recordFinancialReviewEvent(
  event: Awaited<ReturnType<typeof verifyStripeEvent>>,
) {
  const object = event.data.object;
  const chargeId = stringValue(object.object) === "charge"
    ? stringValue(object.id)
    : objectId(object.charge);
  const paymentIntentId = objectId(object.payment_intent) || (
    chargeId ? await stripePaymentIntentForCharge(chargeId) : ""
  );
  if (!paymentIntentId.startsWith("pi_")) return;
  const amount = event.type === "charge.refunded"
    ? integerValue(object.amount_refunded)
    : integerValue(object.amount);
  const refundSucceeded = ["refund.created", "refund.updated"].includes(event.type) &&
    stringValue(object.status) === "succeeded";
  const suspendAccount = refundSucceeded || [
    "charge.refunded",
    "charge.dispute.created",
    "charge.dispute.funds_withdrawn",
  ].includes(event.type);
  await recordAutoBattleStripeReviewEvent({
    eventId: event.id,
    eventType: event.type,
    objectId: stringValue(object.id),
    paymentIntentId,
    liveMode: event.livemode,
    amount,
    suspendAccount,
    details: {
      paymentIntentId,
      chargeId,
      amount,
      currency: stringValue(object.currency).toLowerCase(),
      status: stringValue(object.status),
      reason: stringValue(object.reason) || "manual_reconciliation_required",
    },
  });
}

export async function POST(request: Request) {
  let event: Awaited<ReturnType<typeof verifyStripeEvent>>;
  try {
    event = await verifyStripeEvent(await request.text(), request.headers.get("stripe-signature"));
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      console.error("AutoBattle Stripe webhook configuration failed", error.message);
      return noStoreJson({ error: "Webhook unavailable." }, 503);
    }
    console.warn("AutoBattle rejected an invalid Stripe webhook.");
    return noStoreJson({ error: "Invalid webhook signature." }, 400);
  }

  let configuredLiveMode: boolean;
  try {
    configuredLiveMode = stripeConfiguredLiveMode();
  } catch (error) {
    console.error("AutoBattle Stripe payment configuration failed", error);
    return noStoreJson({ error: "Webhook unavailable." }, 503);
  }
  if (event.livemode !== configuredLiveMode) {
    console.error("AutoBattle rejected a Stripe event from the wrong mode", event.id);
    return noStoreJson({ error: "Stripe event mode mismatch." }, 400);
  }
  if (event.livemode && !stripeLiveModeAllowed()) {
    console.error("AutoBattle rejected a live Stripe event because live mode is disabled", event.id);
    return noStoreJson({ error: "Live Stripe events are disabled." }, 503);
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      const metadata = intent.metadata && typeof intent.metadata === "object"
        ? intent.metadata as Record<string, unknown>
        : {};
      const paymentIntentId = stringValue(intent.id);
      const userId = stringValue(metadata.autobattle_user_id);
      const paymentFlow = stringValue(metadata.autobattle_flow);
      const listedSubtotal = integerValue(metadata.autobattle_subtotal_cents);
      const discountCents = integerValue(metadata.autobattle_discount_cents);
      const amountSubtotal = integerValue(metadata.autobattle_pretax_total_cents);
      const amountTax = integerValue(metadata.autobattle_tax_cents);
      const amountTotal = integerValue(intent.amount);
      const amountReceived = integerValue(intent.amount_received);
      if (
        stringValue(intent.object) !== "payment_intent" ||
        stringValue(intent.status) !== "succeeded" ||
        !paymentIntentId.startsWith("pi_") ||
        !["token_pack_mobile_v1", "token_pack_web_v1"].includes(paymentFlow) ||
        !stringValue(metadata.autobattle_tax_calculation_id).startsWith("taxcalc_") ||
        listedSubtotal - discountCents !== amountSubtotal ||
        amountSubtotal !== amountTotal ||
        amountTax < 0 ||
        amountTax > amountTotal ||
        amountReceived !== amountTotal
      ) {
        throw new Error("unexpected_payment_intent");
      }
      await fulfillAutoBattleStripeCheckout({
        eventId: event.id,
        eventType: event.type,
        checkoutId: paymentIntentId,
        paymentIntentId,
        userId,
        sku: stringValue(metadata.autobattle_sku),
        currency: stringValue(intent.currency).toLowerCase(),
        amountSubtotal,
        amountTax,
        amountTotal,
        discountPercent: integerValue(metadata.autobattle_discount_percent),
        discountEntitlementId: stringValue(metadata.autobattle_discount_entitlement_id) || null,
        liveMode: event.livemode,
      });
    } else if (event.type === "payment_intent.payment_failed") {
      await recordReviewEvent(event, "failed");
    } else if (["payment_intent.canceled", "payment_intent.processing"].includes(event.type)) {
      await recordReviewEvent(event, "ignored");
    } else if (
      ["refund.created", "refund.updated", "refund.failed", "charge.refunded"].includes(event.type) ||
      event.type.startsWith("charge.dispute.")
    ) {
      await recordFinancialReviewEvent(event);
    }
    return noStoreJson({ received: true });
  } catch (error) {
    console.error("AutoBattle Stripe event processing failed", { eventId: event.id, type: event.type, error });
    return noStoreJson({ error: "Webhook processing failed." }, 500);
  }
}
