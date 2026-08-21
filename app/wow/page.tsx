import type { Metadata } from "next";
import Link from "next/link";
import { StudioMark } from "../studio-mark";
import styles from "./wow.module.css";

const launcher = {
  url: "/wow/downloads/Illidans-Visage-Live-Launcher.zip",
  name: "Illidan’s Visage Launcher",
  fileName: "Illidans Visage Live Launcher.zip",
  size: "626 KB",
  platform: "Windows PC",
};

const client = {
  url: "https://mbptywurviigpgigghna.supabase.co/storage/v1/object/public/Client/3.3.5a.zip",
  name: "Full game client",
  version: "3.3.5a",
  size: "16.6 GB",
  platform: "Windows PC",
};

export const metadata: Metadata = {
  title: "Private Realm Downloads — IDI Studios",
  description: "Unlisted client and launcher downloads for invited players on the IDI private realm.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  openGraph: {
    title: "Private Realm Downloads — IDI Studios",
    description: "Unlisted client and launcher downloads for invited players on the IDI private realm.",
    type: "website",
    url: "https://idistudios.io/wow",
    siteName: "IDI Studios",
    images: [],
  },
  twitter: {
    card: "summary",
    title: "Private Realm Downloads — IDI Studios",
    description: "Unlisted client and launcher downloads for invited players on the IDI private realm.",
    images: [],
  },
};

export default function WowLauncherPage() {
  return (
    <main className={styles.page}>
      <a className={styles.skipLink} href="#downloads-content">
        Skip to downloads
      </a>

      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="IDI Studios home">
          <StudioMark />
        </Link>
        <span className={styles.accessLabel}>
          <i aria-hidden="true" /> Private access
        </span>
      </header>

      <section className={styles.hero} id="downloads-content" aria-labelledby="realm-title">
        <div className={styles.ambient} aria-hidden="true">
          <span className={styles.ringOne} />
          <span className={styles.ringTwo} />
          <span className={styles.ringThree} />
        </div>

        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>IDI private realm / Invited players only</p>
          <h1 id="realm-title">
            Your road back
            <span>starts here.</span>
          </h1>
          <p className={styles.intro}>
            Get the full client and the realm launcher in one place. This access
            page is intentionally unlisted while the experience is being refined.
          </p>

          <div className={styles.downloadBlock}>
            <a className={styles.downloadButton} href={client.url}>
              <span>
                <small>{client.version} / {client.platform} / {client.size}</small>
                {client.name}
              </span>
              <b aria-hidden="true">↓</b>
            </a>

            {launcher.url ? (
              <a
                className={`${styles.downloadButton} ${styles.downloadButtonSecondary}`}
                href={launcher.url}
                download={launcher.fileName}
              >
                <span>
                  <small>Download for {launcher.platform}</small>
                  {launcher.name}
                </span>
                <b aria-hidden="true">↓</b>
              </a>
            ) : (
              <button className={`${styles.downloadButton} ${styles.downloadButtonSecondary}`} type="button" disabled>
                <span>
                  <small>Download for {launcher.platform}</small>
                  Launcher coming soon
                </span>
                <b aria-hidden="true">…</b>
              </button>
            )}
            <p>
              Start with the full client if you do not already have version {client.version}.
              The smaller launcher archive is {launcher.size} and includes
              <strong> START HERE.txt</strong>.
            </p>
          </div>
        </div>

        <aside className={styles.realmCard} aria-label="Realm access details">
          <div className={styles.cardHeading}>
            <span>Realm access</span>
            <i aria-hidden="true" />
          </div>
          <dl>
            <div>
              <dt>Status</dt>
              <dd><span className={styles.statusDot} aria-hidden="true" /> Downloads ready</dd>
            </div>
            <div>
              <dt>Platform</dt>
              <dd>{launcher.platform}</dd>
            </div>
            <div>
              <dt>Client</dt>
              <dd>{client.version} / {client.size}</dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>Invitation only</dd>
            </div>
          </dl>
          <p>
            Keep this page handy. Future client and launcher builds will be
            published here.
          </p>
        </aside>

        <p className={styles.coordinate}>IDI / REALM ACCESS / 001</p>
      </section>

      <section className={styles.steps} aria-labelledby="steps-title">
        <div className={styles.stepsIntro}>
          <p className={styles.eyebrow}>When access opens</p>
          <h2 id="steps-title">Three steps.<br />Then you’re in.</h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <h3>Get the client</h3>
              <p>Download and extract the full 3.3.5a Windows client if you need it.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Add the launcher</h3>
              <p>Download the realm launcher and follow the included START HERE instructions.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Enter the realm</h3>
              <p>Use the account details supplied with your invitation.</p>
            </div>
          </li>
        </ol>
      </section>

      <footer className={styles.footer}>
        <StudioMark />
        <p>Unlisted route / Search indexing disabled</p>
        <Link href="/">Studio home ↑</Link>
      </footer>
    </main>
  );
}
