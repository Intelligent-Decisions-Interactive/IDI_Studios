import {
  deviceSession,
  noStoreJson,
  publicAccountError,
  requireCurrentAutoBattleRelease,
} from "@/app/autobattle-api";
import { getAutoBattleAccount, getAutoBattleCheckoutQuote } from "@/app/autobattle-db";
import {
  autoBattleStripePublishableKey,
  StripeConfigurationError,
} from "@/app/autobattle-stripe";

export const dynamic = "force-dynamic";

const PACK_SKUS = [
  "tokens_5",
  "tokens_25",
  "tokens_50",
  "tokens_100",
  "tokens_250",
  "tokens_500",
] as const;

export async function GET(request: Request) {
  try {
    const session = await deviceSession(request);
    if (!session) return noStoreJson({ error: "Link this device to buy tokens." }, 401);
    await requireCurrentAutoBattleRelease(request, session);
    const [account, packs] = await Promise.all([
      getAutoBattleAccount(session.user_id),
      Promise.all(PACK_SKUS.map((sku) => getAutoBattleCheckoutQuote(session.user_id, sku))),
    ]);
    if (!account) return noStoreJson({ error: "Your AutoBattle account is unavailable." }, 404);
    return noStoreJson({
      ok: true,
      publishableKey: autoBattleStripePublishableKey(),
      account,
      packs,
    });
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      console.error("AutoBattle mobile marketplace configuration failed", error.message);
      return noStoreJson({ error: "In-app purchases are not available yet." }, 503);
    }
    const publicError = publicAccountError(error);
    console.error("AutoBattle mobile marketplace failed", error);
    return noStoreJson({ error: publicError.message }, publicError.status);
  }
}
