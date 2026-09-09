import { noStoreJson, requireWebMutation, webIdentity } from "@/app/autobattle-api";
import { createDeviceLinkCode, getAutoBattleAccount, sha256Hex } from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomCode(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export async function POST(request: Request) {
  if (!requireWebMutation(request)) return noStoreJson({ error: "Invalid request origin." }, 403);
  try {
    const identity = await webIdentity(request);
    if (!identity) return noStoreJson({ error: "Sign in to continue." }, 401);
    const account = await getAutoBattleAccount(identity.id);
    if (!account || !["beta", "active"].includes(account.accessStatus)) {
      return noStoreJson({ error: "Beta access is required before linking a device." }, 403);
    }
    if (!account.playerName) return noStoreJson({ error: "Save your player name first." }, 400);
    if (account.devices.length >= 5) {
      return noStoreJson({ error: "Revoke an older device before linking another." }, 400);
    }
    const normalized = randomCode(12);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await createDeviceLinkCode(identity.id, await sha256Hex(normalized), expiresAt);
    const code = normalized.match(/.{1,4}/g)?.join("-") || normalized;
    return noStoreJson({ ok: true, code, expiresAt });
  } catch (error) {
    console.error("AutoBattle device-link creation failed", error);
    return noStoreJson({ error: "A device-link code could not be created." }, 503);
  }
}
