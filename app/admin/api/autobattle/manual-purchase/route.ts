import { getAdminActorFromHeaders } from "@/app/beta-admin";
import { noStoreJson } from "@/app/autobattle-api";
import { normalizeEmail, requireSameOrigin, validEmail } from "@/app/autobattle-auth";
import {
  AutoBattleDatabaseError,
  fulfillManualAutoBattlePurchase,
} from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

const VALID_SKU = /^tokens_(5|25|50|100|250|500)$/;

function purchaseError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (error instanceof AutoBattleDatabaseError && error.status === 404) {
    return { status: 404, message: error.message };
  }
  if (message.includes("payment_reference_conflict")) {
    return {
      status: 409,
      message: "That payment reference is already attached to a different purchase.",
    };
  }
  if (message.includes("account_suspended")) {
    return { status: 409, message: "This AutoBattle account is suspended." };
  }
  if (message.includes("product_unavailable")) {
    return { status: 409, message: "That token pack is not available." };
  }
  return { status: 503, message: "The purchase could not be credited." };
}

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) {
    return noStoreJson({ success: false, message: "Invalid request origin." }, 403);
  }
  const actor = getAdminActorFromHeaders(request.headers);
  if (!actor) {
    return noStoreJson(
      { success: false, message: "A verified admin session is required." },
      403,
    );
  }

  try {
    const body = (await request.json()) as {
      email?: unknown;
      sku?: unknown;
      paymentReference?: unknown;
      applyDiscount?: unknown;
    };
    const email = normalizeEmail(body.email);
    const sku = typeof body.sku === "string" ? body.sku.trim() : "";
    const paymentReference = typeof body.paymentReference === "string"
      ? body.paymentReference.trim().slice(0, 160)
      : "";

    if (!validEmail(email)) {
      return noStoreJson({ success: false, message: "Enter a valid account email." }, 400);
    }
    if (!VALID_SKU.test(sku)) {
      return noStoreJson({ success: false, message: "Choose a valid token pack." }, 400);
    }
    if (paymentReference.length < 4) {
      return noStoreJson(
        { success: false, message: "Enter the payment receipt or transaction reference." },
        400,
      );
    }

    const purchase = await fulfillManualAutoBattlePurchase({
      email,
      sku,
      paymentReference,
      createdBy: actor.email,
      applyDiscount: body.applyDiscount !== false,
    });
    return noStoreJson({ success: true, purchase });
  } catch (error) {
    console.error("AutoBattle manual purchase fulfillment failed", error);
    const response = purchaseError(error);
    return noStoreJson({ success: false, message: response.message }, response.status);
  }
}
