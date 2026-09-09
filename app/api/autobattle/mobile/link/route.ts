import { noStoreJson, publicAccountError } from "@/app/autobattle-api";
import {
  exchangeDeviceLinkCode,
  getAutoBattleAccount,
  normalizeCode,
  sha256Hex,
} from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: unknown; deviceName?: unknown };
    const code = normalizeCode(body.code);
    const deviceName = typeof body.deviceName === "string"
      ? body.deviceName.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 120)
      : "";
    if (code.length !== 12 || !deviceName) {
      return noStoreJson({ error: "Enter the 12-character link code from your account." }, 400);
    }
    const deviceToken = randomToken();
    const session = await exchangeDeviceLinkCode(
      await sha256Hex(code),
      await sha256Hex(deviceToken),
      deviceName,
    );
    return noStoreJson({
      ok: true,
      deviceToken,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      account: await getAutoBattleAccount(session.userId),
    });
  } catch (error) {
    console.error("AutoBattle mobile link failed", error);
    const response = publicAccountError(error);
    return noStoreJson({ error: response.message }, response.status);
  }
}
