import { getAdminActorFromHeaders } from "@/app/beta-admin";
import { noStoreJson } from "@/app/autobattle-api";
import { requireSameOrigin } from "@/app/autobattle-auth";
import { resolveAutoBattlePaymentReview } from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: RouteContext) {
  if (!requireSameOrigin(request)) {
    return noStoreJson({ success: false, message: "Invalid request origin." }, 403);
  }
  const actor = await getAdminActorFromHeaders(request.headers);
  if (!actor) {
    return noStoreJson({ success: false, message: "A verified admin session is required." }, 403);
  }

  const id = (await context.params).id.trim();
  if (!UUID_PATTERN.test(id)) {
    return noStoreJson({ success: false, message: "Invalid payment review." }, 400);
  }
  const body = await request.json() as { resolution?: unknown };
  const resolution = typeof body.resolution === "string"
    ? body.resolution.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 500)
    : "";
  if (!resolution) {
    return noStoreJson({ success: false, message: "Enter a review resolution." }, 400);
  }

  try {
    await resolveAutoBattlePaymentReview(id, resolution, actor.email);
    return noStoreJson({ success: true });
  } catch (error) {
    console.error("AutoBattle payment review resolution failed", { id, error });
    return noStoreJson({ success: false, message: "The payment review could not be resolved." }, 503);
  }
}
