import type { Metadata } from "next";
import Link from "next/link";
import { StudioMark } from "../studio-mark";

export const metadata: Metadata = {
  title: "Careers — IDI Studios",
  description:
    "IDI Studios is looking for creative developers who want to help build thoughtful, player-first strategy games.",
  openGraph: {
    title: "Build With Us — IDI Studios",
    description: "IDI Studios is looking for creative developers to join its team.",
    type: "website",
    url: "https://idistudios.io/careers",
    images: [
      {
        url: "/careers-og.png",
        width: 1536,
        height: 1024,
        alt: "IDI Studios — Build With Us",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Build With Us — IDI Studios",
    description: "IDI Studios is looking for creative developers to join its team.",
    images: ["/careers-og.png"],
  },
};

const conversations = [
  {
    number: "01",
    title: "Game systems",
    copy: "Design and build the rules, progression, tools, and tactical decisions that make a strategy world worth mastering.",
  },
  {
    number: "02",
    title: "World & interface",
    copy: "Turn complex systems into a place players can understand, navigate, and remember—from the realm map to the smallest interaction.",
  },
  {
    number: "03",
    title: "Technical craft",
    copy: "Solve hard production problems with practical code, good judgment, and the willingness to own work from first idea to shipped result.",
  },
];

export default function CareersPage() {
  return (
    <main className="careers-page">
      <a className="skip-link" href="#careers-content">Skip to content</a>

      <header className="site-header careers-header">
        <Link className="brand-link" href="/" aria-label="IDI Studios home">
          <StudioMark />
        </Link>
        <nav aria-label="Careers navigation">
          <Link href="/#conquest">The game</Link>
          <Link href="/#studio">The studio</Link>
          <a href="#what-we-value">What we value</a>
        </nav>
        <Link className="header-contact" href="/">Studio home <span aria-hidden="true">↗</span></Link>
      </header>

      <div id="careers-content">
        <section className="careers-hero" aria-labelledby="careers-title">
          <div className="careers-hero-art" aria-hidden="true" />
          <div className="careers-hero-scrim" aria-hidden="true" />
          <div className="shell careers-hero-content">
            <p className="overline">Build with us / IDI Studios</p>
            <h1 id="careers-title">
              IDI is looking for
              <span>creative developers</span>
              to join its team.
            </h1>
            <p>
              We’re building <em>Conquest: Ascension</em> with a small, focused team—and
              starting conversations with developers who care about deep systems,
              clear decisions, and player-earned progress.
            </p>
            <a className="rough-button" href="mailto:development@idistudios.io?subject=Developer%20introduction%20%E2%80%94%20IDI%20Studios">
              Introduce yourself <span aria-hidden="true">↗</span>
            </a>
          </div>
          <p className="careers-coordinate">IDI / CAREERS / 001</p>
        </section>

        <section className="careers-values" id="what-we-value" aria-labelledby="values-title">
          <div className="shell">
            <div className="careers-values-heading">
              <div>
                <p className="scribble scribble--light">Who we want to meet</p>
                <h2 id="values-title">Creative in thought.<br /><em>Serious in craft.</em></h2>
              </div>
              <div className="careers-values-copy">
                <p>
                  Titles matter less to us than curiosity, follow-through, and the
                  ability to make a complicated idea feel inevitable. We value people
                  who can challenge a plan, improve it, and then help bring it to life.
                </p>
                <p>
                  If you’ve built games, tools, interfaces, simulations, or unusual
                  interactive systems, we’d like to see how you think.
                </p>
              </div>
            </div>

            <div className="careers-conversations" aria-label="Areas of interest">
              {conversations.map((conversation) => (
                <article key={conversation.number}>
                  <span>{conversation.number}</span>
                  <h3>{conversation.title}</h3>
                  <p>{conversation.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="careers-contact" aria-labelledby="careers-contact-title">
          <div className="careers-contact-mark" aria-hidden="true">IDI</div>
          <div className="shell careers-contact-inner">
            <p className="scribble scribble--light">Start a conversation</p>
            <h2 id="careers-contact-title">Show us what<br /><em>you make.</em></h2>
            <p>
              Send a short note about yourself, the work you want to own, and a link
              to something you’re proud of. A formal application isn’t necessary.
            </p>
            <a className="contact-action contact-primary" href="mailto:development@idistudios.io?subject=Developer%20introduction%20%E2%80%94%20IDI%20Studios">
              development@idistudios.io <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </div>

      <footer>
        <StudioMark />
        <p>© 2026 IDI Studios / A label of Intelligent Decisions Interactive.</p>
        <span className="footer-links">
          <Link href="/">Studio home</Link>
          <a href="#careers-content">Back to top ↑</a>
        </span>
      </footer>
    </main>
  );
}
