import { deviceSession, noStoreJson } from "@/app/autobattle-api";
import { addAutoBattleSupportUserReply } from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await deviceSession(request);
    if (!session) return noStoreJson({ error: "Link this device to continue." }, 401);
    const id = (await context.params).id.trim();
    if (!UUID_PATTERN.test(id)) return noStoreJson({ error: "That support report is invalid." }, 400);
    const body = await request.json() as { message?: unknown };
    const message = typeof body.message === "string"
      ? body.message.normalize("NFKC").replace(/\r\n?/g, "\n").trim().slice(0, 5000)
      : "";
    if (!message) return noStoreJson({ error: "Enter a reply." }, 400);
    const ticket = await addAutoBattleSupportUserReply(session.user_id, id, message);
    if (!ticket) return noStoreJson({ error: "This support report is closed or unavailable." }, 409);
    return noStoreJson({ ok: true, ticket });
  } catch (error) {
    console.error("AutoBattle support reply failed", error);
    return noStoreJson({ error: "Your reply could not be sent." }, 503);
  }
}
