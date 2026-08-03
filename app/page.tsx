const StudioMark = ({ compact = false }: { compact?: boolean }) => (
  <span className={`studio-wordmark${compact ? " studio-wordmark--compact" : ""}`}>
    <span className="studio-glyph" aria-hidden="true">
      <span className="glyph-i" />
      <span className="glyph-d" />
      <span className="glyph-i" />
    </span>
    <span className="studio-name">Studios</span>
  </span>
);

const principles = [
  {
    number: "01",
    title: "Decisions matter",
    copy: "Players should understand why they won, why they lost, and what they can change.",
  },
  {
    number: "02",
    title: "Mastery is earned",
    copy: "Progress comes from preparation, knowledge, and play—not purchased combat dominance.",
  },
  {
    number: "03",
    title: "Depth stays readable",
    copy: "Complex systems should create meaningful choices without hiding the rules that govern them.",
  },
  {
    number: "04",
    title: "Execution before hype",
    copy: "We lead with working systems, demonstrated progress, honest scope, and clear development goals.",
  },
];

export default function Home() {
  return (
    <main>
      <a className="skip-link" href="#content">
        Skip to content
      </a>

      <header className="site-header">
        <a className="brand-link" href="#top" aria-label="IDI Studios home">
          <StudioMark compact />
        </a>
        <nav aria-label="Primary navigation">
          <a href="#conquest">Conquest</a>
          <a href="#principles">Principles</a>
          <a href="#studio">Studio</a>
        </nav>
        <a className="header-contact" href="mailto:hello@idistudios.io">
          Contact <span aria-hidden="true">↗</span>
        </a>
      </header>

      <div id="content">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-backdrop" aria-hidden="true" />
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-content">
            <p className="eyebrow"><span /> Independent game studio</p>
            <h1 id="hero-title">Games built for<br />players who think.</h1>
            <p className="hero-copy">
              IDI Studios creates deep, systems-driven worlds where preparation
              matters, progress is earned, and victory makes sense.
            </p>
            <div className="hero-actions">
              <a className="button button--gold" href="#conquest">
                Explore Conquest: Ascension <span aria-hidden="true">↓</span>
              </a>
              <a className="text-link" href="#principles">
                Our design philosophy <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
          <div className="hero-signature" aria-label="IDI Studios">
            <StudioMark />
            <p>Intelligent Decisions Interactive</p>
          </div>
          <div className="hero-index" aria-hidden="true">
            <span>001</span>
            <span>Est. 2026</span>
          </div>
        </section>

        <section className="project" id="conquest" aria-labelledby="project-title">
          <div className="section-shell">
            <div className="section-kicker">
              <span>Current project</span>
              <span>Android first · In active development</span>
            </div>

            <div className="project-intro">
              <div className="project-mark-wrap">
                <img
                  className="project-mark"
                  src="/assets/conquest-mark.png"
                  alt="Conquest: Ascension emblem"
                />
              </div>
              <div className="project-copy">
                <p className="eyebrow eyebrow--dark"><span /> Persistent fantasy strategy RPG</p>
                <h2 id="project-title">Build. Command.<br />Conquer. Ascend.</h2>
                <p>
                  Build a persistent realm, train specialized armies, and fight
                  formation-based command-timeline battles on the road to
                  supernatural Ascension.
                </p>
                <p>
                  Preparation matters more than reflexes. Every defeat should
                  teach you what to change—and every victory should feel earned.
                </p>
              </div>
            </div>

            <div className="project-stage">
              <div className="project-stage-image" role="img" aria-label="Dark fantasy fortress and armies from Conquest: Ascension" />
              <div className="project-stage-caption">
                <div>
                  <span>Flagship original IP</span>
                  <strong>Conquest: Ascension</strong>
                </div>
                <p>Realm building · Tactical command · Persistent progression</p>
              </div>
            </div>

            <dl className="metrics" aria-label="Current Conquest development foundation">
              <div><dt>49</dt><dd>Campaign landmarks</dd></div>
              <div><dt>92</dt><dd>Enemy factions</dd></div>
              <div><dt>276</dt><dd>Canonical enemy troops</dd></div>
              <div><dt>25</dt><dd>Ascendant encounters</dd></div>
            </dl>
          </div>
        </section>

        <section className="principles" id="principles" aria-labelledby="principles-title">
          <div className="section-shell principles-layout">
            <div className="principles-heading">
              <p className="eyebrow"><span /> How we build</p>
              <h2 id="principles-title">Respect is a<br />design system.</h2>
              <p>
                We respect the player&apos;s intelligence, time, and investment.
                That promise shapes the rules, progression, monetization, and
                way we talk about our work.
              </p>
            </div>
            <ol className="principles-list">
              {principles.map((principle) => (
                <li key={principle.number}>
                  <span>{principle.number}</span>
                  <div>
                    <h3>{principle.title}</h3>
                    <p>{principle.copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="evidence" aria-labelledby="evidence-title">
          <div className="section-shell">
            <div className="section-kicker section-kicker--light">
              <span>Playable foundation</span>
              <span>Current development imagery</span>
            </div>
            <div className="evidence-heading">
              <h2 id="evidence-title">A world already<br />taking shape.</h2>
              <p>
                Conquest is being built as a connected system: realm, world,
                leaders, armies, research, and battle all reinforce the same
                long-term journey.
              </p>
            </div>
            <div className="evidence-gallery">
              <figure className="gallery-world">
                <img src="/assets/conquest-world-map.png" alt="Conquest world map showing Blackstone Hold, forests, roads, coast, and nearby structures" />
                <figcaption><span>01</span> Persistent world</figcaption>
              </figure>
              <figure className="gallery-phone gallery-phone--city">
                <img src="/assets/conquest-city.jpg" alt="Conquest Android city screen showing Blackstone Hold and its barracks district" />
                <figcaption><span>02</span> Realm development</figcaption>
              </figure>
              <figure className="gallery-phone gallery-phone--leaders">
                <img src="/assets/conquest-leaders.png" alt="Conquest Android leader equipment and progression screen" />
                <figcaption><span>03</span> Persistent leaders</figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="studio" id="studio" aria-labelledby="studio-title">
          <div className="studio-orbit" aria-hidden="true">
            <span>IDI</span>
          </div>
          <div className="section-shell studio-layout">
            <div>
              <p className="eyebrow"><span /> The studio</p>
              <h2 id="studio-title">Independent by structure.<br />Ambitious by design.</h2>
            </div>
            <div className="studio-copy">
              <p>
                IDI Studios is the founder-led game-development and publishing
                label of Intelligent Decisions Interactive.
              </p>
              <p>
                We build original worlds with durable systems, clear rules, and
                room for mastery. Our first title is <em>Conquest: Ascension</em>.
              </p>
              <p className="parent-line">Parent principle <strong>Clarity over Complexity.</strong></p>
            </div>
          </div>
        </section>

        <section className="contact" aria-labelledby="contact-title">
          <div className="contact-background" aria-hidden="true" />
          <div className="section-shell contact-content">
            <p className="eyebrow"><span /> Follow the ascent</p>
            <h2 id="contact-title">The realm is<br />only the beginning.</h2>
            <p>
              For development updates, publishing conversations, press, and
              studio inquiries, contact IDI Studios directly.
            </p>
            <a className="button button--gold" href="mailto:hello@idistudios.io">
              hello@idistudios.io <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </div>

      <footer>
        <StudioMark compact />
        <p>© 2026 IDI Studios. A label of Intelligent Decisions Interactive.</p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
