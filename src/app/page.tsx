import { Experience } from "@/components/experience";
import { Stats } from "@/components/stats";
import { Mission } from "@/components/mission";
import { BuildLog } from "@/components/build-log";
import { Team } from "@/components/team";
import { Support } from "@/components/support";

export default function Home() {
  return (
    <>
      <a className="skip" href="#stats">
        Skip to flight numbers
      </a>

      {/* Apple-style Minimalist Translucent Navigation */}
      <header className="nav-apple">
        <div className="nav-apple-inner">
          <a className="nav-brand" href="#rocket">
            <span className="brand-dot" />
            <span className="brand-text">ROCK HILL ROCKETRY</span>
            <span className="brand-pill">ROCKY 1</span>
          </a>

          <nav className="nav-links" aria-label="Page Navigation">
            <a href="#rocket">Overview</a>
            <a href="#exploded">Anatomy</a>
            <a href="#stats">Numbers</a>
            <a href="#mission">Mission</a>
            <a href="#log">Flight Log</a>
            <a href="#team">Team</a>
            <a href="#support">Support</a>
          </nav>

          <div className="nav-actions">
            <a href="#support" className="nav-cta">
              Support Mission
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero & Exploded 3D Experience */}
        <Experience />

        {/* Flight Numbers & Critical Specs */}
        <Stats />

        {/* The American Rocketry Challenge Mission */}
        <Mission />

        {/* Build & Test Log */}
        <BuildLog />

        {/* Rock Hill High School Team */}
        <Team />

        {/* Sponsor Tiers & Support */}
        <Support />
      </main>

      <footer className="footer-apple">
        <div className="footer-inner">
          <div className="footer-brand">
            <strong>ROCKY 1 · ROCK HILL HIGH SCHOOL</strong>
            <p>American Rocketry Challenge 2027 · Designed by Krish Bharadiya · Engineered and manufactured in Rock Hill, SC.</p>
          </div>
          <div className="footer-links">
            <a href="https://github.com/TheRollerBlader/rocky">Design files</a>
            <a href="#stats">The card</a>
            <a href="#support">Support</a>
          </div>
        </div>
      </footer>
    </>
  );
}
