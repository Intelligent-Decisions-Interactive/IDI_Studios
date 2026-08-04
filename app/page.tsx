import { BetaAccessModal, BetaAccessTrigger } from "./beta-access-form";
import { StudioMark } from "./studio-mark";

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

const captureGroups = [
  {
    id: "overworld",
    title: "Overworld",
    copy: "A persistent realm of terrain, settlements, armies, and encounters.",
    captures: [
      { src: "/assets/current-build/world-starved-wyrm.jpg", title: "Ascendant encounter", alt: "Conquest world map showing the Starved Wyrm Ascendant encounter" },
      { src: "/assets/current-build/world-desert-tile.jpg", title: "Desert exploration", alt: "Conquest desert world tile with an army formation" },
      { src: "/assets/current-build/world-dragonkin-host.jpg", title: "Neutral encounter", alt: "Dragonkin Host encounter on the Conquest world map" },
      { src: "/assets/current-build/world-blackstone-hold.jpg", title: "Player settlement", alt: "Blackstone Hold selected on the Conquest world map" },
    ],
  },
  {
    id: "city",
    title: "City",
    copy: "Blackstone Hold grows tile by tile into a specialized, persistent settlement.",
    captures: [
      { src: "/assets/current-build/city-university.jpg", title: "University", alt: "Blackstone Hold construction map centered on the University district" },
      { src: "/assets/current-build/city-civic-center.jpg", title: "Civic center", alt: "Blackstone Hold construction map centered on the Civic Center" },
      { src: "/assets/current-build/city-housing.jpg", title: "Housing quarter", alt: "Blackstone Hold housing quarter and surrounding settlement" },
      { src: "/assets/current-build/world-blackstone-warehouse.jpg", title: "Ruined warehouse", alt: "Blackstone Hold map centered on a ruined warehouse awaiting repair" },
    ],
  },
  {
    id: "characters",
    title: "Character UI",
    copy: "Leaders, equipment, doctrines, and formations shape the army before battle begins.",
    captures: [
      { src: "/assets/current-build/leader-kael-varyn.jpg", title: "Leader profile", alt: "Conquest leader profile for Kael Varyn" },
      { src: "/assets/current-build/equipment.jpg", title: "Equipment", alt: "Conquest equipment selection and refinement screen" },
      { src: "/assets/current-build/item-catalogue.jpg", title: "Item catalogue", alt: "Conquest Item Catalogue screen showing Ascendant crown equipment variants" },
      { src: "/assets/current-build/barracks-training.jpg", title: "Barracks training", alt: "Conquest Barracks Training screen showing a Shieldbearer troop selection" },
    ],
  },
  {
    id: "menus",
    title: "Menus & progression",
    copy: "Campaign goals and research branches connect each battle to long-term growth.",
    captures: [
      { src: "/assets/current-build/campaign.jpg", title: "Campaign", alt: "Conquest campaign progression and permanent quests" },
      { src: "/assets/current-build/research-development.jpg", title: "Research & development", alt: "Conquest research and development branches" },
      { src: "/assets/current-build/army-setup.jpg", title: "Army setup", alt: "Conquest army setup screen with deployed formations" },
      { src: "/assets/current-build/barracks-roster.jpg", title: "Barracks", alt: "Conquest Barracks screen showing trained troop families and resources" },
    ],
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
          <a href="#vision">The vision</a>
          <a href="#current-build">Current build</a>
          <a href="/careers">Careers</a>
        </nav>
        <div className="header-actions">
          <a className="mobile-careers-link" href="/careers">Careers</a>
          <BetaAccessTrigger className="header-contact">
            Request beta <span aria-hidden="true">↗</span>
          </BetaAccessTrigger>
        </div>
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
              <BetaAccessTrigger className="rough-button">Request beta access <span aria-hidden="true">↗</span></BetaAccessTrigger>
              <a className="quiet-link" href="#current-build">See the current build <span aria-hidden="true">↗</span></a>
            </div>
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
                <img src="/assets/conquest-wordmark.png" alt="Conquest: Ascension wordmark" />
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
              <span><small>01</small><strong>Build</strong></span>
              <span><small>02</small><strong>Command</strong></span>
              <span><small>03</small><strong>Conquer</strong></span>
              <span><small>04</small><strong>Ascend</strong></span>
            </div>

            <div className="game-notes" aria-label="Conquest game features">
              <span>Persistent realm</span>
              <span>Formation tactics</span>
              <span>Strange factions</span>
              <span>Earned progression</span>
            </div>
          </div>
        </section>

        <section className="world-vision" id="vision" aria-labelledby="vision-title">
          <div className="shell">
            <div className="vision-heading">
              <div>
                <p className="scribble scribble--light">Concept art / Target experience</p>
                <h2 id="vision-title">Build the realm.<br />Earn the impossible.</h2>
              </div>
              <div className="vision-heading-copy">
                <p>
                  These frames establish the intended scale, atmosphere, and emotional
                  range of <em>Conquest: Ascension</em>. The playable Android build follows below.
                </p>
                <span>Visual direction, not in-game footage.</span>
              </div>
            </div>

            <div className="vision-sequence">
              <article className="vision-card vision-card--realm">
                <figure>
                  <img
                    src="/assets/concept-art/realm-development.webp"
                    alt="A thriving fortified realm rises around a monumental blackstone keep after rain"
                    loading="lazy"
                  />
                </figure>
                <div className="vision-card-copy">
                  <span>01 / Build</span>
                  <h3>Raise Blackstone Hold.</h3>
                  <p>Turn claimed ground into a deliberate, living center of power.</p>
                </div>
              </article>

              <article className="vision-card vision-card--formation">
                <figure>
                  <img
                    src="/assets/concept-art/formation-command.webp"
                    alt="A field commander directs disciplined infantry, archers, and cavalry before battle"
                    loading="lazy"
                  />
                </figure>
                <div className="vision-card-copy">
                  <span>02 / Command</span>
                  <h3>Win before blades meet.</h3>
                  <p>Read the terrain, shape the formation, and commit to the order.</p>
                </div>
              </article>

              <article className="vision-card vision-card--ascension">
                <figure>
                  <img
                    src="/assets/concept-art/ascension-event.webp"
                    alt="A lone commander stands within ancient golden rings as a supernatural column of light opens above a ruined summit"
                    loading="lazy"
                  />
                </figure>
                <div className="vision-card-copy">
                  <span>03 / Ascend</span>
                  <h3>Go beyond conquest.</h3>
                  <p>Power is not the end state. It is the price of becoming something else.</p>
                </div>
              </article>
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

            <div className="combat-feature">
              <figure className="combat-shot">
                <img
                  src="/assets/current-build/battle-skirmish.jpg"
                  alt="Conquest skirmish battle with two armies arranged in formation"
                  loading="lazy"
                />
              </figure>
              <div className="combat-copy">
                <p className="scribble scribble--light">Combat</p>
                <h3>Formation tactics<br />in motion.</h3>
                <p>
                  Troop position, turn order, readiness, and command choices shape
                  every engagement. The plan starts before the first attack and
                  keeps changing once the battlefield answers back.
                </p>
                <div className="combat-signals" aria-label="Combat systems">
                  <span>Formation</span>
                  <span>Turn order</span>
                  <span>Commands</span>
                  <span>Readiness</span>
                </div>
              </div>
            </div>

            <div className="capture-groups">
              {captureGroups.map((group) => (
                <section className={`capture-group capture-group--${group.id}`} key={group.id} aria-labelledby={`capture-${group.id}`}>
                  <div className="capture-group-heading">
                    <h3 id={`capture-${group.id}`}>{group.title}</h3>
                    <p>{group.copy}</p>
                    <span>{String(group.captures.length).padStart(2, "0")} screens</span>
                  </div>
                  <div className="capture-grid">
                    {group.captures.map((capture) => (
                      <figure className="system-shot" key={capture.src}>
                        <img src={capture.src} alt={capture.alt} loading="lazy" />
                        <figcaption>{capture.title}</figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
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

        <section className="contact" id="beta-access" aria-labelledby="contact-title">
          <div className="shell contact-inner">
            <p className="scribble">Limited Android testing waves</p>
            <h2 id="contact-title">Request beta<br /><em>access.</em></h2>
            <p>Tell us what Android device you use and what you most want to test in Conquest: Ascension.</p>
            <div className="contact-actions">
              <BetaAccessTrigger className="contact-action contact-primary">Request beta access <span aria-hidden="true">↗</span></BetaAccessTrigger>
              <a className="contact-action contact-secondary" href="mailto:development@idistudios.io">Studio inquiries <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </section>
      </div>

      <footer>
        <StudioMark />
        <p>© 2026 IDI Studios / A label of Intelligent Decisions Interactive.</p>
        <span className="footer-links">
          <a href="/careers">Careers</a>
          <a href="#top">Back to top ↑</a>
        </span>
      </footer>

      <BetaAccessModal />
    </main>
  );
}
