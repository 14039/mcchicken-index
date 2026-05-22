"use client";

import { useState, useEffect, useMemo } from "react";
import DashboardTile from "./DashboardTile";
import LineChart, { type DataSeries } from "./LineChart";
import NewsSection from "./NewsSection";

interface CostComponent {
  key: string;
  label: string;
  weight: number;
  indexed: number;
  latestValue: number;
  unit: string;
  asOf: string;
  source: string;
  sourceUrl: string;
}
interface ContextSeries {
  label: string;
  value: number;
  unit: string;
  asOf: string;
  sourceUrl: string;
}
interface Current {
  available: boolean;
  headlineIndex?: number;
  headlineMethod?: "blended" | "retail-only";
  retailWeight?: number;
  costWeight?: number;
  retailIndex?: number;
  retailPrice?: number;
  costBasisIndex?: number | null;
  costComponents?: CostComponent[];
  marginSpreadPoints?: number | null;
  marginSpreadPct?: number | null;
  changes?: {
    headlineWoWPct: number | null;
    headlineWoWPoints: number | null;
    sinceBasePct: number;
    previousDate: string | null;
  };
  confidence?: "full" | "partial" | "retail-only";
  context?: ContextSeries[];
  retailSources?: string[];
  dataDate?: string | null;
  lastUpdated?: string;
  methodologyVersion?: string;
  notes?: string;
  news?: Array<{ title: string; url: string; source: string; date: string; summary?: string }>;
}
interface HistoryPoint {
  date: string;
  headlineIndex: number;
  retailIndex: number;
  retailPrice: number;
  costBasisIndex: number | null;
  observed: boolean;
}

const RANGES = ["1Y", "5Y", "ALL"];

export default function McChickenTile() {
  const [data, setData] = useState<Current | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [range, setRange] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/mcchicken")
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch(() => setData({ available: false }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(`/api/dashboard/mcchicken/history?range=${range}`)
      .then((r) => r.json())
      .then((j) => setHistory(j.history || []))
      .catch(() => setHistory([]));
  }, [range]);

  const chartSeries: DataSeries[] = useMemo(() => {
    if (history.length < 2) return [];
    const s: DataSeries[] = [
      { name: "Headline", color: "#ff8a3d", width: 2.5, data: history.map((h) => ({ date: h.date, value: h.headlineIndex })) },
      { name: "Retail", color: "#5bc0ff", width: 1.6, data: history.map((h) => ({ date: h.date, value: h.retailIndex })) },
    ];
    const cost = history.filter((h) => h.costBasisIndex != null);
    if (cost.length >= 2) {
      s.push({ name: "Cost basis", color: "#9b8cff", width: 1.6, style: "dashed", data: cost.map((h) => ({ date: h.date, value: h.costBasisIndex as number })) });
    }
    return s;
  }, [history]);

  const firstObserved = useMemo(
    () => history.find((h) => h.observed)?.date,
    [history]
  );

  if (loading) {
    return (
      <DashboardTile title="McChicken Index™" icon="🍔">
        <div style={{ minHeight: 200, display: "grid", placeItems: "center", color: "var(--text-secondary)", fontSize: "0.8rem" }}>
          Loading index data…
        </div>
      </DashboardTile>
    );
  }

  if (!data?.available || data.headlineIndex == null) {
    return (
      <DashboardTile title="McChicken Index™" icon="🍔">
        <div style={{ minHeight: 160, display: "grid", placeItems: "center", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.82rem", lineHeight: 1.6 }}>
          <div>
            <div style={{ fontSize: "1.1rem", marginBottom: 8 }}>No published reading yet</div>
            The index updates every Monday. Once the first reading is published it will appear here.
          </div>
        </div>
      </DashboardTile>
    );
  }

  const wow = data.changes?.headlineWoWPct ?? null;
  const wowKnown = wow !== null;
  const up = (wow ?? 0) >= 0;
  const blended = data.headlineMethod === "blended";
  const spread = data.marginSpreadPoints ?? null;

  return (
    <DashboardTile title="McChicken Index™" icon="🍔">
      {/* Badges */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        <Badge>BASE 2014 = 100</Badge>
        <Badge>{blended ? `BLENDED · ${Math.round((data.retailWeight ?? 0.6) * 100)}/${Math.round((data.costWeight ?? 0.4) * 100)} RETAIL/COST` : "RETAIL-ONLY"}</Badge>
        <Badge tone={data.confidence === "full" ? "ok" : "warn"}>
          CONFIDENCE: {(data.confidence ?? "—").toUpperCase()}
        </Badge>
      </div>

      {/* Headline */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "3.4rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
          {Math.round(data.headlineIndex)}
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: "1rem", fontWeight: 700, color: wowKnown ? (up ? "var(--pos)" : "var(--neg)") : "var(--text-secondary)" }}>
            {wowKnown ? `${up ? "▲" : "▼"} ${Math.abs(wow as number).toFixed(2)}% WoW` : "— WoW (first reading)"}
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
            {(data.changes?.sinceBasePct ?? 0) >= 0 ? "+" : ""}
            {(data.changes?.sinceBasePct ?? 0).toFixed(0)}% since 2014 base
          </span>
        </span>
      </div>

      {/* Layer stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 16 }}>
        <Stat label="Retail index" value={Math.round(data.retailIndex ?? 0)} sub={`$${(data.retailPrice ?? 0).toFixed(2)} / sandwich`} color="#5bc0ff" />
        <Stat label="Cost basis" value={data.costBasisIndex != null ? Math.round(data.costBasisIndex) : "—"} sub={data.costBasisIndex != null ? "chicken · labor · overhead" : "FRED inputs pending"} color="#9b8cff" />
        <Stat
          label="Margin spread"
          value={spread != null ? `${spread >= 0 ? "+" : ""}${spread.toFixed(0)}` : "—"}
          sub={spread != null ? (spread >= 0 ? "menu > costs (margin)" : "costs > menu (absorbing)") : "needs cost basis"}
          color={spread != null ? (spread >= 0 ? "var(--pos)" : "var(--neg)") : "var(--text-secondary)"}
        />
      </div>

      {data.notes && (
        <p style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: 10, fontStyle: "italic" }}>{data.notes}</p>
      )}

      {/* Chart */}
      <div style={{ marginTop: 18 }}>
        {chartSeries.length > 0 ? (
          <LineChart
            series={chartSeries}
            height={260}
            ranges={RANGES}
            selectedRange={range}
            onRangeChange={setRange}
            yLabel="Index (2014 = 100)"
            band={{ from: "Cost basis", to: "Retail", color: "rgba(255,138,61,0.10)" }}
            observedFrom={firstObserved}
          />
        ) : (
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Not enough history to chart yet.</div>
        )}
      </div>

      {/* Cost components */}
      {data.costComponents && data.costComponents.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <SectionLabel>INPUT-COST BASIS COMPONENTS</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {data.costComponents.map((c) => (
              <a key={c.key} href={c.sourceUrl} target="_blank" rel="noopener noreferrer"
                 style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: "0.72rem", color: "var(--text-secondary)", textDecoration: "none", padding: "3px 0", borderBottom: "1px solid rgba(230,232,240,0.06)" }}>
                <span style={{ flex: 1 }}>{c.label} <span style={{ opacity: 0.6 }}>({Math.round(c.weight * 100)}%)</span></span>
                <span>{c.latestValue} {c.unit}</span>
                <span style={{ color: "var(--text-primary)", minWidth: 44, textAlign: "right" }}>idx {Math.round(c.indexed)}</span>
                <span style={{ opacity: 0.55, minWidth: 58, textAlign: "right" }}>{c.asOf}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Context */}
      {data.context && data.context.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <SectionLabel>CONTEXT</SectionLabel>
          {data.context.map((c) => (
            <a key={c.label} href={c.sourceUrl} target="_blank" rel="noopener noreferrer"
               style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-secondary)", textDecoration: "none" }}>
              <span>{c.label}</span>
              <span style={{ color: "var(--text-primary)" }}>{c.value} <span style={{ opacity: 0.55 }}>· {c.asOf}</span></span>
            </a>
          ))}
        </div>
      )}

      {data.news && data.news.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <NewsSection items={data.news} maxItems={3} />
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: "0.62rem", color: "var(--text-secondary)", opacity: 0.7 }}>
          {data.lastUpdated ? `Updated ${new Date(data.lastUpdated).toISOString().split("T")[0]}` : ""}
          {data.retailSources && data.retailSources.length ? ` · retail: ${data.retailSources.join(", ")}` : ""}
          {` · v${data.methodologyVersion ?? "2.0"}`}
        </span>
        <a href="/methodology" style={{ fontSize: "0.66rem", fontFamily: "var(--font-mono)", color: "var(--accent)", textDecoration: "none" }}>
          Methodology &amp; API →
        </a>
      </div>
    </DashboardTile>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "ok" | "warn" }) {
  const color = tone === "ok" ? "var(--pos)" : tone === "warn" ? "var(--warn)" : "var(--text-secondary)";
  return (
    <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-mono)", letterSpacing: "0.5px", color, border: `1px solid ${color}`, opacity: 0.9, borderRadius: 3, padding: "3px 7px" }}>
      {children}
    </span>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: React.ReactNode; sub: string; color: string }) {
  return (
    <div style={{ border: "1px solid rgba(230,232,240,0.10)", borderRadius: 6, padding: "10px 12px" }}>
      <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)" }}>{sub}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "0.62rem", fontFamily: "var(--font-mono)", color: "var(--text-secondary)", letterSpacing: "1px", marginBottom: 6 }}>{children}</div>;
}
