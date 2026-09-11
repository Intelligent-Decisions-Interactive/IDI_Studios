import { webIdentity } from "@/app/autobattle-api";
import { getAutoBattleReleaseAccessStatus, getAutoBattleReleasePolicy } from "@/app/autobattle-db";
import { streamAutoBattleRelease } from "@/app/autobattle-storage";

export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "Referrer-Policy": "no-referrer",
    },
  });
}

async function download(request: Request) {
  try {
    const identity = await webIdentity(request);
    if (!identity) return errorResponse("Sign in to download AutoBattle.", 401);
    if (!(await getAutoBattleReleaseAccessStatus(identity.id))) {
      return errorResponse("Your AutoBattle account has not been approved yet.", 403);
    }
    return streamAutoBattleRelease(request, await getAutoBattleReleasePolicy("production"));
  } catch (error) {
    console.error("AutoBattle release download failed", error);
    return errorResponse("The AutoBattle download is temporarily unavailable.", 503);
  }
}

export async function GET(request: Request) {
  return download(request);
}

export async function HEAD(request: Request) {
  return download(request);
}
