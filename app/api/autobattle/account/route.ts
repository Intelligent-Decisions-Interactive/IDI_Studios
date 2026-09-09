import { noStoreJson, requireWebMutation, webIdentity } from "@/app/autobattle-api";
import {
  ensureAutoBattleAccount,
  getAutoBattleAccount,
  updateAutoBattlePlayerName,
} from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await webIdentity(request);
    if (!identity) return noStoreJson({ error: "Sign in to continue." }, 401);
    await ensureAutoBattleAccount(identity);
    return noStoreJson({ ok: true, account: await getAutoBattleAccount(identity.id) });
  } catch (error) {
    console.error("AutoBattle account read failed", error);
    return noStoreJson({ error: "Your account could not be loaded." }, 503);
  }
}

export async function PATCH(request: Request) {
  if (!requireWebMutation(request)) return noStoreJson({ error: "Invalid request origin." }, 403);
  try {
    const identity = await webIdentity(request);
    if (!identity) return noStoreJson({ error: "Sign in to continue." }, 401);
    const body = (await request.json()) as { playerName?: unknown };
    const playerName = typeof body.playerName === "string"
      ? body.playerName.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 80)
      : "";
    if (!playerName) return noStoreJson({ error: "Enter your player name." }, 400);
    await updateAutoBattlePlayerName(identity.id, playerName);
    return noStoreJson({ ok: true, account: await getAutoBattleAccount(identity.id) });
  } catch (error) {
    console.error("AutoBattle player-name update failed", error);
    return noStoreJson({ error: "Your player name could not be saved." }, 503);
  }
}
