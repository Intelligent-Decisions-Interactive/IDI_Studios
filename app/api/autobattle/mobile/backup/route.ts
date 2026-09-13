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
  getAutoBattleCloudUpload,
  listAutoBattleCloudBackups,
} from "@/app/autobattle-db";
import {
  BACKUP_CONTENT_TYPE,
  createAutoBattleCloudBackupUpload,
  deleteAutoBattleCloudBackupObjects,
  verifyAutoBattleCloudBackupObject,
} from "@/app/autobattle-cloud-storage";

export const dynamic = "force-dynamic";

const MAX_BACKUP_BYTES = 100 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;

function boundedInteger(raw: unknown, minimum: number, maximum: number) {
  const value = typeof raw === "number" ? raw : NaN;
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : null;
}

async function jsonBody(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > 16_384) throw new Error("The profile backup request is invalid.");
  const value = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The profile backup request is invalid.");
  }
  return value as Record<string, unknown>;
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

export async function POST(request: Request) {
  let failedSession: { userId: string; backupId: string } | null = null;
  try {
    const session = await deviceSession(request);
    if (!session) return noStoreJson({ error: "Link this device to back up profiles." }, 401);
    await requireCurrentAutoBattleRelease(request, session);

    const body = await jsonBody(request);
    const fileBytes = boundedInteger(body.fileBytes, 1, MAX_BACKUP_BYTES);
    const schemaVersion = boundedInteger(body.schemaVersion, 1, 1000);
    const profileCount = boundedInteger(body.profileCount, 0, 10_000);
    const imageCount = boundedInteger(body.imageCount, 0, 100_000);
    const sha256 = typeof body.sha256 === "string" ? body.sha256.trim().toLowerCase() : "";
    const versionName = request.headers.get("x-autobattle-version-name")?.trim() || "";
    const expectedHeader = typeof body.baseBackupId === "string" ? body.baseBackupId.trim() : "";
    const expectedBackupId = expectedHeader && UUID_PATTERN.test(expectedHeader) ? expectedHeader : null;
    const force = body.forceReplace === true;

    if (
      fileBytes == null || schemaVersion == null ||
      profileCount == null || imageCount == null || !SHA256_PATTERN.test(sha256) ||
      !VERSION_PATTERN.test(versionName) || (expectedHeader && !expectedBackupId) ||
      (body.baseBackupId != null && body.baseBackupId !== "" && typeof body.baseBackupId !== "string") ||
      (body.forceReplace != null && typeof body.forceReplace !== "boolean")
    ) {
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
    const upload = await createAutoBattleCloudBackupUpload(beginning.objectPath);
    failedSession = null;
    return noStoreJson({
      ok: true,
      upload: {
        backupId: beginning.backupId,
        bucketName: "autobattle-profile-backups",
        objectPath: upload.objectPath,
        contentType: BACKUP_CONTENT_TYPE,
        uploadUrl: upload.uploadUrl,
      },
    }, 201);
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

export async function PATCH(request: Request) {
  try {
    const session = await deviceSession(request);
    if (!session) return noStoreJson({ error: "Link this device to finish the profile backup." }, 401);
    await requireCurrentAutoBattleRelease(request, session);
    const body = await jsonBody(request);
    const backupId = typeof body.backupId === "string" ? body.backupId.trim() : "";
    if (!UUID_PATTERN.test(backupId)) {
      return noStoreJson({ error: "The profile backup completion request is invalid." }, 400);
    }
    const pending = await getAutoBattleCloudUpload(session.user_id, backupId);
    if (!pending) return noStoreJson({ error: "That profile upload is no longer pending." }, 404);
    await verifyAutoBattleCloudBackupObject(pending.objectPath, pending.fileBytes);
    const backup = await finalizeAutoBattleCloudBackup(session.user_id, backupId);
    const pruned = Array.isArray(backup.prunedObjectPaths) ? backup.prunedObjectPaths : [];
    if (pruned.length > 0) {
      deleteAutoBattleCloudBackupObjects(pruned).catch((error) => {
        console.error("AutoBattle old cloud backup cleanup failed", error);
      });
    }
    const { prunedObjectPaths: _prunedObjectPaths, ...metadata } = backup;
    return noStoreJson({ ok: true, backup: metadata });
  } catch (error) {
    console.error("AutoBattle cloud backup completion failed", error);
    const response = publicAccountError(error);
    return noStoreJson({ error: response.message }, response.status);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await deviceSession(request);
    if (!session) return noStoreJson({ error: "Link this device to cancel a profile backup." }, 401);
    await requireCurrentAutoBattleRelease(request, session);
    const body = await jsonBody(request);
    const backupId = typeof body.backupId === "string" ? body.backupId.trim() : "";
    if (!UUID_PATTERN.test(backupId)) {
      return noStoreJson({ error: "The profile backup cancellation request is invalid." }, 400);
    }
    const pending = await getAutoBattleCloudUpload(session.user_id, backupId);
    if (pending) {
      await failAutoBattleCloudBackup(session.user_id, backupId, "client_upload_failed");
      await deleteAutoBattleCloudBackupObjects([pending.objectPath]);
    }
    return noStoreJson({ ok: true });
  } catch (error) {
    console.error("AutoBattle cloud backup cancellation failed", error);
    const response = publicAccountError(error);
    return noStoreJson({ error: response.message }, response.status);
  }
}
