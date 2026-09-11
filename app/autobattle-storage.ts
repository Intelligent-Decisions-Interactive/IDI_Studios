import { env } from "cloudflare:workers";
import type { AutoBattleReleasePolicy } from "./autobattle-db";

type RuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
};

function storageConfiguration() {
  const runtime = env as unknown as RuntimeEnv;
  const url = runtime.SUPABASE_URL?.trim().replace(/\/+$/, "") || "";
  const secret = runtime.SUPABASE_SECRET_KEY?.trim() || "";
  if (!url || !secret) {
    throw new Error("AutoBattle release storage is not configured.");
  }
  return { url, secret };
}

function releaseArtifact(policy: AutoBattleReleasePolicy) {
  if (!policy.bucketId || !policy.objectPath || !policy.filename || !policy.apkBytes || !policy.apkSha256) {
    throw new Error("AutoBattle release artifact is not configured.");
  }
  return {
    bucket: policy.bucketId,
    object: policy.objectPath,
    filename: policy.filename,
    bytes: policy.apkBytes,
    sha256: policy.apkSha256,
  };
}

export async function streamAutoBattleRelease(request: Request, policy: AutoBattleReleasePolicy) {
  const { url, secret } = storageConfiguration();
  const artifact = releaseArtifact(policy);
  const range = request.headers.get("range")?.trim() || "";
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) {
    return new Response(null, {
      status: 416,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Range": `bytes */${artifact.bytes}`,
      },
    });
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.android.package-archive",
    apikey: secret,
  };
  if (!secret.startsWith("sb_")) headers.Authorization = `Bearer ${secret}`;
  if (range) headers.Range = range;

  const response = await fetch(
    `${url}/storage/v1/object/authenticated/${encodeURIComponent(artifact.bucket)}/${artifact.object.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      headers,
      signal: request.signal,
    },
  );

  if (![200, 206, 416].includes(response.status)) {
    await response.body?.cancel();
    throw new Error(`AutoBattle release storage returned ${response.status}.`);
  }

  const outputHeaders = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Disposition": `attachment; filename="${artifact.filename}"`,
    "Content-Type": "application/vnd.android.package-archive",
    "Referrer-Policy": "no-referrer",
    "X-AutoBattle-SHA256": artifact.sha256,
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of ["content-length", "content-range", "etag", "last-modified"]) {
    const value = response.headers.get(name);
    if (value) outputHeaders.set(name, value);
  }

  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    headers: outputHeaders,
  });
}
