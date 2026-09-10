import { ACCESS_COOKIE, getIdentity, readCookie, requireSameOrigin } from "./autobattle-auth";
import { authenticateDeviceToken } from "./autobattle-db";

export function noStoreJson(body: unknown, status = 200, headers?: Headers) {
  const responseHeaders = headers || new Headers();
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

export async function webIdentity(request: Request) {
  const accessToken = readCookie(request, ACCESS_COOKIE);
  if (!accessToken) return null;
  try {
    return await getIdentity(accessToken);
  } catch {
    return null;
  }
}

export function requireWebMutation(request: Request) {
  return requireSameOrigin(request);
}

export async function deviceSession(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() || "";
  const match = /^Bearer\s+([A-Za-z0-9_-]{40,200})$/i.exec(authorization);
  if (!match) return null;
  return authenticateDeviceToken(match[1]);
}

export function publicAccountError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("token_balance_integrity_violation")) {
    return { status: 503, message: "This account requires token reconciliation before it can continue." };
  }
  if (message.includes("insufficient_tokens")) {
    return { status: 402, message: "Your account does not have enough tokens for another cycle." };
  }
  if (message.includes("account_not_authorized")) {
    return { status: 403, message: "This account does not have AutoBattle beta access yet." };
  }
  if (message.includes("invalid_invite_code") || message.includes("invite_code_exhausted")) {
    return { status: 400, message: "That invite code is invalid or no longer available." };
  }
  if (message.includes("invalid_device_link_code")) {
    return { status: 400, message: "That device-link code is invalid or has expired." };
  }
  if (message.includes("device_limit_reached")) {
    return { status: 400, message: "Revoke an older device before linking another." };
  }
  if (message.includes("reservation_not_found")) {
    return { status: 404, message: "The cycle reservation was not found." };
  }
  if (message.includes("product_unavailable")) {
    return { status: 400, message: "That token pack is not available." };
  }
  if (message.includes("account_suspended")) {
    return { status: 403, message: "Purchases are unavailable for this account." };
  }
  return { status: 500, message: "The AutoBattle account service could not complete this request." };
}
