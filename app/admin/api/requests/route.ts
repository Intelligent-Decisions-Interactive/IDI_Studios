import {
  adminConfiguration,
  getAdminActorFromHeaders,
} from "@/app/beta-admin";
import { listBetaRequests } from "@/app/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = getAdminActorFromHeaders(request.headers);
  if (!actor) {
    return Response.json(
      { success: false, message: "A verified admin session is required." },
      { status: 403 },
    );
  }

  const applications = await listBetaRequests();

  return Response.json({
    success: true,
    applications,
    actorEmail: actor.email,
    actorProvider: actor.provider,
    ...adminConfiguration(),
  });
}
