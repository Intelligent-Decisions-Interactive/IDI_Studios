import type { Metadata } from "next";
import Link from "next/link";
import { AutoBattleLogo } from "../autobattle-logo";
import { AutoBattleAccountPortal } from "./account-portal";
import styles from "./account.module.css";

export const metadata: Metadata = {
  title: "AutoBattle Account | IDI Studios",
  description: "Manage your AutoBattle profile, tokens, offers, and linked Android devices.",
  robots: { index: false, follow: false },
};

export default function AutoBattleAccountPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/AutoBattle" aria-label="AutoBattle home">
          <AutoBattleLogo className={styles.headerLogo} decorative eager />
        </Link>
        <Link href="/AutoBattle">← AutoBattle</Link>
      </header>
      <AutoBattleAccountPortal />
      <footer className={styles.footer}>
        <p>AutoBattle accounts are secured by one-time email codes and revocable device access.</p>
        <div>
          <Link href="/AutoBattle/privacy">Privacy</Link>
          <a href="mailto:development@idistudios.io">Contact</a>
        </div>
      </footer>
    </main>
  );
}
