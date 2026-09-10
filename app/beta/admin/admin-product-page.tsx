import { headers } from "next/headers";
import Link from "next/link";
import { BetaAdminConsole, type BetaAdminProduct } from "@/app/admin/beta/beta-admin-console";
import { getAdminActorFromHeaders } from "@/app/beta-admin";

export async function AdminProductPage({ product }: { product: BetaAdminProduct }) {
  const actor = await getAdminActorFromHeaders(await headers());

  if (!actor) {
    return (
      <main className="beta-admin-denied">
        <p className="admin-eyebrow">Restricted workspace</p>
        <h1>Verified access required.</h1>
        <p>
          This console is available only through the IDI Studios Cloudflare
          Zero Trust policy.
        </p>
        <Link href="/">Return to IDI Studios</Link>
      </main>
    );
  }

  return (
    <BetaAdminConsole
      key={product}
      actorEmail={actor.email}
      actorProvider={actor.provider}
      product={product}
    />
  );
}
