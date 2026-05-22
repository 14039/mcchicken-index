import Link from "next/link";
import McChickenTile from "@/components/McChickenTile";
import JournalFeed from "@/components/JournalFeed";

export default function HomePage() {
  return (
    <div className="page">
      <header className="site-header">
        <div className="brand">
          <span aria-hidden>🍔</span>
          <span>MCCHICKEN INDEX™</span>
        </div>
        <nav style={{ display: "flex", gap: 8 }}>
          <Link className="nav-link" href="/journal">
            Journal
          </Link>
          <Link className="nav-link" href="/methodology">
            Methodology &amp; API
          </Link>
        </nav>
      </header>

      <main className="main">
        <section style={{ marginBottom: 22 }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              fontWeight: 800,
              letterSpacing: "0.5px",
              marginBottom: 8,
              lineHeight: 1.25,
            }}
          >
            A fast-food inflation benchmark, anchored to fundamentals.
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", maxWidth: 640 }}>
            The McChicken Index blends the observed national-average McChicken price with an
            input-cost basis built from chicken commodity prices, food-service wages, and
            overhead (BLS data via FRED). The gap between the two — the{" "}
            <span className="accent">margin spread</span> — shows whether McDonald&apos;s is
            expanding margin or absorbing cost. Updated weekly; base period January 2014 = 100.
          </p>
        </section>

        <McChickenTile />

        <section style={{ marginTop: 36 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.05rem",
                fontWeight: 700,
                letterSpacing: "1px",
              }}
            >
              ANALYST NOTES
            </h2>
            <Link className="nav-link" href="/journal">
              All notes →
            </Link>
          </div>
          <JournalFeed limit={3} />
        </section>
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "18px 24px",
          textAlign: "center",
          color: "var(--text-secondary)",
          fontSize: "0.74rem",
        }}
      >
        McChicken Index™ · data refreshed weekly (Mondays) · economic inputs from BLS via FRED ·{" "}
        <a href="/methodology">methodology &amp; sources</a>
      </footer>
    </div>
  );
}
