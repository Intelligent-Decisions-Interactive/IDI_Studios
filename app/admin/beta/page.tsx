import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { getAdminActorFromHeaders } from "@/app/beta-admin";
import { BetaAdminConsole } from "./beta-admin-console";
import "./admin.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Beta Operations | IDI Studios",
  robots: { index: false, follow: false, nocache: true },
};

export default async function BetaAdminPage() {
  const actor = getAdminActorFromHeaders(await headers());

  if (!actor) {
    return (
      <main className="beta-admin-denied">
        <p className="admin-eyebrow">Restricted workspace</p>
        <h1>Verified access required.</h1>
        <p>
          This console is available only through the IDI Studios Cloudflare
          Zero Trust policy or an approved secure preview account.
        </p>
        <Link href="/">Return to IDI Studios</Link>
      </main>
    );
  }

  return <BetaAdminConsole actorEmail={actor.email} actorProvider={actor.provider} />;
}
