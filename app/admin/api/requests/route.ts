import {
  adminConfiguration,
  getAdminActorFromHeaders,
} from "@/app/beta-admin";
import { listBetaRequests } from "@/app/supabase";
import { listAutoBattleAdminAccounts } from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = getAdminActorFromHeaders(request.headers);
  if (!actor) {
    return Response.json(
      { success: false, message: "A verified admin session is required." },
      { status: 403 },
    );
  }

  const [applications, autoBattleAccounts] = await Promise.all([
    listBetaRequests(),
    listAutoBattleAdminAccounts(),
  ]);

  return Response.json({
    success: true,
    applications,
    autoBattleAccounts,
    actorEmail: actor.email,
    actorProvider: actor.provider,
    ...adminConfiguration(),
  });
}
