import { getAdminActorFromHeaders } from "@/app/beta-admin";
import {
  deactivateAssignedAutoBattleInviteCodes,
  deactivateAutoBattleInviteCode,
  getAutoBattleAdminAccount,
  hasAutoBattleCampaignRedemption,
  insertClanInviteCodes,
  sha256Hex,
} from "@/app/autobattle-db";
import { noStoreJson } from "@/app/autobattle-api";
import { requireSameOrigin } from "@/app/autobattle-auth";
import { sendAutoBattleRedemptionCodeEmail } from "@/app/beta-email";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CAMPAIGN_KEY = "founding-clan";

function randomCode(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

function displayCode(code: string) {
  return code.match(/.{1,4}/g)?.join("-") || code;
}

export async function POST(request: Request, context: RouteContext) {
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

  const id = (await context.params).id.trim();
  if (!USER_ID_PATTERN.test(id)) {
    return noStoreJson({ success: false, message: "Invalid AutoBattle account." }, 400);
  }

  try {
    const account = await getAutoBattleAdminAccount(id);
    if (!account) {
      return noStoreJson({ success: false, message: "AutoBattle account not found." }, 404);
    }
    if (account.accessStatus === "suspended") {
      return noStoreJson(
        { success: false, message: "Restore this account before sending a redemption code." },
        409,
      );
    }
    if (await hasAutoBattleCampaignRedemption(id, CAMPAIGN_KEY)) {
      return noStoreJson(
        { success: false, message: "This account has already redeemed its founding code." },
        409,
      );
    }

    await deactivateAssignedAutoBattleInviteCodes(id, CAMPAIGN_KEY);
    const code = randomCode(16);
    const created = await insertClanInviteCodes([{
      code_hash: await sha256Hex(code),
      campaign_key: CAMPAIGN_KEY,
      label: "Founding clan access",
      promotional_tokens: 30,
      discount_percent: 50,
      discount_uses: 1,
      discount_unlimited: true,
      max_redemptions: 1,
      assigned_user_id: id,
      created_by: actor.email,
    }]);
    const inviteId = created[0]?.id;
    if (!inviteId) throw new Error("The redemption code was not stored.");

    try {
      await sendAutoBattleRedemptionCodeEmail(
        {
          email: account.email,
          playerName: account.playerName,
          code: displayCode(code),
        },
        `autobattle-redemption-code:${inviteId}`,
      );
    } catch (error) {
      try {
        await deactivateAutoBattleInviteCode(inviteId);
      } catch (deactivationError) {
        console.error("AutoBattle redemption-code cleanup failed", deactivationError);
      }
      throw error;
    }

    return noStoreJson({ success: true, email: account.email });
  } catch (error) {
    console.error("AutoBattle redemption-code delivery failed", error);
    return noStoreJson(
      { success: false, message: "The redemption code could not be emailed. Please try again." },
      503,
    );
  }
}
