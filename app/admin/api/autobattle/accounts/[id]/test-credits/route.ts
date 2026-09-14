import {
  canGrantAutoBattleTestCredits,
  getAdminActorFromHeaders,
} from "@/app/beta-admin";
import {
  getAutoBattleAdminAccount,
  grantAutoBattleAdminTestCredits,
} from "@/app/autobattle-db";
import { requireSameOrigin } from "@/app/autobattle-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_ID_PATTERN = USER_ID_PATTERN;

export async function POST(request: Request, context: RouteContext) {
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

  const body = (await request.json()) as { amount?: unknown; requestId?: unknown };
  if (
    typeof body.amount !== "number" ||
    !Number.isSafeInteger(body.amount) ||
    body.amount < 1 ||
    body.amount > 10_000 ||
    typeof body.requestId !== "string" ||
    !REQUEST_ID_PATTERN.test(body.requestId)
  ) {
    return Response.json(
      { success: false, message: "Choose 1 to 10,000 test credits." },
      { status: 400 },
    );
  }

  try {
    const account = await getAutoBattleAdminAccount(id);
    if (!account) {
      return Response.json(
        { success: false, message: "AutoBattle account not found." },
        { status: 404 },
      );
    }
    if (!canGrantAutoBattleTestCredits({
      actorEmail: actor.email,
      accountEmail: account.email,
    })) {
      return Response.json(
        { success: false, message: "Test credits are not enabled for this account." },
        { status: 403 },
      );
    }
    const result = await grantAutoBattleAdminTestCredits({
      userId: id,
      amount: body.amount,
      requestId: body.requestId,
      actorEmail: actor.email,
    });
    return Response.json({
      success: true,
      account: result.account,
      ledgerId: result.grant.ledgerId,
      changedBy: actor.email,
    });
  } catch (error) {
    console.error("AutoBattle test credit grant failed", error);
    return Response.json(
      { success: false, message: "The test credits could not be added." },
      { status: 503 },
    );
  }
}
