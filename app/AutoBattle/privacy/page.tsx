import type { Metadata } from "next";
import Link from "next/link";
import { AutoBattleLogo } from "../autobattle-logo";
import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "AutoBattle Privacy | IDI Studios",
  description: "How AutoBattle handles account, device, and workflow data.",
};

export default function AutoBattlePrivacyPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/AutoBattle" aria-label="AutoBattle home">
          <AutoBattleLogo className={styles.headerLogo} decorative eager />
        </Link>
        <Link href="/AutoBattle">← AutoBattle</Link>
      </header>

      <article className={styles.policy}>
        <p className={styles.eyebrow}>AutoBattle / Privacy</p>
        <h1>What stays local.<br /><span>What your account stores.</span></h1>
        <p className={styles.updated}>Effective for the AutoBattle public beta · September 2026</p>

        <section>
          <h2>Data stored on your AutoBattle account</h2>
          <p>
            IDI Studios stores your email address, player name, beta-access status, token
            balances and token activity, redeemed offers, and the names and last-seen times
            of devices you link. We use this data to authenticate you, operate token-based
            cycles, prevent duplicate offer redemption, and let you revoke device access.
          </p>
        </section>

        <section>
          <h2>Data that stays on your Android device</h2>
          <p>
            Your workflows, tap coordinates, image targets and cropped reference images,
            battle plans, enemy reference catalog, recognition history, and automation run
            history remain on the device. This includes targets and workflow details you create
            for apps other than Total Battle. AutoBattle does not upload screenshots, OCR text,
            troop quantities, workflow targets, or app credentials to your account.
          </p>
        </section>

        <section>
          <h2>What the app sends</h2>
          <p>
            The Android app sends an opaque device credential, a device label, and the
            minimum cycle events needed to reserve, complete, or release a token. A device
            credential can be revoked from your account. It is encrypted by Android Keystore
            on the device, while the server stores only a cryptographic hash.
          </p>
        </section>

        <section>
          <h2>Security and service providers</h2>
          <p>
            Website sign-in uses one-time email codes. Browser sessions use secure,
            HTTP-only cookies. Account records are stored with Supabase, email delivery is
            handled by the configured mail provider, and abuse checks use Cloudflare
            Turnstile. These providers process only the data needed to provide their part of
            the service.
          </p>
        </section>

        <section>
          <h2>Control and deletion</h2>
          <p>
            You can revoke linked devices from the account page. To request access,
            correction, or deletion of your account data, email
            {" "}<a href="mailto:development@idistudios.io">development@idistudios.io</a>
            {" "}from the address on the account.
          </p>
        </section>

        <aside>
          AutoBattle is a customizable Android visual-automation tool by IDI Studios. Its
          workflow core may be configured for compatible apps, and its purpose-built Total Battle
          tools are not affiliated with or endorsed by Total Battle or its publisher.
        </aside>
      </article>

      <footer className={styles.footer}>
        <Link href="/AutoBattle/account">Manage account</Link>
        <a href="mailto:development@idistudios.io">Contact</a>
      </footer>
    </main>
  );
}
