import {
  appendExpiredSessionCookies,
  appendSessionCookies,
  readCookie,
  REFRESH_COOKIE,
  refreshSession,
  requireSameOrigin,
} from "@/app/autobattle-auth";
import { noStoreJson } from "@/app/autobattle-api";
import { ensureAutoBattleAccount, getAutoBattleAccount } from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return noStoreJson({ error: "Invalid request origin." }, 403);
  const refreshToken = readCookie(request, REFRESH_COOKIE);
  if (!refreshToken) return noStoreJson({ error: "Sign in to continue." }, 401);
  try {
    const session = await refreshSession(refreshToken);
    await ensureAutoBattleAccount(session.user);
    const headers = new Headers();
    appendSessionCookies(headers, session, request);
    return noStoreJson({ ok: true, account: await getAutoBattleAccount(session.user.id) }, 200, headers);
  } catch (error) {
    console.error("AutoBattle session refresh failed", error);
    const headers = new Headers();
    appendExpiredSessionCookies(headers, request);
    return noStoreJson({ error: "Your session expired. Sign in again." }, 401, headers);
  }
}
