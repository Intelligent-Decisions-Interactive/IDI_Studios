import {
  autoBattleClientVersion,
  autoBattleReleaseChannelForRequest,
  deviceSession,
  noStoreJson,
} from "@/app/autobattle-api";
import {
  createAutoBattleSupportTicket,
  listAutoBattleSupportTicketsForUser,
} from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set(["bug", "account", "billing", "automation", "recognition", "other"]);

function normalizedLine(value: unknown, max: number) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, max)
    : "";
}

function normalizedMessage(value: unknown, max: number) {
  return typeof value === "string"
    ? value.normalize("NFKC").replace(/\r\n?/g, "\n").trim().slice(0, max)
    : "";
}

export async function GET(request: Request) {
  try {
    const session = await deviceSession(request);
    if (!session) return noStoreJson({ error: "Link this device to continue." }, 401);
    return noStoreJson({
      ok: true,
      tickets: await listAutoBattleSupportTicketsForUser(session.user_id),
    });
  } catch (error) {
    console.error("AutoBattle support list failed", error);
    return noStoreJson({ error: "Support reports could not be loaded." }, 503);
  }
}

export async function POST(request: Request) {
  try {
    const session = await deviceSession(request);
    if (!session) return noStoreJson({ error: "Link this device to continue." }, 401);
    const releaseChannel = autoBattleReleaseChannelForRequest(request, session.release_channel);
    const applicationId = normalizedLine(request.headers.get("x-autobattle-application-id"), 120);
    const version = autoBattleClientVersion(request);
    if (
      !releaseChannel || releaseChannel !== session.release_channel ||
      !["io.intelligentdecisions.tapflow", "test.intelligentdecisions.tapflow"].includes(applicationId) ||
      !version.code || !version.name
    ) {
      return noStoreJson({ error: "This AutoBattle build cannot submit support reports." }, 400);
    }

    const body = await request.json() as Record<string, unknown>;
    const category = normalizedLine(body.category, 32).toLowerCase();
    const subject = normalizedLine(body.subject, 100);
    const message = normalizedMessage(body.message, 5000);
    const diagnostics = normalizedMessage(body.diagnostics, 49152);
    if (!CATEGORIES.has(category)) return noStoreJson({ error: "Choose a support category." }, 400);
    if (subject.length < 5) return noStoreJson({ error: "Add a short summary of the issue." }, 400);
    if (message.length < 10) return noStoreJson({ error: "Describe what happened and what you expected." }, 400);

    const ticket = await createAutoBattleSupportTicket({
      userId: session.user_id,
      category,
      subject,
      message,
      releaseChannel,
      applicationId,
      appVersionName: version.name,
      appVersionCode: version.code,
      deviceManufacturer: normalizedLine(body.deviceManufacturer, 80),
      deviceModel: normalizedLine(body.deviceModel, 120),
      androidVersion: normalizedLine(body.androidVersion, 80),
      diagnosticsExcerpt: diagnostics || null,
    });
    return noStoreJson({ ok: true, ticket }, 201);
  } catch (error) {
    console.error("AutoBattle support report creation failed", error);
    return noStoreJson({ error: "Your support report could not be submitted." }, 503);
  }
}
