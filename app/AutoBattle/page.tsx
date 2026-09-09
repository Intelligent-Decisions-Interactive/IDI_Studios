/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { BetaAccessModal, BetaAccessTrigger } from "../beta-access-form";
import { StudioMark } from "../studio-mark";
import { AUTOBATTLE_PRODUCTS, formatUsd } from "../autobattle-products";
import { AutoBattleLogo } from "./autobattle-logo";
import styles from "./autobattle.module.css";

const systems = [
  {
    number: "01",
    title: "Tap by position or image",
    copy: "Mix fixed-coordinate taps with your own reference images, relative anchors, and scale-aware matching in the same workflow.",
    signal: "Hybrid autoclicker",
  },
  {
    number: "02",
    title: "Build the routine",
    copy: "Arrange steps, tap repetitions, wait ranges, sets, and queues into reusable profiles you can control over the app you are automating.",
    signal: "Custom workflows",
  },
  {
    number: "03",
    title: "Add the battle brain",
    copy: "For Total Battle, the specialized Dex, encounter scanning, march planning, troop filling, and live timing connect strategy directly to execution.",
    signal: "Total Battle specialization",
  },
];

export const metadata: Metadata = {
  title: "AutoBattle — Visual Autoclicker & Workflow Engine | IDI Studios",
  description:
    "Build customizable Android workflows that combine coordinate taps with user-supplied image recognition. Includes purpose-built Total Battle Dex and strategy tools.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "AutoBattle — Custom Visual Workflows for Android",
    description: "A hybrid autoclicker that mixes coordinate taps, image targets, reusable workflows, and purpose-built Total Battle intelligence.",
    type: "website",
    url: "https://idistudios.io/AutoBattle",
    siteName: "IDI Studios",
    images: [{
      url: "/assets/autobattle/autobattle-social-card.png",
      width: 1200,
      height: 630,
      alt: "AutoBattle Android strategy engine — Outplan. Outrun. Outrank.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AutoBattle — Custom Visual Workflows for Android",
    description: "Build with coordinates and your own images. Run reusable workflows over Android apps. Go deeper with Total Battle tools.",
    images: ["/assets/autobattle/autobattle-social-card.png"],
  },
};

export default function AutoBattlePage() {
  return (
    <main className={styles.page}>
      <a className={styles.skipLink} href="#autobattle-content">
        Skip to AutoBattle
      </a>

      <header className={styles.header}>
        <Link className={styles.brand} href="/AutoBattle" aria-label="AutoBattle home">
          <AutoBattleLogo className={styles.brandLogo} decorative eager />
        </Link>
        <nav aria-label="AutoBattle navigation">
          <a href="#overlay">How it works</a>
          <a href="#proof">Proof</a>
          <a href="#systems">The engine</a>
          <a href="#tokens">Tokens</a>
        </nav>
        <div className={styles.headerActions}>
          <Link className={styles.accountLink} href="/AutoBattle/account">Account</Link>
          <BetaAccessTrigger className={styles.accessLink} product="autobattle-clan">
            Request access <span aria-hidden="true">↗</span>
          </BetaAccessTrigger>
        </div>
      </header>

      <div id="autobattle-content">
        <section className={styles.hero} aria-labelledby="autobattle-title">
          <div className={styles.heroGrid} aria-hidden="true" />
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Hybrid autoclicker / Custom visual workflows</p>
            <AutoBattleLogo className={styles.heroLogo} eager />
            <h1 id="autobattle-title">
              Point it.<br />Teach it.<br /><span>Run it.</span>
            </h1>
            <p className={styles.intro}>
              AutoBattle combines coordinate tapping and user-supplied image recognition in
              customizable Android workflows. It was designed for Total Battle—with a built-in
              Dex, march planning, and battle tools—but its core can be configured for other apps
              when you provide the right images and steps.
            </p>
            <p className={styles.overlaySignal}>
              <span aria-hidden="true" /> Runs over the app you choose
              <small>Total Battle specialist tools included</small>
            </p>
            <div className={styles.heroActions}>
              <BetaAccessTrigger className={styles.primaryButton} product="autobattle-clan">
                Request founding access <span aria-hidden="true">↗</span>
              </BetaAccessTrigger>
              <a className={styles.textLink} href="#clan-access">
                Clan member? See your offer <span aria-hidden="true">↓</span>
              </a>
            </div>
            <p className={styles.costLine}>
              <strong>Build and edit freely.</strong> One completed automation cycle uses one token.
            </p>
          </div>

          <aside className={styles.heroProof} aria-label="Ascended leaderboard result">
            <div className={styles.proofTopline}>
              <span>Proven in Total Battle / Live clan data</span>
              <i aria-hidden="true" />
            </div>
            <div className={styles.rankPanel}>
              <span className={styles.rank}>#1</span>
              <div>
                <strong>Ascended</strong>
                <small>59.9M · City 34 · G5</small>
              </div>
            </div>
            <dl className={styles.quickStats}>
              <div><dt>Score</dt><dd>6,805</dd></div>
              <div><dt>Chests</dt><dd>267</dd></div>
              <div><dt>Lead</dt><dd>+40.2%</dd></div>
            </dl>
            <p>
              A 59.9M account finished 1,950 points ahead of second place while the
              next account showed more than sixteen times the power.
            </p>
          </aside>

          <p className={styles.coordinate}>IDI / AUTOBATTLE / FOUNDING RELEASE 001</p>
        </section>

        <div className={styles.signalBar} aria-label="AutoBattle capabilities">
          <div>
            <span>Coordinate taps</span><i>◆</i><span>Your image targets</span><i>◆</i><span>Custom workflows</span><i>◆</i>
            <span>Reusable profiles</span><i>◆</i><span>Floating controls</span><i>◆</i>
            <span>Local learning</span><i>◆</i><span>Total Battle Dex</span><i>◆</i><span>Coordinate taps</span><i>◆</i>
            <span>Your image targets</span><i>◆</i><span>Custom workflows</span><i>◆</i>
          </div>
        </div>

        <section className={styles.overlay} id="overlay" aria-labelledby="overlay-title">
          <div className={styles.shell}>
            <div className={styles.overlayCopy}>
              <p className={styles.eyebrow}>Android overlay / Visual + coordinate actions</p>
              <h2 id="overlay-title">Build the<br /><span>workflow.</span></h2>
              <p>
                Keep the target app in view while AutoBattle runs the routine you designed.
                Use coordinates when the layout is stable, image targets when elements move,
                and combine both approaches in saved profiles and queued workflow sets.
              </p>
              <dl className={styles.overlayBenefits}>
                <div>
                  <dt>01 / Keep the app active</dt>
                  <dd>The floating controller stays over your chosen app, while touches outside it pass through.</dd>
                </div>
                <div>
                  <dt>02 / Mix tap methods</dt>
                  <dd>Use fixed points, visual objects, and reference-relative anchors wherever each method fits best.</dd>
                </div>
                <div>
                  <dt>03 / Shape the routine</dt>
                  <dd>Configure repeated taps, randomized waits, multiple sets, queues, and continuous runs.</dd>
                </div>
                <div>
                  <dt>04 / Bring your own targets</dt>
                  <dd>Supply reference images and configure the steps for another app; compatibility depends on its interface and rules.</dd>
                </div>
              </dl>
            </div>

            <div
              className={styles.overlayDemo}
              role="img"
              aria-label="AutoBattle floating controls deployed over a live Total Battle game screen"
            >
              <div className={styles.gameTopline}>
                <span>Total Battle / Live screen</span>
                <b><i aria-hidden="true" /> Game in focus</b>
              </div>
              <div className={styles.gameField} aria-hidden="true">
                <span className={`${styles.mapTarget} ${styles.mapTargetOne}`}><b>1</b><small>Crypt</small></span>
                <span className={`${styles.mapTarget} ${styles.mapTargetTwo}`}><b>2</b><small>March</small></span>
                <span className={`${styles.mapTarget} ${styles.mapTargetThree}`}><b>3</b><small>Return</small></span>
                <i className={styles.mapRoute} />
              </div>
              <div className={styles.overlayController} aria-hidden="true">
                <div className={styles.controlRail}>
                  <span>≡</span>
                  <span>+</span>
                  <span>−</span>
                  <strong>▶</strong>
                  <span className={styles.wordControl}>Plan</span>
                  <span className={styles.wordControl}>App</span>
                  <span className={styles.closeControl}>×</span>
                </div>
                <div className={styles.profileControl}>
                  <b>Profile</b><span>Crypt cycle</span><i>▾</i>
                </div>
              </div>
              <p className={styles.overlayDemoCaption}>
                <b>AB</b><span>Total Battle example / The workflow core is configurable</span>
              </p>
            </div>
          </div>
        </section>

        <section className={styles.proof} id="proof" aria-labelledby="proof-title">
          <div className={styles.shell}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Built inside the real routine</p>
                <h2 id="proof-title">The result<br /><span>came first.</span></h2>
              </div>
              <p>
                AutoBattle began as the system behind Ascended. The product follows
                the same loop that produced the lead: read what is happening, choose
                the correct response, execute it accurately, and return on time.
              </p>
            </div>

            <div className={styles.evidenceGrid}>
              <figure className={styles.primaryEvidence}>
                <div className={styles.phoneFrame}>
                  <img
                    src="/assets/autobattle/ascended-leaderboard.jpg"
                    alt="Clan leaderboard showing Ascended ranked first with 6,805 points and 267 chests"
                    loading="lazy"
                  />
                </div>
                <figcaption>
                  <span>01 / Leaderboard</span>
                  <strong>6,805 points. 267 chests.</strong>
                  <p>The final margin was 1,950 points over second place.</p>
                </figcaption>
              </figure>

              <div className={styles.proofLedger}>
                <p className={styles.ledgerLabel}>Measured advantage</p>
                <dl>
                  <div><dt>Score lead</dt><dd>40.2%</dd></div>
                  <div><dt>Chest ratio</dt><dd>2.59×</dd></div>
                  <div><dt>Power multiple faced</dt><dd>16.4×</dd></div>
                  <div><dt>Final position</dt><dd>#1</dd></div>
                </dl>
                <p className={styles.ledgerNote}>
                  Account power alone did not make this result. Timing, repetition,
                  preparation, and reliable execution did.
                </p>
              </div>

              <figure className={styles.secondaryEvidence}>
                <div className={styles.chartCrop}>
                  <img
                    src="/assets/autobattle/ascended-rank-cycle.jpg"
                    alt="Chest-cycle rank chart ending with Ascended at number one"
                    loading="lazy"
                  />
                </div>
                <figcaption>
                  <span>02 / Rank cycle</span>
                  <strong>The line ended at #1.</strong>
                </figcaption>
              </figure>
            </div>

            <p className={styles.proofContext}>
              Founder result from one clan cycle. Individual results vary with the game,
              account, workflow, availability, and strategy used.
            </p>
          </div>
        </section>

        <section className={styles.systems} id="systems" aria-labelledby="systems-title">
          <div className={styles.shell}>
            <div className={styles.systemIntro}>
              <p className={styles.eyebrow}>The complete loop</p>
              <h2 id="systems-title">It does more<br />than tap.</h2>
              <p>
                The core is a customizable visual autoclicker for Android. Total Battle adds
                a specialized strategy layer on top, without limiting what the workflow engine
                can theoretically automate.
              </p>
            </div>

            <ol className={styles.systemList}>
              {systems.map((system) => (
                <li key={system.number}>
                  <span className={styles.systemNumber}>{system.number}</span>
                  <div>
                    <p>{system.signal}</p>
                    <h3>{system.title}</h3>
                    <span>{system.copy}</span>
                  </div>
                  <b aria-hidden="true">↘</b>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.cycle} aria-labelledby="cycle-title">
          <div className={styles.shell}>
            <div className={styles.cycleHeading}>
              <p className={styles.eyebrow}>The product model</p>
              <h2 id="cycle-title">Plan freely.<br /><span>Run deliberately.</span></h2>
            </div>
            <div className={styles.cycleTrack}>
              <article>
                <span>Free</span>
                <h3>Build the workflow</h3>
                <p>Choose a target app, add coordinate and image steps, set timing, and save the routine before spending anything.</p>
              </article>
              <i aria-hidden="true">→</i>
              <article className={styles.cycleGate}>
                <span>1 token</span>
                <h3>Authorize the cycle</h3>
                <p>The app checks the shared IDI account balance at the cycle boundary before execution begins.</p>
              </article>
              <i aria-hidden="true">→</i>
              <article>
                <span>On device</span>
                <h3>Execute and adapt</h3>
                <p>The workflow runs locally, records the result, and uses recognition history to improve the next cycle.</p>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.rulesNotice} aria-labelledby="rules-title">
          <div className={styles.shell}>
            <div>
              <p className={styles.eyebrow}>Before you run it</p>
              <h2 id="rules-title">Respect the<br /><span>target app.</span></h2>
            </div>
            <div className={styles.rulesCopy}>
              <p>
                Automation, overlays, and accessibility tools are treated differently by each
                app. You are responsible for configuring your workflow safely and checking the
                target app&apos;s rules, permissions, and account-risk policies before you run it.
              </p>
              <p>
                AutoBattle is independent software and is not authorized, affiliated with, or
                endorsed by Total Battle or Scorewarrior. Total Battle&apos;s current EULA prohibits
                unauthorized third-party automation; using it there may risk warning or suspension.
                AutoBattle does not ask for or store your app login credentials.
              </p>
              <a
                href="https://totalbattle.com/en/policies/eula_policy/"
                target="_blank"
                rel="noreferrer"
              >
                Read the official Total Battle EULA <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </section>

        <section className={styles.tokens} id="tokens" aria-labelledby="tokens-title">
          <div className={styles.shell}>
            <div className={styles.tokenHeading}>
              <div>
                <p className={styles.eyebrow}>AutoBattle marketplace</p>
                <h2 id="tokens-title">Buy the cycles<br /><span>you want.</span></h2>
              </div>
              <div>
                <p>No subscription. Pick a pack when you need more cycles.</p>
                <span>Purchased tokens and bonus tokens are shown separately.</span>
              </div>
            </div>

            <div className={styles.packShelf}>
              {AUTOBATTLE_PRODUCTS.map((pack) => (
                <article
                  className={pack.featured ? `${styles.pack} ${styles.featuredPack}` : styles.pack}
                  key={pack.sku}
                >
                  {pack.featured && <p className={styles.bestValue}>Best value</p>}
                  <div className={styles.packAmount}>
                    <strong>{pack.paidTokens}</strong>
                    <span>Tokens</span>
                  </div>
                  {pack.bonusTokens ? (
                    <p className={styles.bonus}>+ {pack.bonusTokens} Bonus</p>
                  ) : (
                    <p className={`${styles.bonus} ${styles.noBonus}`}>Starter pack</p>
                  )}
                  <div className={styles.packPrice}>
                    <span>{formatUsd(pack.priceCents)}</span>
                    <small>One-time pack</small>
                  </div>
                  <Link className={styles.packAction} href="/AutoBattle/account#token-packs">
                    Buy pack <span aria-hidden="true">↗</span>
                  </Link>
                </article>
              ))}
            </div>

          </div>
        </section>

        <section className={styles.clanAccess} id="clan-access" aria-labelledby="clan-title">
          <div className={styles.clanNoise} aria-hidden="true" />
          <div className={styles.shell}>
            <div className={styles.clanCopy}>
              <p className={styles.eyebrow}>Founding clan offer</p>
              <h2 id="clan-title">The first run<br /><span>is on us.</span></h2>
              <p>
                Clan members will redeem one launch code on an individual AutoBattle
                account. The account receives 30 starting tokens and permanently pays
                50% of the listed price for every token pack.
              </p>
              <BetaAccessTrigger className={styles.primaryButton} product="autobattle-clan">
                Request clan access <span aria-hidden="true">↗</span>
              </BetaAccessTrigger>
              <small>Your request and clan-leader answer are reviewed before a clan access token is issued.</small>
            </div>

            <aside className={styles.offerTicket} aria-label="Founding clan offer details">
              <div className={styles.ticketTop}>
                <span>Clan launch / One redemption per account</span>
                <b>IDI</b>
              </div>
              <div className={styles.ticketBody}>
                <div>
                  <strong>30</strong>
                  <span>Starting tokens</span>
                </div>
                <i aria-hidden="true">+</i>
                <div>
                  <strong>50%</strong>
                  <span>Off every pack</span>
                </div>
              </div>
              <ul>
                <li>The clan price stays on your account.</li>
                <li>Every pack keeps its normal bonus tokens.</li>
                <li>The discount applies whenever you purchase.</li>
              </ul>
              <p>Founding access / Limited clan release</p>
            </aside>
          </div>
        </section>
      </div>

      <footer className={styles.footer}>
        <Link href="/" aria-label="IDI Studios home"><StudioMark /></Link>
        <p>AutoBattle is a customizable Android visual-automation tool by IDI Studios.</p>
        <div>
          <Link href="/AutoBattle/account">Account</Link>
          <Link href="/AutoBattle/privacy">Privacy</Link>
          <a href="mailto:development@idistudios.io">Contact</a>
        </div>
      </footer>
      <BetaAccessModal product="autobattle-clan" />
    </main>
  );
}
