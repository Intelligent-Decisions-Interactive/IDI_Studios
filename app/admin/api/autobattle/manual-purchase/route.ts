import { getAdminActorFromHeaders } from "@/app/beta-admin";
import { noStoreJson } from "@/app/autobattle-api";
import { requireSameOrigin } from "@/app/autobattle-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) {
    return noStoreJson({ success: false, message: "Invalid request origin." }, 403);
  }
  const actor = await getAdminActorFromHeaders(request.headers);
  if (!actor) {
    return noStoreJson(
      { success: false, message: "A verified admin session is required." },
      403,
    );
  }

  return noStoreJson(
    { success: false, message: "Manual token fulfillment is retired. Use the Stripe marketplace." },
    410,
  );
}
