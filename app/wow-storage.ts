import { env } from "cloudflare:workers";

type RuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
};

const CLIENT_BUCKET = "Client";
const CLIENT_OBJECT = "3.3.5a.zip";

function storageConfiguration() {
  const runtime = env as unknown as RuntimeEnv;
  const url = runtime.SUPABASE_URL?.trim().replace(/\/+$/, "") || "";
  const secret = runtime.SUPABASE_SECRET_KEY?.trim() || "";
  if (!url || !secret) {
    throw new Error("Supabase storage credentials are not configured.");
  }
  return { url, secret };
}

export async function createClientDownloadUrl() {
  const { url, secret } = storageConfiguration();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    apikey: secret,
  };
  if (!secret.startsWith("sb_")) headers.Authorization = `Bearer ${secret}`;

  try {
    const response = await fetch(
      `${url}/storage/v1/object/sign/${encodeURIComponent(CLIENT_BUCKET)}/${encodeURIComponent(CLIENT_OBJECT)}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ expiresIn: 5 * 60 }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`Supabase signed URL request failed (${response.status}).`);
    }

    const result = (await response.json()) as {
      signedURL?: string;
      signedUrl?: string;
    };
    const signedPath = result.signedURL || result.signedUrl || "";
    if (!signedPath) throw new Error("Supabase did not return a signed URL.");

    let downloadUrl: URL;
    if (/^https?:\/\//i.test(signedPath)) {
      downloadUrl = new URL(signedPath);
    } else if (signedPath.startsWith("/storage/v1/")) {
      downloadUrl = new URL(`${url}${signedPath}`);
    } else {
      downloadUrl = new URL(`${url}/storage/v1${signedPath.startsWith("/") ? "" : "/"}${signedPath}`);
    }
    downloadUrl.searchParams.set("download", CLIENT_OBJECT);
    return downloadUrl.toString();
  } finally {
    clearTimeout(timeout);
  }
}
