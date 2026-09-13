import {
  deviceSession,
  noStoreJson,
  publicAccountError,
  requireCurrentAutoBattleRelease,
} from "@/app/autobattle-api";
import {
  beginAutoBattleCloudBackup,
  failAutoBattleCloudBackup,
  finalizeAutoBattleCloudBackup,
  listAutoBattleCloudBackups,
} from "@/app/autobattle-db";
import {
  BACKUP_CONTENT_TYPE,
  deleteAutoBattleCloudBackupObjects,
  uploadAutoBattleCloudBackup,
} from "@/app/autobattle-cloud-storage";

export const dynamic = "force-dynamic";

const MAX_BACKUP_BYTES = 100 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;

function boundedInteger(request: Request, name: string, minimum: number, maximum: number) {
  const raw = request.headers.get(name)?.trim() || "";
  if (!/^\d{1,12}$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : null;
}

export async function GET(request: Request) {
  try {
    const session = await deviceSession(request);
    if (!session) return noStoreJson({ error: "Link this device to access cloud recovery." }, 401);
    await requireCurrentAutoBattleRelease(request, session);
    return noStoreJson({ ok: true, backups: await listAutoBattleCloudBackups(session.user_id) });
  } catch (error) {
    console.error("AutoBattle cloud backup list failed", error);
    const response = publicAccountError(error);
    return noStoreJson({ error: response.message }, response.status);
  }
}

export async function PUT(request: Request) {
  let failedSession: { userId: string; backupId: string } | null = null;
  try {
    const session = await deviceSession(request);
    if (!session) return noStoreJson({ error: "Link this device to back up profiles." }, 401);
    await requireCurrentAutoBattleRelease(request, session);

    const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    const fileBytes = boundedInteger(request, "content-length", 1, MAX_BACKUP_BYTES);
    const schemaVersion = boundedInteger(request, "x-autobattle-backup-schema", 1, 1000);
    const profileCount = boundedInteger(request, "x-autobattle-profile-count", 0, 10_000);
    const imageCount = boundedInteger(request, "x-autobattle-image-count", 0, 100_000);
    const sha256 = request.headers.get("x-autobattle-backup-sha256")?.trim().toLowerCase() || "";
    const versionName = request.headers.get("x-autobattle-version-name")?.trim() || "";
    const expectedHeader = request.headers.get("x-autobattle-base-backup-id")?.trim() || "";
    const expectedBackupId = expectedHeader && UUID_PATTERN.test(expectedHeader) ? expectedHeader : null;
    const force = request.headers.get("x-autobattle-force-replace") === "true";

    if (
      contentType !== BACKUP_CONTENT_TYPE || fileBytes == null || schemaVersion == null ||
      profileCount == null || imageCount == null || !SHA256_PATTERN.test(sha256) ||
      !VERSION_PATTERN.test(versionName) || (expectedHeader && !expectedBackupId) || !request.body
    ) {
      await request.body?.cancel();
      return noStoreJson({ error: "The profile backup request is invalid." }, 400);
    }

    const beginning = await beginAutoBattleCloudBackup({
      userId: session.user_id,
      expectedBackupId,
      force,
      sourceReleaseChannel: session.release_channel,
      sourceVersionName: versionName,
      schemaVersion,
      fileBytes,
      sha256,
      profileCount,
      imageCount,
    });
    if (!beginning.accepted || !beginning.backupId || !beginning.objectPath) {
      await request.body.cancel();
      return noStoreJson({
        error: beginning.latestStatus === "uploading"
          ? "Another device is already backing up this account. Try again shortly."
          : "A newer cloud backup exists. Restore it first or explicitly replace it.",
        conflict: true,
        latestBackupId: beginning.latestBackupId || null,
        latestCreatedAt: beginning.latestCreatedAt || null,
      }, 409);
    }

    failedSession = { userId: session.user_id, backupId: beginning.backupId };
    await uploadAutoBattleCloudBackup(beginning.objectPath, request.body);
    const backup = await finalizeAutoBattleCloudBackup(session.user_id, beginning.backupId);
    failedSession = null;
    const pruned = Array.isArray(backup.prunedObjectPaths) ? backup.prunedObjectPaths : [];
    if (pruned.length > 0) {
      deleteAutoBattleCloudBackupObjects(pruned).catch((error) => {
        console.error("AutoBattle old cloud backup cleanup failed", error);
      });
    }
    const { prunedObjectPaths: _prunedObjectPaths, ...metadata } = backup;
    return noStoreJson({ ok: true, backup: metadata }, 201);
  } catch (error) {
    if (failedSession) {
      await failAutoBattleCloudBackup(failedSession.userId, failedSession.backupId, "upload_failed")
        .catch((failure) => console.error("AutoBattle cloud backup failure marker failed", failure));
    }
    console.error("AutoBattle cloud backup upload failed", error);
    const response = publicAccountError(error);
    return noStoreJson({ error: response.message }, response.status);
  }
}
