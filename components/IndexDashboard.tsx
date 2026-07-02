"use client";

/**
 * Dashboard client: fetches the public API once (range=ALL), then renders the
 * headline, decomposition, main chart (client-side range filtering), stat
 * chips, and the latest-run line. Everything shown is a published value or an
 * honest empty state — nothing is simulated.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import StepChart, { type ChartEvent, type ChartSeries } from "./StepChart";
import CompanionChart, { type CpiPoint } from "./CompanionChart";

interface Decomposition {
  dLnMciPct: number;
  dLnPricePct: number;
  dLnPortionPct: number;
  dLnWagePct: number;
  vsDate: string;
}

interface PublishedPoint {
  surveyDate: string;
  mciMinutes: number;
  panelPriceUsd: number;
  portionGrams: number;
  portionFactor: number;
  wageUsdPerHour: number;
  wageMonth: string;
  quorum: { verified: number; carried: number; of: number };
  decomposition: Decomposition | null;
}

interface ApiResponse {
  index: PublishedPoint | null;
  lastRun: { surveyDate: string; status: string; reason: string | null } | null;
  heldPending: { surveyDate: string; reason: string } | null;
  spec: {
    grams: number;
    verifiedAt: string;
    pendingReview: boolean;
    events: Array<{ date: string; fromGrams: number; toGrams: number; attribution: string }>;
  } | null;
  history?: PublishedPoint[];
  context?: { cpiLimitedService: CpiPoint[] };
  regimeEvents?: Array<{ date: string; event: string; source_url: string }>;
}

const RANGES = ["1M", "3M", "1Y", "ALL"] as const;
type Range = (typeof RANGES)[number];
const RANGE_DAYS: Record<Range, number | null> = { "1M": 31, "3M": 92, "1Y": 366, ALL: null };

function nextSurveyLabel(): string {
  // Surveys run Mon (1) & Thu (4) 08:00 UTC.
  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i, 8, 0, 0));
    if ((d.getUTCDay() === 1 || d.getUTCDay() === 4) && d.getTime() > now.getTime()) {
      return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
    }
  }
  return "Mon / Thu";
}

function fmtPct(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function Chip({ label, value, sub }: { label: string; value: ReactNode; sub: ReactNode }) {
  return (
    <div className="cell">
      <div className="label">{label}</div>
      <div className="value" style={{ fontSize: "1.15rem" }}>{value}</div>
      <div className="delta muted">{sub}</div>
    </div>
  );
}

export default function IndexDashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState(false);
  const [range, setRange] = useState<Range>("3M");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mcchicken?range=ALL")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: ApiResponse) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const history = useMemo(() => data?.history ?? [], [data]);

  const filtered = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (!days) return history;
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    return history.filter((p) => p.surveyDate >= cutoff);
  }, [history, range]);

  const mainSeries: ChartSeries[] = useMemo(
    () => [
      {
        name: "MCI",
        color: "#ff8a3d",
        mode: "step",
        points: filtered.map((p) => ({
          date: p.surveyDate,
          value: p.mciMinutes,
          meta: {
            "Panel price": `$${p.panelPriceUsd.toFixed(2)}`,
            Portion: `${p.portionGrams} g`,
            Wage: `$${p.wageUsdPerHour.toFixed(2)}/hr (${p.wageMonth})`,
            Quorum: `${p.quorum.verified}+${p.quorum.carried} of ${p.quorum.of}`,
          },
        })),
      },
    ],
    [filtered]
  );

  const chartEvents: ChartEvent[] = useMemo(() => {
    const spec = (data?.spec?.events ?? []).map((e) => ({
      date: e.date,
      label: `Portion spec ${e.fromGrams}g → ${e.toGrams}g (${e.attribution})`,
    }));
    const regime = (data?.regimeEvents ?? []).map((e) => ({ date: e.date, label: e.event }));
    return [...spec, ...regime];
  }, [data]);

  const latest = data?.index ?? null;
  const d = latest?.decomposition ?? null;

  return (
    <>
      {/* ── Headline ── */}
      <section className="hero">
        <div className="mci">{latest ? latest.mciMinutes.toFixed(1) : "—"}</div>
        <div className="mci-unit">minutes of work per standard McChicken</div>
        <h1>
          The number of minutes an average American worker must work to earn one
          standard McChicken.
        </h1>
        {d && (
          <div className="decomp">
            <span>vs. {d.vsDate}:</span>
            <span className={d.dLnMciPct > 0 ? "neg" : d.dLnMciPct < 0 ? "pos" : ""}>
              MCI {fmtPct(d.dLnMciPct)}
            </span>
            <span>price {fmtPct(d.dLnPricePct)}</span>
            <span>portion {fmtPct(d.dLnPortionPct)}</span>
            <span>wage {fmtPct(d.dLnWagePct)}</span>
          </div>
        )}
        {error && (
          <div className="decomp" style={{ borderColor: "var(--neg)" }}>
            Live data unavailable — try again shortly.
          </div>
        )}
      </section>

      {/* ── Mission ── */}
      <section className="soul">
        The McChicken Index is a novel economic indicator designed to capture
        real-price changes in American fast food. The index is an analytical
        signal for investors and economic researchers that reflects the pricing
        pressures on food spend put on every day Americans. The McChicken Index
        elaborates on the Economist&apos;s Big Mac Index by designing a methodology
        that incorporates LLM-driven real-time research into the index itself,
        providing a highly accurate and flexible indicator.
      </section>

      {/* ── Main chart ── */}
      <section className="chart-panel">
        <div className="chart-head">
          <div>
            <div className="chart-title">Minutes of Work to buy a standard McChicken</div>
            <div className="chart-subtitle">
              Median McChicken Price (12 US metro areas) / average hourly earnings
              * portion-normalized
            </div>
          </div>
          <div className="range-buttons">
            {RANGES.map((r) => (
              <button key={r} className={r === range ? "active" : ""} onClick={() => setRange(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <StepChart
          series={mainSeries}
          events={chartEvents}
          yLabel="Minutes of Work"
          xLabel="Date"
          valueFormat={(v) => v.toFixed(1)}
          extendToNow
          height={320}
        />
      </section>

      {/* ── Stat chips ── */}
      <section className="statbar">
        <Chip
          label="Panel price"
          value={latest ? `$${latest.panelPriceUsd.toFixed(2)}` : "—"}
          sub={
            latest
              ? `median · ${latest.quorum.verified}+${latest.quorum.carried} of ${latest.quorum.of} verified`
              : "awaiting first survey"
          }
        />
        <Chip
          label="Portion spec"
          value={data?.spec ? `${data.spec.grams} g` : latest ? `${latest.portionGrams} g` : "—"}
          sub={
            data?.spec?.pendingReview
              ? "change pending review"
              : data?.spec
                ? `verified ${data.spec.verifiedAt.slice(0, 10)}`
                : "official McDonald's data"
          }
        />
        <Chip
          label="Wage (AHETPI)"
          value={latest ? `$${latest.wageUsdPerHour.toFixed(2)}` : "—"}
          sub={latest ? `per hour · ${latest.wageMonth} · BLS via FRED` : "BLS via FRED"}
        />
        <Chip label="Next survey" value={nextSurveyLabel()} sub="Mon & Thu · 08:00 UTC" />
      </section>

      {/* ── Latest run ── */}
      {data?.lastRun && (
        <div className="run-line">
          <span>
            Last survey {data.lastRun.surveyDate} · {data.lastRun.status}
            {data.lastRun.reason ? ` (${data.lastRun.reason})` : ""}
          </span>
          {data.heldPending && <span className="accent">· a newer reading is held for review</span>}
          <a href={`/api/mcchicken/evidence?date=${data.lastRun.surveyDate}`}>evidence →</a>
        </div>
      )}

      {/* ── Companion chart ── */}
      <CompanionChart history={history} cpi={data?.context?.cpiLimitedService ?? []} />
    </>
  );
}
