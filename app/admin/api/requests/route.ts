import {
  adminConfiguration,
  getAdminActorFromHeaders,
} from "@/app/beta-admin";
import { listBetaRequests } from "@/app/supabase";

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
    const applications = await listBetaRequests();
    return Response.json({
      success: true,
      applications,
      actorEmail: actor.email,
      actorProvider: actor.provider,
      ...adminConfiguration(),
    });
  } catch (error) {
    console.error("Beta admin request list failed", error);
    return Response.json(
      { success: false, message: "The beta request list could not be loaded." },
      { status: 503 },
    );
  }
}
