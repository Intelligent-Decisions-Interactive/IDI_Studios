import {
  autoBattleReleaseChannelForRequest,
  deviceSession,
  noStoreJson,
} from "@/app/autobattle-api";
import { getAutoBattleReleasePolicy } from "@/app/autobattle-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await deviceSession(request);
    const applicationChannel = autoBattleReleaseChannelForRequest(
      request,
      session?.release_channel || "production",
    );
    if (!applicationChannel) {
      return noStoreJson(
        { error: "This AutoBattle build has been retired. Install AutoBattle Test or AutoBattle Production to continue." },
        410,
      );
    }
    if (session && session.release_channel !== applicationChannel) {
      return noStoreJson(
        { error: "This app is linked to the wrong AutoBattle release channel. Relink the account to continue." },
        409,
      );
    }
    const policy = await getAutoBattleReleasePolicy(session?.release_channel || applicationChannel);
    const artifact = policy.apkBytes != null && policy.apkSha256 != null
      ? { apkBytes: policy.apkBytes, apkSha256: policy.apkSha256 }
      : {};
    return noStoreJson({
      ok: true,
      release: {
        channel: policy.channel,
        requiredVersionCode: policy.requiredVersionCode,
        versionName: policy.versionName,
        ...artifact,
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
