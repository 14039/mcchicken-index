"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface HistoryPoint {
  date: string;
  price: number;
  indexValue: number;
  source?: string;
}

interface Methodology {
  version: string;
  indexName: string;
  definition: string;
  basePeriod: {
    date: string;
    price: number;
    indexValue: number;
    justification: string;
    evidence: unknown;
  };
  calculation: {
    formula: string;
    example: string;
  };
  dataCollection: {
    frequency: string;
    method: string;
    sources: string[];
    processing: string[];
  };
  constituentComponents: {
    description: string;
    components: Array<{
      name: string;
      source: string;
      description: string;
    }>;
  };
  api: {
    endpoint: string;
    parameters: Record<string, string>;
    response: Record<string, string>;
  };
}

interface EvidenceItem {
  type: string;
  title: string;
  url: string;
  date: string;
  excerpt: string;
  reliability: string;
}

function extractEvidence(evidence: unknown): EvidenceItem[] {
  if (Array.isArray(evidence)) return evidence;
  if (evidence && typeof evidence === "object" && "evidence" in evidence) {
    const nested = (evidence as { evidence: unknown }).evidence;
    if (Array.isArray(nested)) return nested;
  }
  return [];
}

export default function MethodologyPage() {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [methodology, setMethodology] = useState<Methodology | null>(null);
  const [currentIndex, setCurrentIndex] = useState<{
    value: number;
    price: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/mcchicken/history?range=ALL")
      .then((r) => r.json())
      .then((d) => setHistory(d.history || []))
      .catch(() => {});

    fetch("/api/dashboard/mcchicken")
      .then((r) => r.json())
      .then((d) =>
        setCurrentIndex({ value: d.indexValue || 0, price: d.price || 0 })
      )
      .catch(() => {});

    fetch("/api/mcchicken")
      .then((r) => r.json())
      .catch(() => {});

    import("../../data/methodology.json")
      .then((m) => setMethodology(m.default as unknown as Methodology))
      .catch(() => {});
  }, []);

  return (
    <div className="page-wrapper">
      {/* Header */}
      <header className="site-header">
        <Link href="/" className="site-header__nav-link">
          ← Dashboard
        </Link>
        <div className="site-header__brand">
          <span className="site-header__icon">🍔</span>
          <h1 className="site-header__title">MCCHICKEN INDEX™</h1>
        </div>
      </header>

      <main className="page-content">
        <div className="page-container" style={{ maxWidth: "900px" }}>
          {/* Hero */}
          <section
            className="card card--accent-top"
            style={{
              textAlign: "center",
              marginBottom: "32px",
              padding: "32px 24px",
            }}
          >
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                letterSpacing: "2px",
                marginBottom: "8px",
                textTransform: "uppercase",
              }}
            >
              Current Index Value
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "3.5rem",
                fontWeight: 700,
                color: "var(--accent)",
                lineHeight: 1,
              }}
            >
              {currentIndex?.value || "—"}
            </div>
            <div
              style={{
                fontSize: "1rem",
                color: "var(--text-secondary)",
                marginTop: "8px",
              }}
            >
              ${currentIndex?.price?.toFixed(2) || "—"} per McChicken
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginTop: "6px",
              }}
            >
              Base: 100 = $1.00 (January 2014)
            </div>
          </section>

          {/* What is the McChicken Index */}
          <Section title="What is the McChicken Index?">
            <p>
              The McChicken Index™ tracks the average price of a McDonald&apos;s
              McChicken sandwich in the United States as an economic indicator
              for food price inflation, labor costs, and consumer purchasing
              power.
            </p>
            <p style={{ marginTop: "12px" }}>
              Inspired by The Economist&apos;s famous{" "}
              <em>Big Mac Index</em> — which uses Big Mac prices to measure
              purchasing power parity between countries — our McChicken Index
              focuses on tracking a single standardized menu item over time
              within the US to illustrate domestic food inflation.
            </p>
            <p style={{ marginTop: "12px" }}>
              The McChicken was chosen because it was a cornerstone of
              McDonald&apos;s Dollar Menu from its inception in 2002 through
              2017, making it an ideal baseline for measuring how fast food
              prices have evolved alongside broader economic forces.
            </p>
          </Section>

          {/* Methodology */}
          <Section title="Methodology">
            <h3 className="section-subtitle">Index Calculation</h3>
            <div className="endpoint-box" style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "0.9rem", color: "var(--accent)" }}>
                Index Value = (National Avg McChicken Price / $1.00) × 100
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                  marginTop: "6px",
                }}
              >
                Example: If the national average is $2.99, the index value is
                299 (a 199% increase from the base period).
              </div>
            </div>

            <h3 className="section-subtitle">Base Period: January 2014</h3>
            <p>
              We use January 2014 as our base period with a base price of{" "}
              <strong style={{ color: "var(--accent)" }}>$1.00</strong>. The
              McChicken was part of McDonald&apos;s Dollar Menu, which kept it
              at exactly $1.00 from 2002 through the menu&apos;s restructuring
              in late 2013.
            </p>

            {methodology?.basePeriod &&
              extractEvidence(methodology.basePeriod.evidence).length > 0 && (
                <div style={{ marginTop: "16px" }}>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      letterSpacing: "1px",
                      marginBottom: "10px",
                      textTransform: "uppercase",
                    }}
                  >
                    Supporting Evidence
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {extractEvidence(methodology.basePeriod.evidence)
                      .slice(0, 6)
                      .map((ev, i) => (
                        <a
                          key={i}
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="evidence-item"
                        >
                          <div
                            style={{
                              fontSize: "0.875rem",
                              color: "var(--text-primary)",
                              marginBottom: "4px",
                              lineHeight: 1.4,
                            }}
                          >
                            {ev.title}
                          </div>
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--text-muted)",
                              fontStyle: "italic",
                              lineHeight: 1.5,
                            }}
                          >
                            &quot;{ev.excerpt.substring(0, 150)}
                            {ev.excerpt.length > 150 ? "..." : ""}&quot;
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              marginTop: "6px",
                            }}
                          >
                            <span className="badge badge--amber">{ev.type}</span>
                            <span className="badge badge--muted">{ev.date}</span>
                            <span className="badge badge--green">
                              {ev.reliability}
                            </span>
                          </div>
                        </a>
                      ))}
                  </div>
                </div>
              )}

            <h3
              className="section-subtitle"
              style={{ marginTop: "24px" }}
            >
              Data Collection
            </h3>
            <p>
              Price data is collected weekly via AI-powered web search
              aggregation across multiple sources:
            </p>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                marginTop: "10px",
              }}
            >
              {(
                methodology?.dataCollection?.sources || [
                  "MenuPriceTracker.com (9,000+ McDonald's locations)",
                  "McDonald's official app/website pricing",
                  "Fast food price aggregator sites",
                  "News articles reporting McDonald's prices",
                ]
              ).map((s, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: "0.875rem",
                    padding: "6px 0",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ color: "var(--accent)" }}>▸</span>
                  {s}
                </li>
              ))}
            </ul>

            <h3
              className="section-subtitle"
              style={{ marginTop: "24px" }}
            >
              Constituent Components
            </h3>
            <p style={{ marginBottom: "12px" }}>
              These economic indicators provide context for price movements.
              They are not used in the index calculation but help explain{" "}
              <em>why</em> the McChicken price changes.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {(
                methodology?.constituentComponents?.components || [
                  {
                    name: "CPI for Food Away From Home",
                    source: "Bureau of Labor Statistics",
                    description:
                      "Consumer Price Index for restaurant and takeout food",
                  },
                  {
                    name: "Chicken Wholesale Price",
                    source: "USDA",
                    description:
                      "National broiler chicken composite wholesale price",
                  },
                  {
                    name: "Food Service Worker Wages",
                    source: "Bureau of Labor Statistics",
                    description:
                      "Average hourly earnings for food services workers",
                  },
                  {
                    name: "Federal Minimum Wage",
                    source: "US Department of Labor",
                    description: "Federal minimum wage floor",
                  },
                ]
              ).map((c, i) => (
                <div
                  key={i}
                  className="card"
                  style={{ padding: "12px 16px" }}
                >
                  <div
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--text-primary)",
                      fontWeight: 600,
                      marginBottom: "2px",
                    }}
                  >
                    {c.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {c.description} —{" "}
                    <em style={{ color: "var(--text-muted)" }}>{c.source}</em>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Historical Data */}
          <Section title="Historical Data">
            {history.length > 0 ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Price</th>
                      <th>Index</th>
                      <th>Change</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => {
                      const prevPrice = i > 0 ? history[i - 1].price : 1.0;
                      const changePct =
                        ((h.price - prevPrice) / prevPrice) * 100;
                      return (
                        <tr key={i}>
                          <td>{h.date}</td>
                          <td
                            style={{
                              color: "var(--accent)",
                              fontFamily: "var(--font-mono)",
                              fontWeight: 600,
                            }}
                          >
                            ${(h.price ?? 0).toFixed(2)}
                          </td>
                          <td
                            style={{
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            {h.indexValue}
                          </td>
                          <td
                            style={{
                              color:
                                changePct >= 0
                                  ? "var(--green)"
                                  : "var(--red)",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            {i > 0
                              ? `${changePct >= 0 ? "+" : ""}${(changePct ?? 0).toFixed(1)}%`
                              : "—"}
                          </td>
                          <td
                            style={{
                              color: "var(--text-muted)",
                              fontSize: "0.8rem",
                            }}
                          >
                            {h.source || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                Loading historical data...
              </p>
            )}
          </Section>

          {/* API Documentation */}
          <Section title="API Access">
            <p>
              The McChicken Index is available as a free, public JSON API. No
              authentication required.
            </p>

            <div style={{ marginTop: "20px" }}>
              <h3 className="section-subtitle">Endpoint</h3>
              <div className="endpoint-box">
                GET https://mcchickenindex.org/api/mcchicken
              </div>
            </div>

            <div style={{ marginTop: "20px" }}>
              <h3 className="section-subtitle">Query Parameters</h3>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Type</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td
                        style={{
                          color: "var(--teal)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        range
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>string</td>
                      <td>
                        Optional. One of: 1M, 3M, 6M, 1Y, 3Y, 5Y, ALL.
                        Includes historical data in response.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: "20px" }}>
              <h3 className="section-subtitle">Example Response</h3>
              <pre className="code-block">
                {JSON.stringify(
                  {
                    index: {
                      value: 299,
                      price: 2.99,
                      change: 0.1,
                      changePercent: 3.45,
                      basePeriod: "2014-01",
                      basePrice: 1.0,
                      lastUpdated: "2026-04-10T08:00:00Z",
                      methodologyVersion: "1.0",
                    },
                    api: {
                      version: "1.0",
                      documentation:
                        "https://mcchickenindex.org/methodology",
                    },
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </Section>
        </div>
      </main>

      <footer className="site-footer">
        McChicken Index™ · Methodology v
        {methodology?.version || "1.0"} · Data updated weekly
        <br />
        <a href="https://mcchickenindex.org" style={{ marginTop: "4px", display: "inline-block" }}>
          mcchickenindex.org
        </a>
      </footer>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: "40px" }}>
      <h2 className="section-title">{title}</h2>
      <div
        style={{
          fontSize: "0.875rem",
          lineHeight: 1.7,
          color: "var(--text-secondary)",
        }}
      >
        {children}
      </div>
    </section>
  );
}
