import { eq } from "drizzle-orm";
import {
  adminConfiguration,
  getAdminActorFromHeaders,
  getBetaRequest,
  getBetaRequestEvents,
  logBetaEvent,
} from "@/app/beta-admin";
import { sendBetaInvitation } from "@/app/beta-email";
import { getDb } from "@/db";
import { betaAccessRequests } from "@/db/schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const actor = getAdminActorFromHeaders(request.headers);
  if (!actor) {
    return Response.json(
      { success: false, message: "A verified admin session is required." },
      { status: 403 },
    );
  }

  if (!adminConfiguration().inviteEnabled) {
    return Response.json(
      { success: false, message: "BETA_INVITE_URL is not configured." },
      { status: 409 },
    );
  }

  const id = Number.parseInt((await context.params).id, 10);
  const application = Number.isSafeInteger(id) ? await getBetaRequest(id) : null;
  if (!application) {
    return Response.json(
      { success: false, message: "Beta request not found." },
      { status: 404 },
    );
  }
  if (!['approved', 'invited'].includes(application.status)) {
    return Response.json(
      { success: false, message: "Approve the applicant before inviting them." },
      { status: 409 },
    );
  }

  try {
    const result = await sendBetaInvitation(
      application,
      `beta-invite-${application.id}-${Date.now()}`,
    );
    const now = new Date();
    const [updated] = await getDb()
      .update(betaAccessRequests)
      .set({
        status: "invited",
        inviteEmailStatus: "sent",
        inviteResendId: result.id || null,
        invitedAt: now,
        reviewedAt: now,
        reviewedBy: actor.email,
        lastEmailError: null,
        updatedAt: now,
      })
      .where(eq(betaAccessRequests.id, application.id))
      .returning();

    await logBetaEvent({
      requestId: application.id,
      eventType: "invitation_sent",
      actorEmail: actor.email,
      previousStatus: application.status,
      newStatus: "invited",
    });

    return Response.json({
      success: true,
      application: updated,
      events: await getBetaRequestEvents(application.id),
      ...adminConfiguration(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invitation failed.";
    await getDb()
      .update(betaAccessRequests)
      .set({
        inviteEmailStatus: "failed",
        lastEmailError: message,
        updatedAt: new Date(),
      })
      .where(eq(betaAccessRequests.id, application.id));
    await logBetaEvent({
      requestId: application.id,
      eventType: "invitation_failed",
      actorEmail: actor.email,
      previousStatus: application.status,
      newStatus: application.status,
      details: { message },
    });
    return Response.json({ success: false, message }, { status: 502 });
  }
}
