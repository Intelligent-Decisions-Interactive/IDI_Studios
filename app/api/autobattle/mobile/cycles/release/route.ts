import { deviceSession, noStoreJson, publicAccountError } from "@/app/autobattle-api";
import { releaseAutoBattleCycle } from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await deviceSession(request);
    if (!session) return noStoreJson({ error: "Link this device to continue." }, 401);
    const body = (await request.json()) as { reservationId?: unknown };
    const reservationId = typeof body.reservationId === "string" ? body.reservationId.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(reservationId)) return noStoreJson({ error: "Invalid reservation." }, 400);
    return noStoreJson({ ok: true, reservation: await releaseAutoBattleCycle(session.user_id, reservationId) });
  } catch (error) {
    console.error("AutoBattle cycle release failed", error);
    const response = publicAccountError(error);
    return noStoreJson({ error: response.message }, response.status);
  }
}
