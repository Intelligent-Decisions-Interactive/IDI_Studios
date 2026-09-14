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

type SignedUrlResponse = {
  signedURL?: unknown;
  signedUrl?: unknown;
};

export async function redirectAutoBattleRelease(request: Request, policy: AutoBattleReleasePolicy) {
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
    Accept: "application/json",
    "Content-Type": "application/json",
    apikey: secret,
  };
  if (!secret.startsWith("sb_")) headers.Authorization = `Bearer ${secret}`;

  const response = await fetch(
    `${url}/storage/v1/object/sign/${encodeURIComponent(artifact.bucket)}/${artifact.object.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ expiresIn: 120 }),
    },
  );

  if (!response.ok) {
    throw new Error(`AutoBattle release storage returned ${response.status}.`);
  }

  const payload = await response.json() as SignedUrlResponse;
  const rawSignedUrl = typeof payload.signedURL === "string"
    ? payload.signedURL
    : typeof payload.signedUrl === "string"
      ? payload.signedUrl
      : "";
  if (!rawSignedUrl) throw new Error("AutoBattle release storage returned an invalid signed URL.");

  const signedUrl = /^https?:\/\//i.test(rawSignedUrl)
    ? new URL(rawSignedUrl)
    : rawSignedUrl.startsWith("/storage/v1/")
      ? new URL(`${url}${rawSignedUrl}`)
      : new URL(`${url}/storage/v1${rawSignedUrl.startsWith("/") ? "" : "/"}${rawSignedUrl}`);
  if (signedUrl.origin !== new URL(url).origin || !signedUrl.pathname.startsWith("/storage/v1/object/sign/")) {
    throw new Error("AutoBattle release storage returned an unsafe signed URL.");
  }
  signedUrl.searchParams.set("download", artifact.filename);

  return new Response(null, {
    status: 302,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Location: signedUrl.toString(),
      "Referrer-Policy": "no-referrer",
      "X-AutoBattle-SHA256": artifact.sha256,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
