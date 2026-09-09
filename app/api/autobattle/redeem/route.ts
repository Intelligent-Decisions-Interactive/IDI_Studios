import { noStoreJson, publicAccountError, requireWebMutation, webIdentity } from "@/app/autobattle-api";
import {
  getAutoBattleAccount,
  normalizeCode,
  redeemAutoBattleInvite,
} from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!requireWebMutation(request)) return noStoreJson({ error: "Invalid request origin." }, 403);
  try {
    const identity = await webIdentity(request);
    if (!identity) return noStoreJson({ error: "Sign in to continue." }, 401);
    const body = (await request.json()) as { code?: unknown };
    const code = normalizeCode(body.code);
    if (code.length < 8) return noStoreJson({ error: "Enter a valid invite code." }, 400);
    const result = await redeemAutoBattleInvite(identity.id, code);
    return noStoreJson({ ok: true, result, account: await getAutoBattleAccount(identity.id) });
  } catch (error) {
    console.error("AutoBattle invite redemption failed", error);
    const response = publicAccountError(error);
    return noStoreJson({ error: response.message }, response.status);
  }
}
