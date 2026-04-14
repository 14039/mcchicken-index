"use client";

import McChickenTile from "@/components/McChickenTile";

export default function HomePage() {
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "1.4rem" }}>🍔</span>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.9rem",
              fontWeight: 700,
              letterSpacing: "4px",
              color: "var(--neon-orange)",
              textShadow: "0 0 10px rgba(255,102,0,0.4)",
            }}
          >
            MCCHICKEN INDEX™
          </h1>
        </div>
        <a
          href="/methodology"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "0.6rem",
            color: "var(--text-secondary)",
            textDecoration: "none",
            letterSpacing: "2px",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neon-orange)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
        >
          METHODOLOGY & API
        </a>
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          padding: "24px 16px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "700px" }}>
          <McChickenTile />
        </div>
      </main>

      <footer
        style={{
          textAlign: "center",
          padding: "16px 0",
          fontSize: "0.5rem",
          color: "var(--text-secondary)",
          borderTop: "1px solid rgba(255,102,0,0.1)",
          opacity: 0.6,
        }}
      >
        McChicken Index™ · Data updated weekly ·{" "}
        <a
          href="https://mcchickenindex.org"
          style={{ color: "var(--neon-orange)", textDecoration: "none" }}
        >
          mcchickenindex.org
        </a>
      </footer>
    </div>
  );
}
