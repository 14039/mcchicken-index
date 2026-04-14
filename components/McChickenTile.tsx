"use client";

import { useState, useEffect, useMemo } from "react";
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
        const res = await fetch(
          `/api/dashboard/mcchicken/history?range=${range}`
        );
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
  const since2014 = (((price ?? 0) - 1.0) / 1.0) * 100;

  const chartSeries: DataSeries[] = useMemo(() => {
    if (history.length > 1) {
      return [
        {
          name: "McChicken Price",
          color: "#e8873a",
          data: history.map((h) => ({ date: h.date, value: h.price })),
        },
      ];
    }
    return [
      {
        name: "30-Day Trend",
        color: isUp ? "#4ade80" : "#f87171",
        data: fallbackSparkline.map((v, i) => ({
          date: `Day ${i + 1}`,
          value: v,
        })),
      },
    ];
  }, [history, fallbackSparkline, isUp]);

  if (loading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "64px 24px" }}>
        <div className="animate-pulse-glow" style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Loading index data...
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Row 1: Price Card + Stats Card */}
      <div className="grid-2">
        {/* Price Card */}
        <div className="card card--accent-top" style={{ position: "relative" }}>
          <LiveIndicator color="var(--accent)" />
          <div
            style={{
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              marginBottom: "4px",
              letterSpacing: "0.5px",
            }}
          >
            McChicken Index™
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "12px",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "2.5rem",
                fontWeight: 700,
                color: "var(--accent)",
                lineHeight: 1,
              }}
            >
              ${(price ?? 0).toFixed(2)}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "1rem",
                fontWeight: 600,
                color: isUp ? "var(--green)" : "var(--red)",
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
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              INDEX: {indexValue}
            </span>
            <span
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
              }}
            >
              Base: 100 = $1.00 (Jan 2014)
            </span>
          </div>
        </div>

        {/* Stats Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div className="grid-2" style={{ gap: "16px" }}>
            <div className="stat-block">
              <span className="stat-block__label">Index Value</span>
              <span className="stat-block__value">{indexValue}</span>
            </div>
            <div className="stat-block">
              <span className="stat-block__label">Since 2014</span>
              <span
                className="stat-block__value"
                style={{ color: "var(--accent)" }}
              >
                +{since2014.toFixed(0)}%
              </span>
            </div>
            {!data && (
              <div className="stat-block">
                <span className="stat-block__label">YTD Change</span>
                <span
                  className="stat-block__value"
                  style={{
                    color:
                      fallbackYtd.changePercent >= 0
                        ? "var(--green)"
                        : "var(--red)",
                  }}
                >
                  {fallbackYtd.changePercent >= 0 ? "+" : ""}
                  {(fallbackYtd.changePercent ?? 0).toFixed(2)}%
                </span>
              </div>
            )}
            <div className="stat-block">
              <span className="stat-block__label">Source</span>
              <span
                className="stat-block__value"
                style={{ fontSize: "0.85rem" }}
              >
                {data?.source || "Estimated"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Chart (full width) */}
      <div className="card">
        <div
          style={{
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            letterSpacing: "1px",
            marginBottom: "8px",
            textTransform: "uppercase",
          }}
        >
          {history.length > 1 ? "Price History" : "30-Day Trend"}
        </div>
        <LineChart
          series={chartSeries}
          height={280}
          ranges={history.length > 1 ? RANGES : undefined}
          selectedRange={range}
          onRangeChange={setRange}
          accentColor="#e8873a"
          showLegend={false}
          valuePrefix="$"
        />
      </div>

      {/* Row 3: Economic Components + News */}
      <div className="grid-2">
        {/* Economic Components */}
        {data?.components && data.components.cpiFood > 0 ? (
          <div className="card">
            <div className="section-title" style={{ marginBottom: "12px" }}>
              Economic Components
            </div>
            <div className="grid-2" style={{ gap: "12px" }}>
              <div className="stat-block">
                <span className="stat-block__label">CPI Food</span>
                <span className="stat-block__value" style={{ color: "var(--teal)" }}>
                  {(data.components.cpiFood ?? 0).toFixed(1)}
                </span>
              </div>
              <div className="stat-block">
                <span className="stat-block__label">Chicken</span>
                <span className="stat-block__value" style={{ color: "var(--teal)" }}>
                  {data.components.chickenWholesale}¢/lb
                </span>
              </div>
              <div className="stat-block">
                <span className="stat-block__label">Avg Wage</span>
                <span className="stat-block__value" style={{ color: "var(--teal)" }}>
                  ${(data.components.avgFoodServiceWage ?? 0).toFixed(2)}/hr
                </span>
              </div>
              <div className="stat-block">
                <span className="stat-block__label">Min Wage</span>
                <span className="stat-block__value" style={{ color: "var(--teal)" }}>
                  ${(data.components.federalMinWage ?? 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="section-title" style={{ marginBottom: "12px" }}>
              Economic Components
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              Component data not available for current period.
            </p>
          </div>
        )}

        {/* News */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: "12px" }}>
            Latest News
          </div>
          {news.length > 0 ? (
            <NewsSection items={news} maxItems={3} />
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No recent news available.
            </p>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: "4px",
        }}
      >
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          v{data?.methodologyVersion || "1.0"}
        </span>
        <a
          href="/methodology"
          style={{
            fontSize: "0.8rem",
            color: "var(--accent)",
            fontWeight: 500,
          }}
        >
          Methodology & API →
        </a>
      </div>
    </div>
  );
}
