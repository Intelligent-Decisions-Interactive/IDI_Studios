import { env } from "cloudflare:workers";

type RuntimeEnv = { TURNSTILE_SECRET_KEY?: string; AUTOBATTLE_PUBLIC_ORIGIN?: string };
type TurnstileResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
};

function allowedHostname(hostname: string, configuredOrigin: string) {
  const value = hostname.trim().toLowerCase();
  let configuredHostname = "";
  try {
    configuredHostname = new URL(configuredOrigin).hostname.toLowerCase();
  } catch {
    return false;
  }
  return value === configuredHostname;
}

export async function verifyAutoBattleTurnstile(
  token: string,
  remoteIp: string,
  expectedAction: string,
) {
  const runtime = env as unknown as RuntimeEnv;
  const secret = runtime.TURNSTILE_SECRET_KEY?.trim() || "";
  const configuredOrigin = runtime.AUTOBATTLE_PUBLIC_ORIGIN?.trim() || "";
  if (!secret || !token) return false;

  try {
    const form = new FormData();
    form.set("secret", secret);
    form.set("response", token);
    if (remoteIp) form.set("remoteip", remoteIp);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as TurnstileResponse;
    return Boolean(
      result.success &&
      result.action === expectedAction &&
      result.hostname &&
      allowedHostname(result.hostname, configuredOrigin),
    );
  } catch {
    return false;
  }
}
