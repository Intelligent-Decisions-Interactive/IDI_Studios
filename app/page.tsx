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
    copy: "If you lose, the game should give you a new idea—not a reason to reach for your wallet.",
    className: "pursuit pursuit--amber",
  },
  {
    title: "Armies you remember.",
    copy: "Distinct leaders, strange factions, and formations that become stories you want to retell.",
    className: "pursuit pursuit--bone",
  },
  {
    title: "A realm that feels lived in.",
    copy: "A persistent world where every upgrade, rivalry, and hard-won patch of ground leaves a mark.",
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
            <p className="overline">Independent game makers / somewhere in the fog</p>
            <h1 id="hero-title">
              Worlds worth
              <span>mastering.</span>
            </h1>
            <p className="hero-copy">
              We’re building the strategy game we kept looking for and couldn’t find:
              a persistent realm, armies with identity, and battles that make you stop,
              think, and try again.
            </p>
            <div className="hero-actions">
              <a className="rough-button" href="#conquest">Enter the realm <span aria-hidden="true">↓</span></a>
              <a className="quiet-link" href="#field-notes">See what’s working <span aria-hidden="true">↗</span></a>
            </div>
          </div>
          <div className="hero-stamp" aria-hidden="true">
            <span>currently making</span>
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
                <p>our first world</p>
              </div>
              <div className="conquest-copy">
                <p className="scribble">In active development / Android first</p>
                <h2 id="conquest-title">Conquest:<br /><em>Ascension</em></h2>
                <p className="lead">
                  Build a realm. Train specialized armies. Read the battlefield.
                  Then take your best plan somewhere dangerous.
                </p>
                <p>
                  Conquest is a persistent fantasy strategy RPG about preparation,
                  formation-based battles, territorial ambition, and the long road
                  toward supernatural Ascension. Reflexes won’t save a bad plan.
                </p>
              </div>
            </div>

            <figure className="conquest-poster">
              <img src="/assets/conquest-hero.png" alt="A dark fantasy citadel and armies in Conquest: Ascension" />
              <figcaption>
                <span>Beyond the gates of Blackstone Hold</span>
                <span>Work in progress / real game imagery</span>
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
              <p>That’s the whole manifesto, really.</p>
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
              <p className="scribble">Pulled from the current build</p>
              <h2 id="notes-title">The world is<br />already moving.</h2>
              <p>
                Not mood boards. Not investor slides. These are pieces of the actual
                realm as we build, break, rethink, and build it again.
              </p>
            </div>
            <div className="notes-gallery">
              <figure className="note-card note-card--map">
                <img src="/assets/conquest-world-map.png" alt="Conquest world map with Blackstone Hold, forests, roads, and coastline" />
                <figcaption>The road out of Blackstone //</figcaption>
              </figure>
              <figure className="note-card note-card--city">
                <img src="/assets/conquest-city.jpg" alt="Conquest city screen showing Blackstone Hold and its buildings" />
                <figcaption>A realm needs a home.</figcaption>
              </figure>
              <figure className="note-card note-card--leaders">
                <img src="/assets/conquest-leaders.png" alt="Conquest leader equipment and progression screen" />
                <figcaption>Meet the troublemakers.</figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="studio" id="studio" aria-labelledby="studio-title">
          <div className="studio-ghost" aria-hidden="true">IDI</div>
          <div className="shell studio-layout">
            <div>
              <p className="scribble scribble--light">About this operation</p>
              <h2 id="studio-title">Small studio.<br /><em>Big world.</em></h2>
            </div>
            <div className="studio-copy">
              <p className="lead">
                IDI Studios is founder-led and independent. We’re building one game
                deeply instead of a dozen games halfway.
              </p>
              <p>
                Conquest is playable and growing every week. The work is real, the
                scope is honest, and the world keeps getting stranger.
              </p>
              <p className="studio-aside">Intelligent Decisions Interactive is the parent company. IDI Studios is where the games live.</p>
            </div>
          </div>
        </section>

        <section className="contact" aria-labelledby="contact-title">
          <div className="shell contact-inner">
            <p className="scribble">Follow the ascent</p>
            <h2 id="contact-title">Come watch us<br /><em>build it.</em></h2>
            <p>Development updates, press, publishing, or just a note from the other side of the map.</p>
            <a href="mailto:hello@idistudios.io">hello@idistudios.io <span aria-hidden="true">↗</span></a>
          </div>
        </section>
      </div>

      <footer>
        <StudioMark />
        <p>© 2026 IDI Studios / A label of Intelligent Decisions Interactive.</p>
        <a href="#top">Back to the gates ↑</a>
      </footer>
    </main>
  );
}
