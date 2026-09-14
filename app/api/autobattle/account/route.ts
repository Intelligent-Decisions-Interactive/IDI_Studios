import { noStoreJson, requireWebMutation, webIdentity } from "@/app/autobattle-api";
import {
  ensureAutoBattleAccount,
  getAutoBattleAccount,
  recordAutoBattleSignupAffiliation,
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
    const body = (await request.json()) as {
      playerName?: unknown;
      signupAffiliation?: unknown;
    };
    const changesPlayerName = Object.prototype.hasOwnProperty.call(body, "playerName");
    const changesSignupAffiliation = Object.prototype.hasOwnProperty.call(body, "signupAffiliation");
    if (changesPlayerName === changesSignupAffiliation) {
      return noStoreJson({ error: "Choose one account detail to update." }, 400);
    }
    await ensureAutoBattleAccount(identity);
    if (changesSignupAffiliation) {
      if (body.signupAffiliation !== "clan" && body.signupAffiliation !== "individual") {
        return noStoreJson({ error: "Choose whether you are a clan member." }, 400);
      }
      await recordAutoBattleSignupAffiliation(identity.id, body.signupAffiliation);
    } else {
      const playerName = typeof body.playerName === "string"
        ? body.playerName.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 80)
        : "";
      if (!playerName) return noStoreJson({ error: "Enter your player name." }, 400);
      await updateAutoBattlePlayerName(identity.id, playerName);
    }
    return noStoreJson({ ok: true, account: await getAutoBattleAccount(identity.id) });
  } catch (error) {
    console.error("AutoBattle account-detail update failed", error);
    return noStoreJson({ error: "Your account details could not be saved." }, 503);
  }
}
