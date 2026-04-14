"use client";

import { useState, useEffect, useMemo } from "react";
import DashboardTile from "./DashboardTile";
import LineChart, { type DataSeries } from "./LineChart";
import NewsSection from "./NewsSection";
import LiveIndicator from "./LiveIndicator";
import {
  getMcChickenPrice,
  getDailyChange,
  getSparkline,
  getYTDChange,
} from "@/lib/mcchicken";

interface McChickenData {
  indexValue: number;
  price: number;
  previousPrice: number;
  change: number;
  changePercent: number;
  regionalPrices: {
    northeast: number | null;
    south: number | null;
    midwest: number | null;
    west: number | null;
  };
  components: {
    cpiFood: number;
    chickenWholesale: number;
    avgFoodServiceWage: number;
    federalMinWage: number;
  };
  lastUpdated: string;
  methodologyVersion: string;
  source: string;
  dataSources: string[];
  news: Array<{
    title: string;
    url: string;
    source: string;
    date: string;
    summary?: string;
  }>;
}

interface HistoryPoint {
  date: string;
  price: number;
  indexValue: number;
}

const RANGES = ["1Y", "5Y", "ALL"];

export default function McChickenTile() {
  const [data, setData] = useState<McChickenData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [range, setRange] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const now = useMemo(() => new Date(), []);
  const fallbackDaily = useMemo(() => getDailyChange(now), [now]);
  const fallbackSparkline = useMemo(() => getSparkline(now, 30), [now]);
  const fallbackYtd = useMemo(() => getYTDChange(now), [now]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/dashboard/mcchicken");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // Use fallback
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch(`/api/dashboard/mcchicken/history?range=${range}`);
        if (res.ok) {
          const json = await res.json();
          if (json.history?.length > 0) {
            setHistory(json.history);
          }
        }
      } catch {
        // History unavailable
      }
    }
    fetchHistory();
  }, [range]);

  const price = data?.price ?? fallbackDaily.price;
  const indexValue = data?.indexValue ?? Math.round((price / 1.0) * 100);
  const change = data?.change ?? fallbackDaily.change;
  const changePercent = data?.changePercent ?? fallbackDaily.changePercent;
  const isUp = change >= 0;
  const news = data?.news || [];

  const chartSeries: DataSeries[] = useMemo(() => {
    if (history.length > 1) {
      return [
        {
          name: "McChicken Price",
          color: "#e87730",
          data: history.map((h) => ({ date: h.date, value: h.price })),
        },
      ];
    }
    return [
      {
        name: "30-Day Trend",
        color: isUp ? "#54d6a0" : "#ff6b8a",
        data: fallbackSparkline.map((v, i) => ({
          date: `Day ${i + 1}`,
          value: v,
        })),
      },
    ];
  }, [history, fallbackSparkline, isUp]);

  if (loading) {
    return (
      <DashboardTile title="McChicken Index™" icon="🍔" accentColor="var(--neon-orange)">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px" }}>
          <div className="animate-pulse-glow" style={{ color: "var(--text-secondary)", fontSize: "0.7rem" }}>
            Loading index data...
          </div>
        </div>
      </DashboardTile>
    );
  }

  return (
    <DashboardTile title="McChicken Index™" icon="🍔" accentColor="var(--neon-orange)">
      <LiveIndicator color="var(--neon-orange)" />
      {/* Price + Index */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "4px" }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            fontWeight: 800,
            color: "var(--neon-orange)",
            textShadow: "0 0 10px rgba(255,102,0,0.5)",
          }}
        >
          ${(price ?? 0).toFixed(2)}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.85rem",
            color: isUp ? "var(--neon-green)" : "var(--neon-magenta)",
            textShadow: isUp
              ? "0 0 6px rgba(0,255,102,0.4)"
              : "0 0 6px rgba(255,0,255,0.4)",
          }}
        >
          {changePercent !== 0
            ? `${isUp ? "▲" : "▼"} ${Math.abs(changePercent ?? 0).toFixed(2)}%`
            : "—"}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1rem",
            color: "var(--text-primary)",
          }}
        >
          INDEX: {indexValue}
        </span>
        <span
          style={{
            fontSize: "0.6rem",
            color: "var(--text-secondary)",
          }}
        >
          (Base: 100 = $1.00 in Jan 2014)
        </span>
      </div>

      <p style={{ fontSize: "0.65rem", color: "var(--text-secondary)", marginBottom: "10px" }}>
        Since 2014:{" "}
        <span style={{ color: "var(--neon-orange)" }}>
          +{((((price ?? 0) - 1.0) / 1.0) * 100).toFixed(0)}%
        </span>
        {data ? null : (
          <>
            {" "}· YTD:{" "}
            <span style={{ color: fallbackYtd.changePercent >= 0 ? "var(--neon-green)" : "var(--neon-magenta)" }}>
              {fallbackYtd.changePercent >= 0 ? "+" : ""}
              {(fallbackYtd.changePercent ?? 0).toFixed(2)}%
            </span>
          </>
        )}
      </p>

      {/* Chart */}
      <div style={{ position: "relative", marginBottom: "12px" }}>
        <div
          style={{
            fontSize: "0.6rem",
            color: "var(--text-secondary)",
            letterSpacing: "2px",
            marginBottom: "6px",
          }}
        >
          {history.length > 1 ? "PRICE HISTORY" : "30-DAY TREND"}
        </div>
        <LineChart
          series={chartSeries}
          height={180}
          ranges={history.length > 1 ? RANGES : undefined}
          selectedRange={range}
          onRangeChange={setRange}
          accentColor="#e87730"
          showLegend={false}
          valuePrefix="$"
        />
      </div>

      {data?.components && data.components.cpiFood > 0 && (
        <div style={{ marginBottom: "8px" }}>
          <div
            style={{
              fontSize: "0.55rem",
              fontFamily: "var(--font-display)",
              color: "var(--text-secondary)",
              letterSpacing: "2px",
              marginBottom: "4px",
            }}
          >
            ECONOMIC COMPONENTS
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "4px",
              fontSize: "0.6rem",
              color: "var(--text-secondary)",
            }}
          >
            <div>
              CPI Food:{" "}
              <span style={{ color: "var(--neon-cyan)" }}>
                {(data.components.cpiFood ?? 0).toFixed(1)}
              </span>
            </div>
            <div>
              Chicken:{" "}
              <span style={{ color: "var(--neon-cyan)" }}>
                {data.components.chickenWholesale}¢/lb
              </span>
            </div>
            <div>
              Avg Wage:{" "}
              <span style={{ color: "var(--neon-cyan)" }}>
                ${(data.components.avgFoodServiceWage ?? 0).toFixed(2)}/hr
              </span>
            </div>
            <div>
              Min Wage:{" "}
              <span style={{ color: "var(--neon-cyan)" }}>
                ${(data.components.federalMinWage ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      <NewsSection items={news} accentColor="var(--neon-orange)" maxItems={3} />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "8px",
        }}
      >
        <p style={{ fontSize: "0.5rem", color: "var(--text-secondary)", opacity: 0.5 }}>
          {data?.source || "Estimated"} · v{data?.methodologyVersion || "1.0"}
        </p>
        <a
          href="/methodology"
          style={{
            fontSize: "0.55rem",
            fontFamily: "var(--font-display)",
            color: "var(--neon-orange)",
            textDecoration: "none",
            letterSpacing: "1px",
            textShadow: "0 0 4px rgba(255,102,0,0.4)",
          }}
        >
          METHODOLOGY & API →
        </a>
      </div>
    </DashboardTile>
  );
}
