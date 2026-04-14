"use client";

import McChickenTile from "@/components/McChickenTile";

export default function HomePage() {
  return (
    <div className="page-wrapper">
      <header className="site-header">
        <div className="site-header__brand">
          <span className="site-header__icon">🍔</span>
          <h1 className="site-header__title">MCCHICKEN INDEX™</h1>
        </div>
        <a href="/methodology" className="site-header__nav-link">
          Methodology & API
        </a>
      </header>

      <main className="page-content">
        <div className="page-container">
          <McChickenTile />
        </div>
      </main>

      <footer className="site-footer">
        McChicken Index™ · Data updated weekly ·{" "}
        <a href="https://mcchickenindex.org">mcchickenindex.org</a>
      </footer>
    </div>
  );
}
