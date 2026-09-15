import { noStoreJson } from "@/app/autobattle-api";
import { requireSameOrigin } from "@/app/autobattle-auth";
import { getAdminActorFromHeaders } from "@/app/beta-admin";
import {
  type AutoBattleSupportStatus,
  updateAutoBattleAdminSupportTicket,
} from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set<AutoBattleSupportStatus>([
  "open",
  "in_progress",
  "waiting_on_user",
  "resolved",
  "closed",
]);

function isSupportStatus(value: string): value is AutoBattleSupportStatus {
  return STATUSES.has(value as AutoBattleSupportStatus);
}

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
    return noStoreJson({ success: false, message: "Invalid support report." }, 400);
  }
  const body = await request.json() as { status?: unknown; reply?: unknown };
  const status = typeof body.status === "string" ? body.status.trim() : "";
  const reply = typeof body.reply === "string"
    ? body.reply.normalize("NFKC").replace(/\r\n?/g, "\n").trim().slice(0, 5000)
    : "";
  if (!isSupportStatus(status)) {
    return noStoreJson({ success: false, message: "Choose a valid support status." }, 400);
  }

  try {
    const ticket = await updateAutoBattleAdminSupportTicket({
      ticketId: id,
      status,
      reply,
      actorEmail: actor.email,
    });
    if (!ticket) return noStoreJson({ success: false, message: "Support report not found." }, 404);
    return noStoreJson({ success: true, ticket });
  } catch (error) {
    console.error("AutoBattle admin support update failed", { id, error });
    return noStoreJson({ success: false, message: "The support report could not be updated." }, 503);
  }
}
