import Link from "next/link";
import JournalFeed from "@/components/JournalFeed";

export const metadata = {
  title: "Analyst Journal — McChicken Index™",
  description:
    "Weekly analyst notes on the McChicken Index: what moved the blended index, retail vs. input costs, and the margin-spread read.",
};

export default function JournalPage() {
  return (
    <div className="page">
      <header className="site-header">
        <Link className="brand" href="/" style={{ textDecoration: "none" }}>
          <span aria-hidden>🍔</span>
          <span>MCCHICKEN INDEX™</span>
        </Link>
        <nav style={{ display: "flex", gap: 8 }}>
          <Link className="nav-link" href="/">
            Dashboard
          </Link>
          <Link className="nav-link" href="/methodology">
            Methodology &amp; API
          </Link>
        </nav>
      </header>

      <main className="main">
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.4rem",
            fontWeight: 800,
            marginBottom: 6,
          }}
        >
          Analyst Journal
        </h1>
        <p className="muted" style={{ fontSize: "0.9rem", marginBottom: 24, maxWidth: 640 }}>
          A short note is published with each Monday update: what moved the index, whether retail
          price or input costs drove it, and what the margin spread implies about McDonald&apos;s
          pricing posture. Every figure is drawn from that week&apos;s computed data.
        </p>
        <JournalFeed />
      </main>
    </div>
  );
}
