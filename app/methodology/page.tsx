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
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-dark)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 32px",
          borderBottom: "1px solid rgba(255,102,0,0.2)",
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "0.8rem",
            color: "var(--neon-cyan)",
            textDecoration: "none",
            letterSpacing: "3px",
          }}
        >
          ← DASHBOARD
        </Link>
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
          🍔 MCCHICKEN INDEX™
        </h1>
      </header>

      <main
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          padding: "32px 24px",
        }}
      >
        {/* Hero Section */}
        <section style={{ textAlign: "center", marginBottom: "48px" }}>
          <div
            style={{
              fontSize: "0.6rem",
              color: "var(--text-secondary)",
              letterSpacing: "3px",
              marginBottom: "8px",
            }}
          >
            CURRENT INDEX VALUE
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "4rem",
              fontWeight: 800,
              color: "var(--neon-orange)",
              textShadow: "0 0 20px rgba(255,102,0,0.5)",
              lineHeight: 1,
            }}
          >
            {currentIndex?.value || "—"}
          </div>
          <div
            style={{
              fontSize: "1.2rem",
              color: "var(--text-secondary)",
              marginTop: "4px",
            }}
          >
            ${currentIndex?.price?.toFixed(2) || "—"} per McChicken
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              color: "var(--text-secondary)",
              marginTop: "8px",
              opacity: 0.6,
            }}
          >
            Base: 100 = $1.00 (January 2014)
          </div>
        </section>

        {/* What is the McChicken Index */}
        <Section title="WHAT IS THE MCCHICKEN INDEX?">
          <p>
            The McChicken Index™ tracks the average price of a McDonald&apos;s
            McChicken sandwich in the United States as an economic indicator for
            food price inflation, labor costs, and consumer purchasing power.
          </p>
          <p style={{ marginTop: "12px" }}>
            Inspired by The Economist&apos;s famous{" "}
            <em>Big Mac Index</em> — which uses Big Mac prices to measure
            purchasing power parity between countries — our McChicken Index
            focuses on tracking a single standardized menu item over time within
            the US to illustrate domestic food inflation.
          </p>
          <p style={{ marginTop: "12px" }}>
            The McChicken was chosen because it was a cornerstone of
            McDonald&apos;s Dollar Menu from its inception in 2002 through 2017,
            making it an ideal baseline for measuring how fast food prices have
            evolved alongside broader economic forces.
          </p>
        </Section>

        {/* Methodology */}
        <Section title="METHODOLOGY">
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.7rem",
              color: "var(--neon-orange)",
              letterSpacing: "2px",
              marginBottom: "8px",
            }}
          >
            INDEX CALCULATION
          </h3>
          <div
            style={{
              background: "rgba(255,102,0,0.05)",
              border: "1px solid rgba(255,102,0,0.2)",
              padding: "16px",
              fontFamily: "var(--font-mono)",
              marginBottom: "16px",
            }}
          >
            <div style={{ fontSize: "0.85rem", color: "var(--neon-orange)" }}>
              Index Value = (National Avg McChicken Price / $1.00) × 100
            </div>
            <div
              style={{
                fontSize: "0.65rem",
                color: "var(--text-secondary)",
                marginTop: "8px",
              }}
            >
              Example: If the national average is $2.99, the index value is 299
              (a 199% increase from the base period).
            </div>
          </div>

          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.7rem",
              color: "var(--neon-orange)",
              letterSpacing: "2px",
              marginBottom: "8px",
            }}
          >
            BASE PERIOD: JANUARY 2014
          </h3>
          <p>
            We use January 2014 as our base period with a base price of{" "}
            <strong style={{ color: "var(--neon-orange)" }}>$1.00</strong>. The
            McChicken was part of McDonald&apos;s Dollar Menu, which kept it at
            exactly $1.00 from 2002 through the menu&apos;s restructuring in
            late 2013.
          </p>

          {methodology?.basePeriod && extractEvidence(methodology.basePeriod.evidence).length > 0 && (
            <div style={{ marginTop: "12px" }}>
              <div
                style={{
                  fontSize: "0.6rem",
                  color: "var(--text-secondary)",
                  letterSpacing: "2px",
                  marginBottom: "8px",
                }}
              >
                SUPPORTING EVIDENCE
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                {extractEvidence(methodology.basePeriod.evidence).slice(0, 6).map((ev, i) => (
                  <a
                    key={i}
                    href={ev.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block",
                      padding: "8px 12px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      textDecoration: "none",
                      transition: "all 0.15s",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-primary)",
                        marginBottom: "2px",
                      }}
                    >
                      {ev.title}
                    </div>
                    <div
                      style={{
                        fontSize: "0.55rem",
                        color: "var(--text-secondary)",
                        fontStyle: "italic",
                      }}
                    >
                      &quot;{ev.excerpt.substring(0, 120)}
                      {ev.excerpt.length > 120 ? "..." : ""}&quot;
                    </div>
                    <div
                      style={{
                        fontSize: "0.5rem",
                        color: "var(--neon-orange)",
                        marginTop: "2px",
                        opacity: 0.7,
                      }}
                    >
                      {ev.type} · {ev.date} · Reliability: {ev.reliability}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.7rem",
              color: "var(--neon-orange)",
              letterSpacing: "2px",
              marginTop: "24px",
              marginBottom: "8px",
            }}
          >
            DATA COLLECTION
          </h3>
          <p>
            Price data is collected weekly via AI-powered web search aggregation
            across multiple sources:
          </p>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              marginTop: "8px",
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
                  fontSize: "0.7rem",
                  padding: "4px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                }}
              >
                <span style={{ color: "var(--neon-orange)", marginRight: "8px" }}>
                  ▸
                </span>
                {s}
              </li>
            ))}
          </ul>

          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.7rem",
              color: "var(--neon-orange)",
              letterSpacing: "2px",
              marginTop: "24px",
              marginBottom: "8px",
            }}
          >
            CONSTITUENT COMPONENTS
          </h3>
          <p style={{ marginBottom: "12px" }}>
            These economic indicators provide context for price movements. They
            are not used in the index calculation but help explain{" "}
            <em>why</em> the McChicken price changes.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
                style={{
                  padding: "8px 12px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--text-primary)",
                    fontWeight: 600,
                  }}
                >
                  {c.name}
                </div>
                <div
                  style={{ fontSize: "0.6rem", color: "var(--text-secondary)" }}
                >
                  {c.description} — <em>{c.source}</em>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Historical Data Table */}
        <Section title="HISTORICAL DATA">
          {history.length > 0 ? (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.7rem",
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Price</th>
                  <th style={thStyle}>Index</th>
                  <th style={thStyle}>Change</th>
                  <th style={thStyle}>Source</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => {
                  const prevPrice =
                    i > 0 ? history[i - 1].price : 1.0;
                  const changePct = ((h.price - prevPrice) / prevPrice) * 100;
                  return (
                    <tr key={i}>
                      <td style={tdStyle}>{h.date}</td>
                      <td
                        style={{
                          ...tdStyle,
                          color: "var(--neon-orange)",
                          fontFamily: "var(--font-display)",
                        }}
                      >
                        ${(h.price ?? 0).toFixed(2)}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: "var(--text-primary)",
                        }}
                      >
                        {h.indexValue}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color:
                            changePct >= 0
                              ? "var(--neon-green)"
                              : "var(--neon-magenta)",
                        }}
                      >
                        {i > 0
                          ? `${changePct >= 0 ? "+" : ""}${(changePct ?? 0).toFixed(1)}%`
                          : "—"}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: "var(--text-secondary)",
                          fontSize: "0.6rem",
                        }}
                      >
                        {h.source || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p style={{ color: "var(--text-secondary)", fontSize: "0.7rem" }}>
              Loading historical data...
            </p>
          )}
        </Section>

        {/* API Documentation */}
        <Section title="API ACCESS">
          <p>
            The McChicken Index is available as a free, public JSON API. No
            authentication required.
          </p>

          <div style={{ marginTop: "16px" }}>
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "0.7rem",
                color: "var(--neon-orange)",
                letterSpacing: "2px",
                marginBottom: "8px",
              }}
            >
              ENDPOINT
            </h3>
            <div
              style={{
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,102,0,0.2)",
                padding: "12px 16px",
                fontFamily: "var(--font-mono)",
                fontSize: "0.8rem",
                color: "var(--neon-cyan)",
              }}
            >
              GET https://mcchickenindex.org/api/mcchicken
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "0.7rem",
                color: "var(--neon-orange)",
                letterSpacing: "2px",
                marginBottom: "8px",
              }}
            >
              QUERY PARAMETERS
            </h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.7rem" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Parameter</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...tdStyle, color: "var(--neon-cyan)" }}>range</td>
                  <td style={tdStyle}>string</td>
                  <td style={tdStyle}>
                    Optional. One of: 1M, 3M, 6M, 1Y, 3Y, 5Y, ALL. Includes
                    historical data in response.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: "16px" }}>
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "0.7rem",
                color: "var(--neon-orange)",
                letterSpacing: "2px",
                marginBottom: "8px",
              }}
            >
              EXAMPLE RESPONSE
            </h3>
            <pre
              style={{
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.06)",
                padding: "16px",
                fontSize: "0.65rem",
                overflow: "auto",
                color: "var(--text-secondary)",
              }}
            >
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
                    documentation: "https://mcchickenindex.org/methodology",
                  },
                },
                null,
                2
              )}
            </pre>
          </div>
        </Section>

        <footer
          style={{
            textAlign: "center",
            padding: "32px 0",
            fontSize: "0.6rem",
            color: "var(--text-secondary)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            marginTop: "48px",
          }}
        >
          <div style={{ marginBottom: "8px" }}>
            McChicken Index™ · Methodology v
            {methodology?.version || "1.0"} · Data updated weekly
          </div>
          <div>
            <a
              href="https://mcchickenindex.org"
              style={{
                color: "var(--neon-orange)",
                textDecoration: "none",
              }}
            >
              mcchickenindex.org
            </a>
          </div>
        </footer>
      </main>
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
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "3px",
          color: "var(--neon-orange)",
          textShadow: "0 0 8px rgba(255,102,0,0.3)",
          borderBottom: "1px solid rgba(255,102,0,0.2)",
          paddingBottom: "8px",
          marginBottom: "16px",
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: "0.75rem", lineHeight: 1.7, color: "var(--text-secondary)" }}>
        {children}
      </div>
    </section>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  color: "var(--text-secondary)",
  fontFamily: "var(--font-display)",
  fontSize: "0.6rem",
  letterSpacing: "1px",
  fontWeight: 500,
};

const tdStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid rgba(255,255,255,0.03)",
  color: "var(--text-primary)",
};
