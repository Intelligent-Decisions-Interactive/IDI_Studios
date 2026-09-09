import {
  clientAddress,
  normalizeEmail,
  requestEmailCode,
  requireSameOrigin,
  validEmail,
} from "@/app/autobattle-auth";
import { noStoreJson } from "@/app/autobattle-api";
import { verifyAutoBattleTurnstile } from "@/app/autobattle-turnstile";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return noStoreJson({ error: "Invalid request origin." }, 403);
  try {
    const body = (await request.json()) as {
      email?: unknown;
      turnstileToken?: unknown;
      website?: unknown;
    };
    if (typeof body.website === "string" && body.website.trim()) {
      return noStoreJson({ ok: true });
    }
    const email = normalizeEmail(body.email);
    const turnstileToken = typeof body.turnstileToken === "string"
      ? body.turnstileToken.trim().slice(0, 2048)
      : "";
    if (!validEmail(email)) return noStoreJson({ error: "Enter a valid email address." }, 400);
    const address = clientAddress(request);
    if (!await verifyAutoBattleTurnstile(turnstileToken, address, "autobattle_account")) {
      return noStoreJson({ error: "Complete the security check and try again." }, 403);
    }
    await requestEmailCode(email, address);
    return noStoreJson({ ok: true, message: "Check your email for the six-digit sign-in code." });
  } catch (error) {
    console.error("AutoBattle email-code request failed", error);
    const status = typeof (error as { status?: unknown })?.status === "number"
      ? (error as { status: number }).status
      : 500;
    return noStoreJson(
      { error: status === 429 ? "Wait a moment before requesting another code." : "A sign-in code could not be sent." },
      status === 429 ? 429 : 503,
    );
  }
}
