import {
  appendSessionCookies,
  normalizeEmail,
  requireSameOrigin,
  validEmail,
  verifyEmailCode,
} from "@/app/autobattle-auth";
import { noStoreJson } from "@/app/autobattle-api";
import { ensureAutoBattleAccount, getAutoBattleAccount } from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return noStoreJson({ error: "Invalid request origin." }, 403);
  try {
    const body = (await request.json()) as { email?: unknown; code?: unknown };
    const email = normalizeEmail(body.email);
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!validEmail(email) || !/^\d{6}$/.test(code)) {
      return noStoreJson({ error: "Enter the six-digit code from your email." }, 400);
    }
    const session = await verifyEmailCode(email, code);
    await ensureAutoBattleAccount(session.user);
    const account = await getAutoBattleAccount(session.user.id);
    const headers = new Headers();
    appendSessionCookies(headers, session, request);
    return noStoreJson({ ok: true, account }, 200, headers);
  } catch (error) {
    console.error("AutoBattle email-code verification failed", error);
    return noStoreJson({ error: "That sign-in code is invalid or has expired." }, 400);
  }
}
