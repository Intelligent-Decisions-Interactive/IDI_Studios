import {
  getAdminActorFromHeaders,
  getBetaRequest,
  getBetaRequestEvents,
  logBetaEvent,
} from "@/app/beta-admin";
import { requireSameOrigin } from "@/app/autobattle-auth";
import { insertClanInviteCodes, sha256Hex } from "@/app/autobattle-db";
import { noStoreJson } from "@/app/autobattle-api";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomCode(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export async function POST(request: Request, context: RouteContext) {
  if (!requireSameOrigin(request)) return noStoreJson({ success: false, message: "Invalid request origin." }, 403);
  const actor = getAdminActorFromHeaders(request.headers);
  if (!actor) return noStoreJson({ success: false, message: "A verified admin session is required." }, 403);

  const id = Number.parseInt((await context.params).id, 10);
  const application = Number.isSafeInteger(id) && id > 0 ? await getBetaRequest(id) : null;
  if (!application) return noStoreJson({ success: false, message: "Beta request not found." }, 404);
  if (!application.testingFocus.startsWith("[AutoBattle clan access]")) {
    return noStoreJson({ success: false, message: "This is not a clan-access request." }, 409);
  }
  if (!["approved", "invited", "active"].includes(application.status)) {
    return noStoreJson({ success: false, message: "Approve the clan member before issuing a code." }, 409);
  }

  try {
    const normalized = randomCode(16);
    const [created] = await insertClanInviteCodes([{
      code_hash: await sha256Hex(normalized),
      campaign_key: "founding-clan",
      label: `Founding clan access — ${application.email}`.slice(0, 120),
      promotional_tokens: 30,
      discount_percent: 50,
      discount_uses: 1,
      discount_unlimited: true,
      max_redemptions: 1,
      created_by: actor.email,
    }]);
    await logBetaEvent({
      requestId: application.id,
      eventType: "clan_code_issued",
      actorEmail: actor.email,
      previousStatus: application.status,
      newStatus: application.status,
      details: { codeId: created?.id, campaignKey: "founding-clan" },
    });
    return noStoreJson({
      success: true,
      code: normalized.match(/.{1,4}/g)?.join("-") || normalized,
      events: await getBetaRequestEvents(application.id),
    });
  } catch (error) {
    console.error("AutoBattle clan code issuance failed", error);
    return noStoreJson({ success: false, message: "The clan access code could not be issued." }, 503);
  }
}
