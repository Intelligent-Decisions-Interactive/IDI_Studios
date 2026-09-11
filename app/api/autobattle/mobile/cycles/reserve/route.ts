import {
  deviceSession,
  noStoreJson,
  publicAccountError,
  requireCurrentAutoBattleRelease,
} from "@/app/autobattle-api";
import { reserveAutoBattleCycle } from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await deviceSession(request);
    if (!session) return noStoreJson({ error: "Link this device to run workflows." }, 401);
    await requireCurrentAutoBattleRelease(request, session);
    const body = (await request.json()) as { idempotencyKey?: unknown; workflowName?: unknown };
    const idempotencyKey = typeof body.idempotencyKey === "string"
      ? body.idempotencyKey.trim().slice(0, 160)
      : "";
    const workflowName = typeof body.workflowName === "string"
      ? body.workflowName.normalize("NFKC").trim().slice(0, 80)
      : "Workflow";
    if (idempotencyKey.length < 8) return noStoreJson({ error: "Invalid cycle request." }, 400);
    const reservation = await reserveAutoBattleCycle(session.user_id, idempotencyKey, workflowName);
    return noStoreJson({ ok: true, reservation });
  } catch (error) {
    console.error("AutoBattle cycle reservation failed", error);
    const response = publicAccountError(error);
    return noStoreJson({ error: response.message }, response.status);
  }
}
