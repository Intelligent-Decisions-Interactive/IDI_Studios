import { env } from "cloudflare:workers";

type RuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
};

export const AUTOBATTLE_RELEASE = {
  bucket: "autobattle-releases",
  object: "1.0.116/AutoBattle-1.0.116-153.apk",
  filename: "AutoBattle-1.0.116-153.apk",
  versionName: "1.0.116",
  versionCode: 153,
  bytes: 80_085_944,
  sha256: "16788aaf42754fcdad92a448aa8127da53d53032dc57b922b4285be0b8bbee85",
} as const;

function storageConfiguration() {
  const runtime = env as unknown as RuntimeEnv;
  const url = runtime.SUPABASE_URL?.trim().replace(/\/+$/, "") || "";
  const secret = runtime.SUPABASE_SECRET_KEY?.trim() || "";
  if (!url || !secret) {
    throw new Error("AutoBattle release storage is not configured.");
  }
  return { url, secret };
}

function encodedObjectPath() {
  return AUTOBATTLE_RELEASE.object.split("/").map(encodeURIComponent).join("/");
}

export async function streamAutoBattleRelease(request: Request) {
  const { url, secret } = storageConfiguration();
  const range = request.headers.get("range")?.trim() || "";
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) {
    return new Response(null, {
      status: 416,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Range": `bytes */${AUTOBATTLE_RELEASE.bytes}`,
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
    `${url}/storage/v1/object/authenticated/${encodeURIComponent(AUTOBATTLE_RELEASE.bucket)}/${encodedObjectPath()}`,
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
    "Content-Disposition": `attachment; filename="${AUTOBATTLE_RELEASE.filename}"`,
    "Content-Type": "application/vnd.android.package-archive",
    "Referrer-Policy": "no-referrer",
    "X-AutoBattle-SHA256": AUTOBATTLE_RELEASE.sha256,
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
