import {
  noStoreJson,
  publicAccountError,
  requireWebMutation,
  webIdentity,
} from "@/app/autobattle-api";
import {
  claimAutoBattleReferral,
  ensureAutoBattleAccount,
  getAutoBattleAccount,
  normalizeCode,
} from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!requireWebMutation(request)) {
    return noStoreJson({ error: "Invalid request origin." }, 403);
  }
  try {
    const identity = await webIdentity(request);
    if (!identity) return noStoreJson({ error: "Sign in to claim this referral." }, 401);
    const body = await request.json() as { code?: unknown };
    const code = normalizeCode(body.code);
    if (!/^[A-F0-9]{12}$/.test(code)) {
      return noStoreJson({ error: "That referral code is invalid." }, 400);
    }

    await ensureAutoBattleAccount(identity);
    const claim = await claimAutoBattleReferral(identity.id, code);
    return noStoreJson({
      ok: true,
      claim,
      account: await getAutoBattleAccount(identity.id),
    });
  } catch (error) {
    const publicError = publicAccountError(error);
    console.error("AutoBattle referral claim failed", error);
    return noStoreJson({ error: publicError.message }, publicError.status);
  }
}
