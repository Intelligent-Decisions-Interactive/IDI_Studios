import type { Metadata } from "next";
import Link from "next/link";
import { AutoBattleLogo } from "../autobattle-logo";
import styles from "../privacy/privacy.module.css";

export const metadata: Metadata = {
  title: "AutoBattle Support | IDI Studios",
  description: "Get help with AutoBattle accounts, payments, installation, and automation setup.",
};

export default function AutoBattleSupportPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/AutoBattle" aria-label="AutoBattle home">
          <AutoBattleLogo className={styles.headerLogo} decorative eager />
        </Link>
        <Link href="/AutoBattle">← AutoBattle</Link>
      </header>

      <article className={styles.policy}>
        <p className={styles.eyebrow}>AutoBattle / Support</p>
        <h1>Something went wrong?<br /><span>We&apos;ll help.</span></h1>
        <p className={styles.updated}>Account, payment, installation, and product support</p>

        <section>
          <h2>Contact support</h2>
          <p>
            Email <a href="mailto:development@idistudios.io">development@idistudios.io</a>{" "}
            from the address connected to your AutoBattle account. Describe what you expected,
            what happened, and the exact message shown by AutoBattle. We will review the issue
            and reply with the next useful step.
          </p>
        </section>

        <section>
          <h2>Payment or missing tokens</h2>
          <p>
            Include the purchase date, charged amount, token pack, and any Stripe receipt or
            payment reference. Do not repeat a successful charge while tokens are delayed. For
            duplicate, unauthorized, or undelivered purchases, review the
            {" "}<Link href="/AutoBattle/terms">Terms &amp; Refund Policy</Link>{" "}
            and contact us promptly.
          </p>
        </section>

        <section>
          <h2>Installation and account linking</h2>
          <p>
            Include your AutoBattle version, Android version, phone model, and whether you are
            using AutoBattle Test or AutoBattle Production. For linking problems, include the
            displayed error and generate a fresh device code if the previous code expired. Never
            email a device credential or a one-time sign-in code.
          </p>
        </section>

        <section>
          <h2>Recognition and workflow help</h2>
          <p>
            Include the workflow step, target name, app diagnostic message, and whether the
            failure repeats. A cropped image that contains only the relevant interface may help,
            but remove personal information first. Never send passwords, game credentials, full
            payment-card details, or unrelated screenshots.
          </p>
        </section>

        <section>
          <h2>Privacy or account request</h2>
          <p>
            You can revoke a linked device from the account page. For access, correction, or
            deletion requests, email us from the account address and identify the request. Read
            the <Link href="/AutoBattle/privacy">Privacy Policy</Link> for the data AutoBattle
            stores and the workflow data that remains on your phone.
          </p>
        </section>

        <aside>
          AutoBattle support will never ask for your email password, full card number, one-time
          authentication code, game password, or raw device credential.
        </aside>
      </article>

      <footer className={styles.footer}>
        <Link href="/AutoBattle/account">Manage account</Link>
        <Link href="/AutoBattle/terms">Terms &amp; refunds</Link>
        <Link href="/AutoBattle/privacy">Privacy</Link>
      </footer>
    </main>
  );
}
