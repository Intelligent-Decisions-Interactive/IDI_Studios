const StudioMark = () => (
  <span className="studio-wordmark" aria-label="IDI Studios">
    <span className="studio-monogram" aria-hidden="true">IDI</span>
    <span className="studio-slash" aria-hidden="true">/</span>
    <span className="studio-name">Studios</span>
  </span>
);

const pursuits = [
  {
    title: "Defeats that teach.",
    copy: "A loss should leave you with a better plan—not a reason to open your wallet.",
    className: "pursuit pursuit--amber",
  },
  {
    title: "Armies you remember.",
    copy: "Leaders, factions, and formations distinct enough to become stories.",
    className: "pursuit pursuit--bone",
  },
  {
    title: "A realm that feels lived in.",
    copy: "Every upgrade, rivalry, and hard-won stretch of ground should leave a mark.",
    className: "pursuit pursuit--red",
  },
];

const buildFeatures = [
  {
    src: "/assets/current-build/world-starved-wyrm.jpg",
    title: "Persistent world",
    copy: "Encounters, settlements, terrain, and Ascendant threats share one navigable realm.",
    alt: "Conquest world map showing the Starved Wyrm Ascendant encounter",
  },
  {
    src: "/assets/current-build/battle-skirmish.jpg",
    title: "Formation combat",
    copy: "Troop position, turn order, readiness, and command choices shape every engagement.",
    alt: "Conquest skirmish battle with two armies arranged in formation",
  },
  {
    src: "/assets/current-build/city-university.jpg",
    title: "Realm construction",
    copy: "Blackstone Hold grows tile by tile into a persistent city with specialized districts.",
    alt: "Blackstone Hold construction map centered on the University district",
  },
];

const systemCaptures = [
  { src: "/assets/current-build/world-desert-tile.jpg", title: "Exploration", alt: "Conquest desert world tile with an army formation" },
  { src: "/assets/current-build/world-dragonkin-host.jpg", title: "Encounters", alt: "Dragonkin Host encounter on the Conquest world map" },
  { src: "/assets/current-build/world-blackstone-hold.jpg", title: "Settlements", alt: "Blackstone Hold selected on the Conquest world map" },
  { src: "/assets/current-build/army-setup.jpg", title: "Army setup", alt: "Conquest army setup screen with deployed formations" },
  { src: "/assets/current-build/campaign.jpg", title: "Campaign", alt: "Conquest campaign progression and permanent quests" },
  { src: "/assets/current-build/research-development.jpg", title: "Research", alt: "Conquest research and development branches" },
  { src: "/assets/current-build/equipment.jpg", title: "Equipment", alt: "Conquest equipment selection and refinement screen" },
  { src: "/assets/current-build/leader-kael-varyn.jpg", title: "Leaders", alt: "Conquest leader profile for Kael Varyn" },
  { src: "/assets/current-build/city-civic-center.jpg", title: "Civic center", alt: "Blackstone Hold construction map centered on the Civic Center" },
  { src: "/assets/current-build/city-housing.jpg", title: "Housing", alt: "Blackstone Hold housing quarter and surrounding settlement" },
];

export default function Home() {
  return (
    <main>
      <a className="skip-link" href="#content">Skip to content</a>

      <header className="site-header">
        <a className="brand-link" href="#top"><StudioMark /></a>
        <nav aria-label="Primary navigation">
          <a href="#conquest">The game</a>
          <a href="#current-build">Current build</a>
          <a href="#approach">How we build</a>
        </nav>
        <a className="header-contact" href="mailto:hello@idistudios.io">
          Say hello <span aria-hidden="true">↗</span>
        </a>
      </header>

      <div id="content">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-art" aria-hidden="true" />
          <div className="hero-scrim" aria-hidden="true" />
          <div className="hero-content">
            <p className="overline">Independent game studio / Est. 2026</p>
            <h1 id="hero-title">
              Worlds worth
              <span>mastering.</span>
            </h1>
            <p className="hero-copy">
              IDI Studios builds strategy games where preparation matters, losses
              teach, and victory has a reason. Our first world is <em>Conquest: Ascension</em>.
            </p>
            <div className="hero-actions">
              <a className="rough-button" href="#conquest">Explore Conquest <span aria-hidden="true">↓</span></a>
              <a className="quiet-link" href="#current-build">See the current build <span aria-hidden="true">↗</span></a>
            </div>
          </div>
          <div className="hero-stamp" aria-hidden="true">
            <span>Now building</span>
            <strong>Conquest:<br />Ascension</strong>
          </div>
          <p className="hero-coordinate">IDI / 001 / EST. 2026</p>
        </section>

        <div className="ticker" aria-label="IDI Studios principles">
          <div>
            <span>No gacha</span><i>✦</i><span>No pay-to-win</span><i>✦</i>
            <span>Strategy over shortcuts</span><i>✦</i><span>No gacha</span><i>✦</i>
            <span>No pay-to-win</span><i>✦</i><span>Strategy over shortcuts</span><i>✦</i>
          </div>
        </div>

        <section className="conquest" id="conquest" aria-labelledby="conquest-title">
          <div className="shell">
            <div className="conquest-intro">
              <div className="conquest-emblem">
                <img src="/assets/conquest-mark.png" alt="Conquest: Ascension emblem" />
                <p>First original world</p>
              </div>
              <div className="conquest-copy">
                <p className="scribble">Android first / In active development</p>
                <h2 id="conquest-title">Conquest:<br /><em>Ascension</em></h2>
                <p className="lead">
                  Build a realm. Train specialized armies. Read the battlefield.
                  Then take your best plan somewhere dangerous.
                </p>
                <p>
                  <em>Conquest: Ascension</em> is a persistent fantasy strategy RPG
                  built around formation combat, territorial conquest, and the long
                  road to supernatural Ascension. Reflexes cannot rescue a bad plan.
                </p>
              </div>
            </div>

            <div className="conquest-signal" aria-label="Build. Command. Conquer. Ascend.">
              <span><small>01</small>Build</span>
              <span><small>02</small>Command</span>
              <span><small>03</small>Conquer</span>
              <span><small>04</small>Ascend</span>
            </div>

            <div className="game-notes" aria-label="Conquest game features">
              <span>Persistent realm</span>
              <span>Formation tactics</span>
              <span>Strange factions</span>
              <span>Earned progression</span>
            </div>
          </div>
        </section>

        <section className="current-build" id="current-build" aria-labelledby="build-title">
          <div className="shell">
            <div className="build-heading">
              <div>
                <p className="scribble scribble--light">Current Android build</p>
                <h2 id="build-title">This is the<br />game today.</h2>
              </div>
              <div className="build-heading-copy">
                <p>
                  Real screens from <em>Conquest: Ascension</em>: a persistent world,
                  formation-driven combat, realm construction, research, leaders,
                  equipment, and long-term progression.
                </p>
                <span>Interface and balance remain in active development.</span>
              </div>
            </div>

            <div className="build-feature-grid">
              {buildFeatures.map((feature) => (
                <figure className="build-shot" key={feature.src}>
                  <img src={feature.src} alt={feature.alt} loading="lazy" />
                  <figcaption>
                    <strong>{feature.title}</strong>
                    <span>{feature.copy}</span>
                  </figcaption>
                </figure>
              ))}
            </div>

            <div className="systems-heading">
              <p>One connected progression loop</p>
              <span>World / Army / Campaign / Research / Leaders / City</span>
            </div>
            <div className="systems-gallery" aria-label="More screens from the current Conquest build">
              {systemCaptures.map((capture) => (
                <figure className="system-shot" key={capture.src}>
                  <img src={capture.src} alt={capture.alt} loading="lazy" />
                  <figcaption>{capture.title}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="pursuits" id="approach" aria-labelledby="pursuits-title">
          <div className="shell">
            <div className="pursuits-heading">
              <p className="scribble scribble--light">What we’re chasing</p>
              <h2 id="pursuits-title">Make it deep.<br />Keep it honest.</h2>
            </div>
            <div className="pursuit-stack">
              {pursuits.map((pursuit) => (
                <article className={pursuit.className} key={pursuit.title}>
                  <span aria-hidden="true">✦</span>
                  <h3>{pursuit.title}</h3>
                  <p>{pursuit.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="studio" id="studio" aria-labelledby="studio-title">
          <div className="studio-ghost" aria-hidden="true">IDI</div>
          <div className="shell studio-layout">
            <div>
              <p className="scribble scribble--light">The studio</p>
              <h2 id="studio-title">Small studio.<br /><em>Big world.</em></h2>
            </div>
            <div className="studio-copy">
              <p className="lead">
                IDI Studios is founder-led and independent. We are building one game
                deeply, with focus, patience, and a clear point of view.
              </p>
              <p>
                Conquest is already playable and expands every week. The scope is
                deliberate, the systems are connected, and every update moves the
                same world forward.
              </p>
              <p className="studio-aside">IDI Studios is the game-development label of Intelligent Decisions Interactive.</p>
            </div>
          </div>
        </section>

        <section className="contact" aria-labelledby="contact-title">
          <div className="shell contact-inner">
            <p className="scribble">Stay close to the build</p>
            <h2 id="contact-title">Come watch us<br /><em>build it.</em></h2>
            <p>For development updates, press, publishing, and studio inquiries.</p>
            <a href="mailto:hello@idistudios.io">hello@idistudios.io <span aria-hidden="true">↗</span></a>
          </div>
        </section>
      </div>

      <footer>
        <StudioMark />
        <p>© 2026 IDI Studios / A label of Intelligent Decisions Interactive.</p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
