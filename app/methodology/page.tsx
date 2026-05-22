"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FRED_SERIES } from "@/lib/fred";
import baseEvidence from "../../data/base-period-evidence.json";

interface Current {
  available?: boolean;
  headlineIndex?: number;
  retailIndex?: number;
  retailPrice?: number;
  costBasisIndex?: number | null;
  marginSpreadPoints?: number | null;
  headlineMethod?: string;
  confidence?: string;
  lastUpdated?: string;
}
interface HistoryPoint {
  date: string;
  headlineIndex: number;
  retailIndex: number;
  retailPrice: number;
  costBasisIndex: number | null;
  observed: boolean;
  source?: string;
}
interface Evidence {
  title: string;
  url: string;
  date: string;
  excerpt: string;
  reliability: string;
}

export default function MethodologyPage() {
  const [cur, setCur] = useState<Current | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    fetch("/api/dashboard/mcchicken").then((r) => r.json()).then(setCur).catch(() => {});
    fetch("/api/dashboard/mcchicken/history?range=ALL")
      .then((r) => r.json())
      .then((d) => setHistory(d.history || []))
      .catch(() => {});
  }, []);

  const evidence = ((baseEvidence as { evidence?: Evidence[] }).evidence ?? []).slice(0, 5);

  return (
    <div className="page">
      <header className="site-header">
        <Link className="brand" href="/" style={{ textDecoration: "none" }}>
          <span aria-hidden>🍔</span>
          <span>MCCHICKEN INDEX™</span>
        </Link>
        <nav style={{ display: "flex", gap: 8 }}>
          <Link className="nav-link" href="/">Dashboard</Link>
          <Link className="nav-link" href="/journal">Journal</Link>
        </nav>
      </header>

      <main className="main">
        {/* Live snapshot */}
        <section style={{ textAlign: "center", marginBottom: 36 }}>
          <div className="muted" style={{ fontSize: "0.7rem", letterSpacing: 1 }}>
            CURRENT HEADLINE INDEX
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "3.4rem", fontWeight: 800, color: "var(--accent)" }}>
            {cur?.headlineIndex != null ? Math.round(cur.headlineIndex) : "—"}
          </div>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            retail {cur?.retailIndex != null ? Math.round(cur.retailIndex) : "—"} · cost basis{" "}
            {cur?.costBasisIndex != null ? Math.round(cur.costBasisIndex) : "—"} · spread{" "}
            {cur?.marginSpreadPoints != null
              ? `${cur.marginSpreadPoints >= 0 ? "+" : ""}${Math.round(cur.marginSpreadPoints)}`
              : "—"}{" "}
            · base 100 = $1.00 (Jan 2014)
          </div>
        </section>

        <Section title="WHAT IT MEASURES">
          <p>
            The McChicken Index™ tracks U.S. fast-food inflation through one standardized item — the
            McDonald&apos;s McChicken — and anchors it to the real cost of producing and selling that
            item. Inspired by The Economist&apos;s Big Mac Index, but extended with an input-cost
            model so the headline reflects financial reality, not just menu-board promotions.
          </p>
        </Section>

        <Section title="HOW THE INDEX IS BUILT">
          <p>Three layered series, all base period January 2014 = 100:</p>
          <Formula>
            Retail Index = national-average McChicken price ÷ $1.00 × 100
          </Formula>
          <Formula>
            Cost-Basis Index = Σ (weightᵢ × seriesᵢ ÷ seriesᵢ@2014 × 100)
          </Formula>
          <Formula>
            <strong style={{ color: "var(--accent)" }}>
              Headline Index = 0.60 × Retail + 0.40 × Cost-Basis
            </strong>
          </Formula>
          <p style={{ marginTop: 12 }}>
            <strong>Margin Spread = Retail Index − Cost-Basis Index.</strong> A positive spread means
            the menu price is outrunning input costs (margin expansion); negative means costs are
            outrunning the menu price (McDonald&apos;s absorbing cost). This is the headline analytic
            signal for investors and researchers.
          </p>
          <p style={{ marginTop: 12 }}>
            The 60/40 blend keeps a transient promotion (e.g. a value-menu rollback) from swinging
            the headline while still letting observed prices lead. When a cost input is temporarily
            unavailable, its weight is redistributed across the remaining inputs and the published{" "}
            <em>confidence</em> flag drops to <code>partial</code>; if no cost data is available the
            headline falls back to retail-only and says so. We never substitute an estimated number.
          </p>
        </Section>

        <Section title="COST-BASIS WEIGHTS">
          <p style={{ marginBottom: 10 }}>
            Weights approximate quick-service-restaurant unit economics (food, labor, and
            occupancy/overhead each ≈ a third of operating cost; operating margin excluded):
          </p>
          <Row k="Chicken commodity" v="35%" />
          <Row k="Food-service labor" v="30%" />
          <Row k="Overhead (core-CPI proxy: rent, energy, G&A)" v="35%" />
        </Section>

        <Section title="DATA SOURCES">
          <p style={{ marginBottom: 10 }}>
            Economic inputs come from authoritative BLS series via the St. Louis Fed (FRED). The
            observed retail price has no public API, so it is gathered weekly by AI web search of
            price aggregators (primarily MenuPriceTracker) and validated before publishing.
          </p>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.values(FRED_SERIES).map((s) => (
              <li key={s.id} style={{ fontSize: "0.82rem" }}>
                <span className="accent">▸</span> {s.label} —{" "}
                <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {s.source} ({s.id})
                </a>
              </li>
            ))}
            <li style={{ fontSize: "0.82rem" }}>
              <span className="accent">▸</span> Retail McChicken price — MenuPriceTracker &amp; fast-food
              aggregators (AI-aggregated, validated)
            </li>
          </ul>
        </Section>

        <Section title="DATA INTEGRITY">
          <p>Every weekly retail read passes three checks before it can enter the index:</p>
          <ul style={{ marginTop: 8, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            <li>
              <strong>Plausibility band:</strong> a national average outside $1.50–$6.00 is rejected.
            </li>
            <li>
              <strong>Average-vs-minimum guard:</strong> if the reported &quot;average&quot; equals the
              range minimum, it is treated as the <em>cheapest</em> price (not the average) and
              rejected — the failure mode that once put a spurious $1.79 / index-179 point in the data.
            </li>
            <li>
              <strong>Week-over-week guard:</strong> moves over ±15% are quarantined and withheld
              until a second independent reading confirms the new level, so a one-off bad read is
              never published while genuine regime shifts still come through.
            </li>
          </ul>
          <p style={{ marginTop: 10 }} className="muted">
            Update cadence: weekly, Mondays 08:00 UTC. Method version 2.0.
          </p>
        </Section>

        {/* Historical table */}
        <Section title="HISTORY">
          {history.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr>
                    {["Date", "Headline", "Retail", "Cost basis", "Price", "Type"].map((h) => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.slice().reverse().map((h, i) => (
                    <tr key={i}>
                      <td style={td}>{h.date}</td>
                      <td style={{ ...td, color: "var(--accent)", fontWeight: 600 }}>{Math.round(h.headlineIndex)}</td>
                      <td style={td}>{Math.round(h.retailIndex)}</td>
                      <td style={td}>{h.costBasisIndex != null ? Math.round(h.costBasisIndex) : "—"}</td>
                      <td style={td}>${h.retailPrice.toFixed(2)}</td>
                      <td style={{ ...td, color: "var(--text-secondary)" }}>{h.observed ? "observed" : "historical"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Loading…</p>
          )}
        </Section>

        <Section title="BASE PERIOD (JANUARY 2014 = $1.00)">
          <p style={{ marginBottom: 10 }}>
            The McChicken was a $1.00 Dollar Menu staple through the menu&apos;s 2013 restructuring.
            Supporting evidence:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {evidence.map((ev, i) => (
              <a key={i} href={ev.url} target="_blank" rel="noopener noreferrer"
                 style={{ border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", textDecoration: "none", color: "var(--text-secondary)" }}>
                <div style={{ color: "var(--text-primary)", fontSize: "0.82rem" }}>{ev.title}</div>
                <div style={{ fontSize: "0.72rem", fontStyle: "italic", marginTop: 2 }}>
                  &quot;{ev.excerpt.slice(0, 120)}{ev.excerpt.length > 120 ? "…" : ""}&quot;
                </div>
                <div style={{ fontSize: "0.66rem", color: "var(--accent)", marginTop: 2 }}>
                  {ev.date} · reliability: {ev.reliability}
                </div>
              </a>
            ))}
          </div>
        </Section>

        <Section title="API">
          <p>Free, public, no authentication.</p>
          <Formula>GET https://mcchickenindex.org/api/mcchicken?range=1Y</Formula>
          <p className="muted" style={{ fontSize: "0.78rem", marginTop: 8 }}>
            Returns headline, retail and cost-basis layers, margin spread, week-over-week change,
            confidence, and (with <code>range</code>) the full series. Ranges: 1M, 3M, 6M, 1Y, 3Y, 5Y, ALL.
          </p>
        </Section>

        <footer className="muted" style={{ borderTop: "1px solid var(--border)", paddingTop: 16, fontSize: "0.74rem", textAlign: "center" }}>
          McChicken Index™ · methodology v2.0 ·{" "}
          {cur?.lastUpdated ? `data updated ${new Date(cur.lastUpdated).toISOString().split("T")[0]}` : "updated weekly"}
        </footer>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", fontWeight: 700, letterSpacing: 1, color: "var(--accent)", borderBottom: "1px solid var(--border)", paddingBottom: 8, marginBottom: 14 }}>
        {title}
      </h2>
      <div style={{ fontSize: "0.88rem", lineHeight: 1.65, color: "var(--text-secondary)" }}>{children}</div>
    </section>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 6, padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: "0.86rem", color: "var(--text-primary)", margin: "8px 0" }}>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.84rem", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
      <span>{k}</span>
      <span className="accent" style={{ fontWeight: 600 }}>{v}</span>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "7px 8px",
  borderBottom: "1px solid var(--border-strong)",
  color: "var(--text-secondary)",
  fontSize: "0.7rem",
  letterSpacing: 0.5,
  textTransform: "uppercase",
};
const td: React.CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid var(--border)",
  color: "var(--text-primary)",
};
