import { env } from "cloudflare:workers";
import type { AutoBattleCloudBackup } from "./autobattle-db";

const BACKUP_BUCKET = "autobattle-profile-backups";
const BACKUP_CONTENT_TYPE = "application/vnd.idistudios.autobattle-profile+zip";

type RuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
};

function configuration() {
  const runtime = env as unknown as RuntimeEnv;
  const url = runtime.SUPABASE_URL?.trim().replace(/\/+$/, "") || "";
  const secret = runtime.SUPABASE_SECRET_KEY?.trim() || "";
  if (!url || !secret) throw new Error("AutoBattle profile storage is not configured.");
  return { url, secret };
}

function storageHeaders(secret: string) {
  const headers: Record<string, string> = { apikey: secret };
  if (!secret.startsWith("sb_")) headers.Authorization = `Bearer ${secret}`;
  return headers;
}

function objectUrl(url: string, objectPath: string, authenticated = false) {
  const encoded = objectPath.split("/").map(encodeURIComponent).join("/");
  const access = authenticated ? "authenticated/" : "";
  return `${url}/storage/v1/object/${access}${encodeURIComponent(BACKUP_BUCKET)}/${encoded}`;
}

export async function uploadAutoBattleCloudBackup(objectPath: string, body: ReadableStream<Uint8Array>) {
  const { url, secret } = configuration();
  const response = await fetch(objectUrl(url, objectPath), {
    method: "POST",
    headers: {
      ...storageHeaders(secret),
      "Content-Type": BACKUP_CONTENT_TYPE,
      "Cache-Control": "private, no-store",
      "x-upsert": "false",
    },
    body,
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`AutoBattle profile upload returned ${response.status}: ${responseText.slice(0, 160)}`);
  }
}

export async function deleteAutoBattleCloudBackupObjects(objectPaths: string[]) {
  if (objectPaths.length === 0) return;
  const { url, secret } = configuration();
  const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(BACKUP_BUCKET)}`, {
    method: "DELETE",
    headers: {
      ...storageHeaders(secret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: objectPaths }),
  });
  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`AutoBattle profile cleanup returned ${response.status}: ${responseText.slice(0, 160)}`);
  }
}

export async function streamAutoBattleCloudBackup(
  request: Request,
  backup: AutoBattleCloudBackup & { objectPath: string },
) {
  const { url, secret } = configuration();
  const response = await fetch(objectUrl(url, backup.objectPath, true), {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers: {
      ...storageHeaders(secret),
      Accept: BACKUP_CONTENT_TYPE,
    },
    signal: request.signal,
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`AutoBattle profile download returned ${response.status}.`);
  }

  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Disposition": `attachment; filename="AutoBattle-${backup.id}.abprofile"`,
    "Content-Type": BACKUP_CONTENT_TYPE,
    "Referrer-Policy": "no-referrer",
    "X-AutoBattle-Backup-ID": backup.id,
    "X-AutoBattle-Backup-SHA256": backup.sha256,
    "X-Content-Type-Options": "nosniff",
  });
  headers.set("Content-Length", backup.fileBytes.toString());
  const etag = response.headers.get("etag");
  if (etag) headers.set("ETag", etag);

  return new Response(request.method === "HEAD" ? null : response.body, {
    status: 200,
    headers,
  });
}

export { BACKUP_CONTENT_TYPE };
