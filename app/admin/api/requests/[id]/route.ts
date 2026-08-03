import {
  adminConfiguration,
  getAdminActorFromHeaders,
  getBetaRequest,
  getBetaRequestEvents,
  isBetaStatus,
  logBetaEvent,
} from "@/app/beta-admin";
import { updateBetaRequest } from "@/app/supabase";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function parseId(value: string) {
  const id = Number.parseInt(value, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(request: Request, context: RouteContext) {
  const actor = getAdminActorFromHeaders(request.headers);
  if (!actor) {
    return Response.json(
      { success: false, message: "A verified admin session is required." },
      { status: 403 },
    );
  }

  const id = parseId((await context.params).id);
  if (!id) {
    return Response.json(
      { success: false, message: "Invalid beta request." },
      { status: 400 },
    );
  }

  const application = await getBetaRequest(id);
  if (!application) {
    return Response.json(
      { success: false, message: "Beta request not found." },
      { status: 404 },
    );
  }

  return Response.json({
    success: true,
    application,
    events: await getBetaRequestEvents(id),
    ...adminConfiguration(),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const actor = getAdminActorFromHeaders(request.headers);
  if (!actor) {
    return Response.json(
      { success: false, message: "A verified admin session is required." },
      { status: 403 },
    );
  }

  const id = parseId((await context.params).id);
  if (!id) {
    return Response.json(
      { success: false, message: "Invalid beta request." },
      { status: 400 },
    );
  }

  const current = await getBetaRequest(id);
  if (!current) {
    return Response.json(
      { success: false, message: "Beta request not found." },
      { status: 404 },
    );
  }

  const body = (await request.json()) as {
    status?: unknown;
    adminNotes?: unknown;
  };
  if (!isBetaStatus(body.status)) {
    return Response.json(
      { success: false, message: "Choose a valid review status." },
      { status: 400 },
    );
  }
  if (typeof body.adminNotes !== "string" || body.adminNotes.length > 5000) {
    return Response.json(
      { success: false, message: "Admin notes must be 5,000 characters or fewer." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const application = await updateBetaRequest(id, {
      status: body.status,
      adminNotes: body.adminNotes.trim(),
      reviewedAt: now,
      reviewedBy: actor.email,
    });

  await logBetaEvent({
    requestId: id,
    eventType:
      current.status === body.status ? "review_updated" : "status_changed",
    actorEmail: actor.email,
    previousStatus: current.status,
    newStatus: body.status,
    details: { notesChanged: current.adminNotes !== body.adminNotes.trim() },
  });

  return Response.json({
    success: true,
    application,
    events: await getBetaRequestEvents(id),
    ...adminConfiguration(),
  });
}
