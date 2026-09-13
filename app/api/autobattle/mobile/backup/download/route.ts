import {
  deviceSession,
  noStoreJson,
  publicAccountError,
  requireCurrentAutoBattleRelease,
} from "@/app/autobattle-api";
import { getAutoBattleCloudBackup } from "@/app/autobattle-db";
import { streamAutoBattleCloudBackup } from "@/app/autobattle-cloud-storage";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function download(request: Request) {
  try {
    const session = await deviceSession(request);
    if (!session) return noStoreJson({ error: "Link this device to restore profiles." }, 401);
    await requireCurrentAutoBattleRelease(request, session);
    const id = new URL(request.url).searchParams.get("id")?.trim() || "";
    if (!UUID_PATTERN.test(id)) return noStoreJson({ error: "Choose a valid cloud backup." }, 400);
    const backup = await getAutoBattleCloudBackup(session.user_id, id);
    if (!backup) return noStoreJson({ error: "That cloud backup is no longer available." }, 404);
    return streamAutoBattleCloudBackup(request, backup);
  } catch (error) {
    console.error("AutoBattle cloud backup download failed", error);
    const response = publicAccountError(error);
    return noStoreJson({ error: response.message }, response.status);
  }
}

export async function GET(request: Request) {
  return download(request);
}

export async function HEAD(request: Request) {
  return download(request);
}
