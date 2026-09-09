import { deviceSession, noStoreJson } from "@/app/autobattle-api";
import { getAutoBattleAccount } from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await deviceSession(request);
    if (!session) return noStoreJson({ error: "Link this device to continue." }, 401);
    return noStoreJson({ ok: true, account: await getAutoBattleAccount(session.user_id) });
  } catch (error) {
    console.error("AutoBattle mobile account read failed", error);
    return noStoreJson({ error: "Your AutoBattle account could not be loaded." }, 503);
  }
}
