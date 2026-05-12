"use client";

import McChickenTile from "@/components/McChickenTile";

const TICKER_ITEMS: Array<{ label: string; value: string; tone: "up" | "down" | "neutral" | "tag" }> = [
  { label: "MCCHKN", value: "$2.79  ▲ 1.82%", tone: "up" },
  { label: "CPI:FOOD", value: "324.7  ▲ 0.41%", tone: "up" },
  { label: "POULTRY/LB", value: "118¢  ▼ 0.23%", tone: "down" },
  { label: "MIN.WAGE", value: "$7.25  —", tone: "neutral" },
  { label: "FOODSVC/HR", value: "$15.91  ▲ 0.10%", tone: "up" },
  { label: "SINCE 2014", value: "+179%", tone: "up" },
  { label: "STATUS", value: "FEED LIVE", tone: "tag" },
  { label: "REGION:NE", value: "$2.99  ▲", tone: "up" },
  { label: "REGION:W", value: "$3.19  ▲", tone: "up" },
  { label: "REGION:S", value: "$2.59  —", tone: "neutral" },
  { label: "REGION:MW", value: "$2.69  ▲", tone: "up" },
  { label: "VOLATILITY", value: "LOW", tone: "tag" },
];

function TickerSegment() {
  return (
    <>
      {TICKER_ITEMS.map((item, i) => (
        <span
          key={i}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
        >
          <span className="ticker-dim">{item.label}</span>
          <span
            className={
              item.tone === "up"
                ? "ticker-up"
                : item.tone === "down"
                ? "ticker-down"
                : item.tone === "tag"
                ? "ticker-tag"
                : "ticker-dim"
            }
          >
            {item.value}
          </span>
          <span className="ticker-divider">▌</span>
        </span>
      ))}
    </>
  );
}

export default function HomePage() {
  return (
    <div className="dashboard-container">
      {/* CRT scanline sweep overlay */}
      <div className="scan-sweep" aria-hidden />

      {/* Header */}
      <header className="dashboard-header">
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <span
            style={{
              fontSize: "2rem",
              filter: "drop-shadow(0 0 10px rgba(255,170,0,0.85))",
              animation: "radial-pulse 2.6s ease-in-out infinite",
              display: "inline-block",
            }}
          >
            🍔
          </span>
          <h1
            className="glitch"
            data-text="MCCHICKEN INDEX™"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.35rem",
              fontWeight: 900,
              letterSpacing: "6px",
              lineHeight: 1,
            }}
          >
            MCCHICKEN INDEX™
          </h1>
          <span
            className="hype-chip"
            style={{ marginLeft: "6px" }}
            aria-label="Status"
          >
            <span className="live-dot" />
            LIVE FEED
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="hype-chip hype-chip-cyan">SIGNAL: STRONG</span>
          <a
            href="/methodology"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.65rem",
              color: "var(--neon-orange)",
              textDecoration: "none",
              letterSpacing: "3px",
              padding: "6px 12px",
              border: "1px solid rgba(255,102,0,0.4)",
              background: "rgba(255,102,0,0.05)",
              textShadow: "0 0 6px rgba(255,102,0,0.7)",
              boxShadow: "0 0 10px rgba(255,102,0,0.15), inset 0 0 8px rgba(255,102,0,0.05)",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,102,0,0.15)";
              e.currentTarget.style.boxShadow =
                "0 0 16px rgba(255,102,0,0.5), inset 0 0 12px rgba(255,102,0,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,102,0,0.05)";
              e.currentTarget.style.boxShadow =
                "0 0 10px rgba(255,102,0,0.15), inset 0 0 8px rgba(255,102,0,0.05)";
            }}
          >
            METHODOLOGY ▸
          </a>
        </div>
      </header>

      {/* Scrolling marquee ticker */}
      <div className="ticker" aria-hidden>
        <div className="ticker-track">
          <TickerSegment />
          <TickerSegment />
        </div>
      </div>

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "26px 16px 40px",
          position: "relative",
          zIndex: 5,
        }}
      >
        {/* Hero tagline */}
        <div
          style={{
            width: "100%",
            maxWidth: "720px",
            marginBottom: "20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.6rem",
              letterSpacing: "8px",
              color: "var(--text-secondary)",
              marginBottom: "10px",
            }}
          >
            ▼ THE ULTIMATE INFLATION BENCHMARK ▼
          </div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2.4rem",
              fontWeight: 900,
              letterSpacing: "2px",
              lineHeight: 1.05,
              background:
                "linear-gradient(90deg, #ff003c, #ff6600, #ffaa00, #ff00ff, #00ffff, #00ff66, #ffaa00, #ff003c)",
              backgroundSize: "300% 100%",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 14px rgba(255,102,0,0.5))",
              animation: "border-sweep 6s linear infinite",
              textTransform: "uppercase",
            }}
          >
            One Sandwich. One Economy.
          </h2>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.72rem",
              color: "var(--text-primary)",
              opacity: 0.8,
              marginTop: "8px",
              letterSpacing: "1px",
            }}
          >
            tracking <span style={{ color: "var(--neon-orange)", textShadow: "0 0 6px rgba(255,102,0,0.7)" }}>fast-food inflation</span>{" "}
            in real time — built on{" "}
            <span style={{ color: "var(--neon-cyan)" }}>CPI</span>,{" "}
            <span style={{ color: "var(--neon-magenta)" }}>wholesale poultry</span>, and{" "}
            <span style={{ color: "var(--neon-green)" }}>service wages</span>.
          </p>
        </div>

        <div style={{ width: "100%", maxWidth: "720px" }}>
          <McChickenTile />
        </div>
      </main>

      <footer
        style={{
          textAlign: "center",
          padding: "16px 0",
          fontSize: "0.55rem",
          letterSpacing: "3px",
          color: "var(--text-secondary)",
          borderTop: "1px solid rgba(255,102,0,0.2)",
          background: "linear-gradient(90deg, rgba(255,102,0,0.04), transparent, rgba(0,255,255,0.04))",
          position: "relative",
          zIndex: 5,
        }}
      >
        ◆ MCCHICKEN INDEX™ ◆ DATA REFRESHED WEEKLY ◆{" "}
        <a
          href="https://mcchickenindex.org"
          style={{
            color: "var(--neon-orange)",
            textDecoration: "none",
            textShadow: "0 0 6px rgba(255,102,0,0.6)",
          }}
        >
          MCCHICKENINDEX.ORG
        </a>{" "}
        ◆
      </footer>
    </div>
  );
}
