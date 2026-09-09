import { noStoreJson, requireWebMutation, webIdentity } from "@/app/autobattle-api";
import { getAutoBattleAccount, revokeDeviceSession } from "@/app/autobattle-db";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  if (!requireWebMutation(request)) return noStoreJson({ error: "Invalid request origin." }, 403);
  try {
    const identity = await webIdentity(request);
    if (!identity) return noStoreJson({ error: "Sign in to continue." }, 401);
    const id = (await context.params).id;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return noStoreJson({ error: "Invalid device." }, 400);
    await revokeDeviceSession(identity.id, id);
    return noStoreJson({ ok: true, account: await getAutoBattleAccount(identity.id) });
  } catch (error) {
    console.error("AutoBattle device revoke failed", error);
    return noStoreJson({ error: "That device could not be revoked." }, 503);
  }
}
