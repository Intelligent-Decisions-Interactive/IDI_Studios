import { noStoreJson } from "@/app/autobattle-api";
import {
  fulfillAutoBattleStripeCheckout,
  recordAutoBattleStripeEvent,
} from "@/app/autobattle-db";
import {
  StripeConfigurationError,
  stripeLiveModeAllowed,
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
  status: "failed" | "ignored" | "needs_review",
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
      reason: status === "needs_review" ? "manual_reconciliation_required" : status,
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
    } else if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
      const session = event.data.object;
      if (stringValue(session.payment_status) !== "paid") {
        await recordReviewEvent(event, "ignored");
        return noStoreJson({ received: true });
      }
      const metadata = session.metadata && typeof session.metadata === "object"
        ? session.metadata as Record<string, unknown>
        : {};
      const totalDetails = session.total_details && typeof session.total_details === "object"
        ? session.total_details as Record<string, unknown>
        : {};
      const amountDiscount = integerValue(totalDetails.amount_discount);
      const amountShipping = integerValue(totalDetails.amount_shipping);
      const userId = stringValue(metadata.autobattle_user_id);
      const listedSubtotal = integerValue(metadata.autobattle_subtotal_cents);
      const discountCents = integerValue(metadata.autobattle_discount_cents);
      const amountSubtotal = integerValue(session.amount_subtotal);
      if (
        stringValue(session.object) !== "checkout.session" ||
        stringValue(session.mode) !== "payment" ||
        stringValue(metadata.autobattle_flow) !== "token_pack_v1" ||
        stringValue(session.client_reference_id) !== userId ||
        listedSubtotal - discountCents !== amountSubtotal ||
        amountDiscount > 0 ||
        amountShipping > 0
      ) {
        throw new Error("unexpected_stripe_adjustment");
      }
      await fulfillAutoBattleStripeCheckout({
        eventId: event.id,
        eventType: event.type,
        checkoutId: stringValue(session.id),
        paymentIntentId: objectId(session.payment_intent),
        userId,
        sku: stringValue(metadata.autobattle_sku),
        currency: stringValue(session.currency).toLowerCase(),
        amountSubtotal,
        amountTax: integerValue(totalDetails.amount_tax),
        amountTotal: integerValue(session.amount_total),
        discountPercent: integerValue(metadata.autobattle_discount_percent),
        discountEntitlementId: stringValue(metadata.autobattle_discount_entitlement_id) || null,
        liveMode: event.livemode,
      });
    } else if (["checkout.session.async_payment_failed", "payment_intent.payment_failed"].includes(event.type)) {
      await recordReviewEvent(event, "failed");
    } else if (["checkout.session.expired", "payment_intent.canceled", "payment_intent.processing"].includes(event.type)) {
      await recordReviewEvent(event, "ignored");
    } else if (["invoice.paid", "invoice.payment_failed", "charge.refunded", "credit_note.created"].includes(event.type)) {
      await recordReviewEvent(event, "needs_review");
    }
    return noStoreJson({ received: true });
  } catch (error) {
    console.error("AutoBattle Stripe event processing failed", { eventId: event.id, type: event.type, error });
    return noStoreJson({ error: "Webhook processing failed." }, 500);
  }
}
