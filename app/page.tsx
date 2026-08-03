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

export default function Home() {
  return (
    <main>
      <a className="skip-link" href="#content">Skip to content</a>

      <header className="site-header">
        <a className="brand-link" href="#top"><StudioMark /></a>
        <nav aria-label="Primary navigation">
          <a href="#conquest">The game</a>
          <a href="#field-notes">Field notes</a>
          <a href="#studio">The studio</a>
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
              <a className="quiet-link" href="#field-notes">View the current build <span aria-hidden="true">↗</span></a>
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

            <figure className="conquest-poster">
              <img src="/assets/conquest-hero.png" alt="A dark fantasy citadel and armies in Conquest: Ascension" />
              <figcaption>
                <span>Beyond the gates of Blackstone Hold</span>
                <span>Captured from the current build</span>
              </figcaption>
            </figure>

            <div className="game-notes" aria-label="Conquest game features">
              <span>Persistent realm</span>
              <span>Formation tactics</span>
              <span>Strange factions</span>
              <span>Earned progression</span>
            </div>
          </div>
        </section>

        <section className="pursuits" aria-labelledby="pursuits-title">
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

        <section className="field-notes" id="field-notes" aria-labelledby="notes-title">
          <div className="shell">
            <div className="notes-heading">
              <p className="scribble">From the current build</p>
              <h2 id="notes-title">The world is<br />already moving.</h2>
              <p>
                A closer look at realm management and the leaders who carry the
                campaign—captured directly from the current game.
              </p>
            </div>
            <div className="notes-gallery">
              <figure className="note-card note-card--city">
                <img src="/assets/conquest-city.jpg" alt="Conquest city screen showing Blackstone Hold and its buildings" />
                <figcaption>Blackstone Hold</figcaption>
              </figure>
              <figure className="note-card note-card--leaders">
                <img src="/assets/conquest-leaders.png" alt="Conquest leader equipment and progression screen" />
                <figcaption>Leaders and loadouts</figcaption>
              </figure>
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
