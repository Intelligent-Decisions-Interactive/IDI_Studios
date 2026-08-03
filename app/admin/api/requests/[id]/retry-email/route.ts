import { eq } from "drizzle-orm";
import {
  adminConfiguration,
  getAdminActorFromHeaders,
  getBetaRequest,
  getBetaRequestEvents,
  logBetaEvent,
} from "@/app/beta-admin";
import {
  sendApplicantConfirmation,
  sendStudioNotification,
} from "@/app/beta-email";
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

  const id = Number.parseInt((await context.params).id, 10);
  const application = Number.isSafeInteger(id) ? await getBetaRequest(id) : null;
  if (!application) {
    return Response.json(
      { success: false, message: "Beta request not found." },
      { status: 404 },
    );
  }

  const body = (await request.json()) as { type?: unknown };
  if (body.type !== "admin" && body.type !== "applicant") {
    return Response.json(
      { success: false, message: "Choose a valid email type." },
      { status: 400 },
    );
  }

  const idempotencyKey = `beta-retry-${application.id}-${body.type}-${Date.now()}`;
  try {
    const result =
      body.type === "admin"
        ? await sendStudioNotification(application, idempotencyKey)
        : await sendApplicantConfirmation(application, idempotencyKey);
    const now = new Date();
    const [updated] = await getDb()
      .update(betaAccessRequests)
      .set(
        body.type === "admin"
          ? {
              adminEmailStatus: "sent",
              adminResendId: result.id || null,
              lastEmailError: null,
              updatedAt: now,
            }
          : {
              emailStatus: "sent",
              resendEmailId: result.id || null,
              lastEmailError: null,
              updatedAt: now,
            },
      )
      .where(eq(betaAccessRequests.id, application.id))
      .returning();

    await logBetaEvent({
      requestId: application.id,
      eventType: `${body.type}_email_retried`,
      actorEmail: actor.email,
      previousStatus: application.status,
      newStatus: application.status,
    });

    return Response.json({
      success: true,
      application: updated,
      events: await getBetaRequestEvents(application.id),
      ...adminConfiguration(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery failed.";
    await getDb()
      .update(betaAccessRequests)
      .set(
        body.type === "admin"
          ? { adminEmailStatus: "failed", lastEmailError: message, updatedAt: new Date() }
          : { emailStatus: "failed", lastEmailError: message, updatedAt: new Date() },
      )
      .where(eq(betaAccessRequests.id, application.id));
    await logBetaEvent({
      requestId: application.id,
      eventType: `${body.type}_email_failed`,
      actorEmail: actor.email,
      previousStatus: application.status,
      newStatus: application.status,
      details: { message },
    });
    return Response.json({ success: false, message }, { status: 502 });
  }
}
