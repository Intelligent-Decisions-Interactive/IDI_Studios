import {
  ACCESS_COOKIE,
  appendExpiredSessionCookies,
  readCookie,
  requireSameOrigin,
  revokeSession,
} from "@/app/autobattle-auth";
import { noStoreJson } from "@/app/autobattle-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return noStoreJson({ error: "Invalid request origin." }, 403);
  const accessToken = readCookie(request, ACCESS_COOKIE);
  if (accessToken) {
    try {
      await revokeSession(accessToken);
    } catch (error) {
      console.error("AutoBattle session revoke failed", error);
    }
  }
  const headers = new Headers();
  appendExpiredSessionCookies(headers, request);
  return noStoreJson({ ok: true }, 200, headers);
}
