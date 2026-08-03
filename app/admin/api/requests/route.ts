import { desc } from "drizzle-orm";
import {
  adminConfiguration,
  getAdminActorFromHeaders,
} from "@/app/beta-admin";
import { getDb } from "@/db";
import { betaAccessRequests } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = getAdminActorFromHeaders(request.headers);
  if (!actor) {
    return Response.json(
      { success: false, message: "A verified admin session is required." },
      { status: 403 },
    );
  }

  const applications = await getDb()
    .select()
    .from(betaAccessRequests)
    .orderBy(desc(betaAccessRequests.createdAt))
    .limit(250);

  return Response.json({
    success: true,
    applications,
    actorEmail: actor.email,
    actorProvider: actor.provider,
    ...adminConfiguration(),
  });
}
