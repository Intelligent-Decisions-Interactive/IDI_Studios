import { getAdminActorFromHeaders } from "@/app/beta-admin";
import {
  type AutoBattleAdminAccount,
  updateAutoBattleAccessStatus,
} from "@/app/autobattle-db";
import { requireSameOrigin } from "@/app/autobattle-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_STATUSES = new Set<AutoBattleAdminAccount["accessStatus"]>([
  "pending",
  "beta",
  "active",
  "suspended",
]);

export async function PATCH(request: Request, context: RouteContext) {
  if (!requireSameOrigin(request)) {
    return Response.json(
      { success: false, message: "Invalid request origin." },
      { status: 403 },
    );
  }
  const actor = await getAdminActorFromHeaders(request.headers);
  if (!actor) {
    return Response.json(
      { success: false, message: "A verified admin session is required." },
      { status: 403 },
    );
  }

  const id = (await context.params).id.trim();
  if (!USER_ID_PATTERN.test(id)) {
    return Response.json(
      { success: false, message: "Invalid AutoBattle account." },
      { status: 400 },
    );
  }

  const body = (await request.json()) as { accessStatus?: unknown };
  if (
    typeof body.accessStatus !== "string" ||
    !ALLOWED_STATUSES.has(body.accessStatus as AutoBattleAdminAccount["accessStatus"])
  ) {
    return Response.json(
      { success: false, message: "Choose a valid AutoBattle access status." },
      { status: 400 },
    );
  }

  try {
    const account = await updateAutoBattleAccessStatus(
      id,
      body.accessStatus as AutoBattleAdminAccount["accessStatus"],
    );
    return Response.json({
      success: true,
      account,
      changedBy: actor.email,
    });
  } catch (error) {
    console.error("AutoBattle admin access update failed", error);
    return Response.json(
      { success: false, message: "The AutoBattle access status could not be updated." },
      { status: 503 },
    );
  }
}
