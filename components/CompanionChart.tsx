"use client";

/**
 * Companion display (subordinate to the headline, never blended into it):
 * the nominal panel price in dollars, and panel-price YoY vs. official
 * fast-food CPI YoY. Panel YoY needs 12 months of survey history, so until
 * July 2027 the YoY view honestly shows CPI alone.
 */

import { useMemo, useState } from "react";
import StepChart, { type ChartSeries } from "./StepChart";

export interface CpiPoint {
  month: string;
  value: number;
  yoyPct: number | null;
}

interface HistoryPoint {
  surveyDate: string;
  panelPriceUsd: number;
}

export default function CompanionChart({
  history,
  cpi,
}: {
  history: HistoryPoint[];
  cpi: CpiPoint[];
}) {
  const [tab, setTab] = useState<"price" | "yoy">("price");

  const priceSeries: ChartSeries[] = useMemo(
    () => [
      {
        name: "Panel price",
        color: "#5bc0ff",
        mode: "step",
        points: history.map((p) => ({ date: p.surveyDate, value: p.panelPriceUsd })),
      },
    ],
    [history]
  );

  const { yoySeries, panelYoYAvailable } = useMemo(() => {
    const cpiPoints = cpi
      .filter((p) => p.yoyPct !== null)
      .slice(-36)
      .map((p) => ({ date: p.month, value: p.yoyPct as number }));

    // Panel YoY: needs a same-month observation 12 months earlier.
    const byMonth = new Map<string, number>();
    for (const p of history) byMonth.set(p.surveyDate.slice(0, 7), p.panelPriceUsd);
    const panelYoY: Array<{ date: string; value: number }> = [];
    for (const [month, price] of byMonth) {
      const [y, m] = month.split("-");
      const prior = byMonth.get(`${Number(y) - 1}-${m}`);
      if (prior !== undefined) {
        panelYoY.push({ date: month, value: Math.round((price / prior - 1) * 10000) / 100 });
      }
    }
    panelYoY.sort((a, b) => a.date.localeCompare(b.date));

    const series: ChartSeries[] = [
      { name: "CPI limited-service YoY", color: "#9b8cff", mode: "line", points: cpiPoints },
    ];
    if (panelYoY.length > 0) {
      series.push({ name: "Panel price YoY", color: "#5bc0ff", mode: "line", points: panelYoY });
    }
    return { yoySeries: series, panelYoYAvailable: panelYoY.length > 0 };
  }, [cpi, history]);

  return (
    <section className="chart-panel" style={{ borderTopColor: "var(--info)" }}>
      <div className="chart-head">
        <div className="chart-tabs">
          <button className={tab === "price" ? "active" : ""} onClick={() => setTab("price")}>
            PANEL PRICE $
          </button>
          <button className={tab === "yoy" ? "active" : ""} onClick={() => setTab("yoy")}>
            YOY VS OFFICIAL CPI
          </button>
        </div>
      </div>
      {tab === "price" ? (
        <StepChart
          series={priceSeries}
          yLabel="US Dollars"
          xLabel="Date"
          valueFormat={(v) => `$${v.toFixed(2)}`}
          extendToNow
          height={220}
        />
      ) : (
        <>
          <StepChart
            series={yoySeries}
            yLabel="YoY %"
            xLabel="Date"
            valueFormat={(v) => `${v.toFixed(1)}%`}
            height={220}
          />
          {!panelYoYAvailable && (
            <div className="chart-note">
              Panel-price YoY requires 12 months of survey history (first available
              July 2027). Official CPI shown alone until then. CPI series:
              limited service meals and snacks (BLS CUUR0000SEFV02, NSA).
            </div>
          )}
        </>
      )}
    </section>
  );
}
