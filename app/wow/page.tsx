import type { Metadata } from "next";
import Link from "next/link";
import { StudioMark } from "../studio-mark";
import styles from "./wow.module.css";

const launcher = {
  url: "",
  name: "IDI Realm Launcher",
  platform: "Windows PC",
};

export const metadata: Metadata = {
  title: "Private Realm Launcher — IDI Studios",
  description: "Unlisted launcher access for invited players on the IDI private realm.",
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
    title: "Private Realm Launcher — IDI Studios",
    description: "Unlisted launcher access for invited players on the IDI private realm.",
    type: "website",
    url: "https://idistudios.io/wow",
    siteName: "IDI Studios",
    images: [],
  },
  twitter: {
    card: "summary",
    title: "Private Realm Launcher — IDI Studios",
    description: "Unlisted launcher access for invited players on the IDI private realm.",
    images: [],
  },
};

export default function WowLauncherPage() {
  return (
    <main className={styles.page}>
      <a className={styles.skipLink} href="#launcher-content">
        Skip to launcher
      </a>

      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="IDI Studios home">
          <StudioMark />
        </Link>
        <span className={styles.accessLabel}>
          <i aria-hidden="true" /> Private access
        </span>
      </header>

      <section className={styles.hero} id="launcher-content" aria-labelledby="realm-title">
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
            One launcher for the realm, patches, and everything you need to get in.
            This access page is intentionally unlisted while the experience is being refined.
          </p>

          <div className={styles.downloadBlock}>
            {launcher.url ? (
              <a className={styles.downloadButton} href={launcher.url} download>
                <span>
                  <small>Download for {launcher.platform}</small>
                  {launcher.name}
                </span>
                <b aria-hidden="true">↓</b>
              </a>
            ) : (
              <button className={styles.downloadButton} type="button" disabled>
                <span>
                  <small>Download for {launcher.platform}</small>
                  Launcher coming soon
                </span>
                <b aria-hidden="true">…</b>
              </button>
            )}
            <p>
              The latest launcher build is being prepared. Check back here when you
              receive the go-ahead.
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
              <dd><span className={styles.statusDot} aria-hidden="true" /> Launcher in progress</dd>
            </div>
            <div>
              <dt>Platform</dt>
              <dd>{launcher.platform}</dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>Invitation only</dd>
            </div>
          </dl>
          <p>
            Keep this page handy. The download button will activate here when the
            launcher is ready.
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
              <h3>Get the launcher</h3>
              <p>Download the latest Windows build from this page.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Let it prepare</h3>
              <p>Open the launcher and let it check the files needed for the realm.</p>
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
