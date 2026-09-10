import { getAdminActorFromHeaders } from "@/app/beta-admin";
import { insertClanInviteCodes, sha256Hex } from "@/app/autobattle-db";
import { noStoreJson } from "@/app/autobattle-api";
import { requireSameOrigin } from "@/app/autobattle-auth";

export const dynamic = "force-dynamic";
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomCode(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return noStoreJson({ error: "Invalid request origin." }, 403);
  const actor = await getAdminActorFromHeaders(request.headers);
  if (!actor) return noStoreJson({ error: "A verified admin session is required." }, 403);
  try {
    const body = (await request.json()) as {
      count?: unknown;
      label?: unknown;
      campaignKey?: unknown;
    };
    const count = typeof body.count === "number" && Number.isInteger(body.count)
      ? Math.min(50, Math.max(1, body.count))
      : 1;
    const label = typeof body.label === "string"
      ? body.label.normalize("NFKC").trim().slice(0, 120)
      : "Founding clan access";
    const campaignKey = typeof body.campaignKey === "string"
      ? body.campaignKey.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64)
      : "founding-clan";
    if (!label || campaignKey.length < 3) return noStoreJson({ error: "Invalid campaign details." }, 400);

    const codes = Array.from({ length: count }, () => randomCode(16));
    const rows = await Promise.all(codes.map(async (code) => ({
      code_hash: await sha256Hex(code),
      campaign_key: campaignKey,
      label,
      promotional_tokens: 30,
      discount_percent: 50,
      discount_uses: 1,
      discount_unlimited: true,
      max_redemptions: 1,
      created_by: actor.email,
    })));
    const created = await insertClanInviteCodes(rows);
    return noStoreJson({
      ok: true,
      campaignKey,
      codes: codes.map((code, index) => ({
        id: created[index]?.id,
        code: code.match(/.{1,4}/g)?.join("-") || code,
      })),
      warning: "These plaintext codes are shown once. Store them securely.",
    });
  } catch (error) {
    console.error("AutoBattle clan-code creation failed", error);
    return noStoreJson({ error: "Clan invite codes could not be created." }, 503);
  }
}
