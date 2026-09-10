import { getAdminActorFromHeaders } from "@/app/beta-admin";
import { listAutoBattleAdminAccounts } from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await getAdminActorFromHeaders(request.headers);
  if (!actor) {
    return Response.json(
      { success: false, message: "A verified admin session is required." },
      { status: 403 },
    );
  }

  try {
    const accounts = await listAutoBattleAdminAccounts();
    return Response.json({
      success: true,
      accounts,
      actorEmail: actor.email,
      actorProvider: actor.provider,
    });
  } catch (error) {
    console.error("AutoBattle admin account list failed", error);
    return Response.json(
      { success: false, message: "The AutoBattle account list could not be loaded." },
      { status: 503 },
    );
  }
}
