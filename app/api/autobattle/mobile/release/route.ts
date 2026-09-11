import { deviceSession, noStoreJson } from "@/app/autobattle-api";
import { getAutoBattleReleasePolicy } from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await deviceSession(request);
    const policy = await getAutoBattleReleasePolicy(session?.release_channel || "production");
    return noStoreJson({
      ok: true,
      release: {
        channel: policy.channel,
        requiredVersionCode: policy.requiredVersionCode,
        versionName: policy.versionName,
        apkBytes: policy.apkBytes,
        apkSha256: policy.apkSha256,
        releaseNotes: policy.releaseNotes,
        enforcementEnabled: policy.enforcementEnabled,
        publishedAt: policy.publishedAt,
        updateUrl: "/AutoBattle/account#download",
      },
    });
  } catch (error) {
    console.error("AutoBattle release policy read failed", error);
    return noStoreJson({ error: "The AutoBattle release policy is temporarily unavailable." }, 503);
  }
}
