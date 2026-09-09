import { deviceSession, noStoreJson } from "@/app/autobattle-api";
import { revokeDeviceSession } from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await deviceSession(request);
    if (!session) return noStoreJson({ error: "This device is not linked." }, 401);
    await revokeDeviceSession(session.user_id, session.id);
    return noStoreJson({ ok: true });
  } catch (error) {
    console.error("AutoBattle mobile unlink failed", error);
    return noStoreJson({ error: "This device could not be unlinked." }, 503);
  }
}
