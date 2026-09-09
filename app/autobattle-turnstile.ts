import { env } from "cloudflare:workers";

type RuntimeEnv = { TURNSTILE_SECRET_KEY?: string };
type TurnstileResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
};

function allowedHostname(hostname: string) {
  const value = hostname.trim().toLowerCase();
  return value === "idistudios.io" ||
    value.endsWith(".idistudios.io") ||
    value === "idistudios.sofakingbannon.chatgpt.site" ||
    value === "localhost";
}

export async function verifyAutoBattleTurnstile(
  token: string,
  remoteIp: string,
  expectedAction: string,
) {
  const secret = (env as unknown as RuntimeEnv).TURNSTILE_SECRET_KEY?.trim() || "";
  if (!secret || !token) return false;

  try {
    const form = new FormData();
    form.set("secret", secret);
    form.set("response", token);
    if (remoteIp) form.set("remoteip", remoteIp);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    if (!response.ok) return false;
    const result = (await response.json()) as TurnstileResponse;
    return Boolean(
      result.success &&
      result.action === expectedAction &&
      result.hostname &&
      allowedHostname(result.hostname),
    );
  } catch {
    return false;
  }
}
