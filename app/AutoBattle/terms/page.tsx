import type { Metadata } from "next";
import Link from "next/link";
import { AutoBattleLogo } from "../autobattle-logo";
import styles from "../privacy/privacy.module.css";

export const metadata: Metadata = {
  title: "AutoBattle Terms & Refunds | IDI Studios",
  description: "Purchase, token, refund, acceptable-use, and support terms for AutoBattle.",
};

export default function AutoBattleTermsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/AutoBattle" aria-label="AutoBattle home">
          <AutoBattleLogo className={styles.headerLogo} decorative eager />
        </Link>
        <Link href="/AutoBattle">← AutoBattle</Link>
      </header>

      <article className={styles.policy}>
        <p className={styles.eyebrow}>AutoBattle / Terms &amp; refunds</p>
        <h1>Know the terms.<br /><span>Run deliberately.</span></h1>
        <p className={styles.updated}>Effective for the AutoBattle public beta · September 2026</p>

        <section>
          <h2>Product and token packs</h2>
          <p>
            AutoBattle is account-backed Android software offered by IDI Studios. Token packs
            are one-time purchases, not subscriptions. One token authorizes one completed
            automation cycle under the rules shown in the app. Prices are charged in U.S.
            dollars, and checkout shows the final total, including any applicable tax, before
            you confirm payment. Purchased, bonus, and promotional tokens have no cash value
            and may not be transferred or resold.
          </p>
        </section>

        <section>
          <h2>Payment and delivery</h2>
          <p>
            Stripe processes payment information. IDI Studios does not receive your full card
            number. Purchased and bonus tokens are delivered to the signed-in AutoBattle account
            only after Stripe confirms payment to our verified webhook. If payment succeeds but
            the balance does not update, do not submit the purchase repeatedly; contact
            {" "}<a href="mailto:development@idistudios.io">development@idistudios.io</a>{" "}
            so support can investigate without duplicating a charge.
          </p>
        </section>

        <section>
          <h2>Generally non-refundable</h2>
          <p>
            Completed token purchases are generally final and non-refundable once the purchased
            credits have been delivered to the account. Tokens already consumed by completed
            automation cycles are non-refundable. You may cancel before payment confirmation by
            closing checkout. Bonus and promotional tokens are not redeemable for cash and do not
            create a refundable amount.
          </p>
        </section>

        <section>
          <h2>Limited refund review</h2>
          <p>
            Contact support promptly if you believe there was a duplicate charge, a successful
            payment for which purchased tokens were never delivered, a confirmed unauthorized
            charge, or another billing error. IDI Studios will review those circumstances and
            will provide a refund when we determine one is appropriate or when required by law.
            Approved refunds are returned to the original payment method. A token reservation
            released after a stopped or failed cycle restores that token balance; it is not a
            monetary refund.
          </p>
        </section>

        <section>
          <h2>Promotions</h2>
          <p>
            Invite, clan, bonus-token, and discount offers are governed by the terms displayed
            with that offer. Unless stated otherwise, an offer is limited to the eligible account,
            cannot be exchanged for cash, and may be denied or reversed when obtained through
            fraud, duplicate redemption, or technical abuse.
          </p>
        </section>

        <section>
          <h2>Use and account risk</h2>
          <p>
            You are responsible for the workflows you configure and for checking the rules,
            permissions, and account-risk policies of every target app. AutoBattle does not
            guarantee a particular game result, uninterrupted availability, or that a third-party
            app will permit automation. AutoBattle is independent software and is not authorized,
            affiliated with, or endorsed by Total Battle or Scorewarrior.
          </p>
        </section>

        <section>
          <h2>Support and account action</h2>
          <p>
            IDI Studios provides AutoBattle account, payment, installation, and product support.
            See the <Link href="/AutoBattle/support">support page</Link> or email
            {" "}<a href="mailto:development@idistudios.io">development@idistudios.io</a>.
            We may suspend access needed to protect users, payment systems, or the service from
            fraud, abuse, security threats, or unlawful use.
          </p>
        </section>

        <aside>
          By buying a token pack or continuing to use AutoBattle, you agree to these terms and
          the <Link href="/AutoBattle/privacy">AutoBattle Privacy Policy</Link>. If you do not
          agree, do not complete the purchase or run an automation cycle.
        </aside>
      </article>

      <footer className={styles.footer}>
        <Link href="/AutoBattle/account">Manage account</Link>
        <Link href="/AutoBattle/privacy">Privacy</Link>
        <Link href="/AutoBattle/support">Support</Link>
      </footer>
    </main>
  );
}
