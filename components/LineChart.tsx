"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";

export interface DataPoint {
  date: string; // YYYY | YYYY-MM | YYYY-MM-DD
  value: number;
}

export interface DataSeries {
  name: string;
  color: string;
  data: DataPoint[];
  style?: "solid" | "dashed";
  width?: number;
}

/** Shade the area between two named series (e.g. the margin spread). */
export interface Band {
  from: string;
  to: string;
  color: string;
}

interface LineChartProps {
  series: DataSeries[];
  height?: number;
  ranges?: string[];
  selectedRange?: string;
  onRangeChange?: (range: string) => void;
  yLabel?: string;
  band?: Band;
  /** Date (ms domain) from which data is live/observed vs. historical. */
  observedFrom?: string;
}

const AXIS = "rgba(230,232,240,0.30)";
const GRID = "rgba(230,232,240,0.10)";
const LABEL = "#aab2c5";
const TIP_BG = "rgba(10,12,20,0.97)";
const TIP_BORDER = "rgba(230,232,240,0.22)";

function msOf(date: string): number {
  const t = new Date(date.length === 4 ? `${date}-01-01` : date).getTime();
  return isFinite(t) ? t : 0;
}

function fmtDate(ms: number, spanDays: number): string {
  const d = new Date(ms);
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (spanDays > 900) return String(d.getUTCFullYear());
  if (spanDays > 75) return `${mo[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`;
  return `${mo[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export default function LineChart({
  series,
  height = 260,
  ranges,
  selectedRange,
  onRangeChange,
  yLabel,
  band,
  observedFrom,
}: LineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hoverMs, setHoverMs] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(e.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const width = containerWidth || 600;
  const pad = { top: 16, right: 18, bottom: 30, left: 50 };
  const chartW = Math.max(width - pad.left - pad.right, 10);
  const chartH = Math.max(height - pad.top - pad.bottom, 10);

  const model = useMemo(() => {
    const withData = series.filter((s) => s.data.length > 0);
    let tMin = Infinity,
      tMax = -Infinity,
      vMin = Infinity,
      vMax = -Infinity;
    const allDates = new Set<number>();
    for (const s of withData) {
      for (const d of s.data) {
        const t = msOf(d.date);
        allDates.add(t);
        if (t < tMin) tMin = t;
        if (t > tMax) tMax = t;
        if (d.value < vMin) vMin = d.value;
        if (d.value > vMax) vMax = d.value;
      }
    }
    if (!isFinite(tMin)) return null;
    const vPad = (vMax - vMin || 1) * 0.08;
    vMin -= vPad;
    vMax += vPad;
    const tSpan = tMax - tMin || 1;
    const spanDays = tSpan / 86400000;
    return {
      tMin,
      tMax,
      tSpan,
      vMin,
      vMax,
      spanDays,
      dates: Array.from(allDates).sort((a, b) => a - b),
    };
  }, [series]);

  const xOf = useCallback(
    (t: number) => (model ? pad.left + ((t - model.tMin) / model.tSpan) * chartW : pad.left),
    [model, chartW, pad.left]
  );
  const yOf = useCallback(
    (v: number) =>
      model ? pad.top + chartH - ((v - model.vMin) / (model.vMax - model.vMin)) * chartH : pad.top,
    [model, chartH, pad.top]
  );

  const yTicks = useMemo(() => {
    if (!model) return [];
    const n = 5;
    const raw = (model.vMax - model.vMin) / n;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = raw / mag >= 5 ? 5 * mag : raw / mag >= 2 ? 2 * mag : mag;
    const start = Math.ceil(model.vMin / step) * step;
    const ticks: number[] = [];
    for (let v = start; v <= model.vMax; v += step) ticks.push(v);
    return ticks;
  }, [model]);

  const xTicks = useMemo(() => {
    if (!model) return [];
    const n = Math.min(6, Math.max(3, Math.floor(chartW / 90)));
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(model.tMin + (model.tSpan * i) / (n - 1));
    return out;
  }, [model, chartW]);

  const handleMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!model) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      if (mx < pad.left || mx > pad.left + chartW) {
        setHoverMs(null);
        setHoverX(null);
        return;
      }
      const t = model.tMin + ((mx - pad.left) / chartW) * model.tSpan;
      // snap to nearest known date
      let nearest = model.dates[0];
      let best = Infinity;
      for (const d of model.dates) {
        const dist = Math.abs(d - t);
        if (dist < best) {
          best = dist;
          nearest = d;
        }
      }
      setHoverMs(nearest);
      setHoverX(xOf(nearest));
    },
    [model, chartW, pad.left, xOf]
  );

  const pointsFor = (s: DataSeries) =>
    s.data
      .slice()
      .sort((a, b) => msOf(a.date) - msOf(b.date))
      .map((d) => `${xOf(msOf(d.date))},${yOf(d.value)}`)
      .join(" ");

  const bandPolygon = useMemo(() => {
    if (!band || !model) return null;
    const from = series.find((s) => s.name === band.from);
    const to = series.find((s) => s.name === band.to);
    if (!from || !to) return null;
    const fmap = new Map(from.data.map((d) => [msOf(d.date), d.value]));
    const common = to.data
      .map((d) => ({ t: msOf(d.date), top: d.value, bot: fmap.get(msOf(d.date)) }))
      .filter((d) => d.bot !== undefined)
      .sort((a, b) => a.t - b.t);
    if (common.length < 2) return null;
    const top = common.map((d) => `${xOf(d.t)},${yOf(d.top)}`);
    const bot = common
      .slice()
      .reverse()
      .map((d) => `${xOf(d.t)},${yOf(d.bot as number)}`);
    return [...top, ...bot].join(" ");
  }, [band, series, model, xOf, yOf]);

  const ariaSummary = series
    .filter((s) => s.data.length)
    .map((s) => `${s.name} ${s.data[s.data.length - 1].value}`)
    .join(", ");

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      {ranges && ranges.length > 0 && (
        <div style={{ display: "flex", gap: "4px", marginBottom: "10px" }}>
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange?.(r)}
              aria-pressed={selectedRange === r}
              style={{
                fontSize: "0.72rem",
                fontFamily: "var(--font-mono)",
                fontWeight: selectedRange === r ? 700 : 500,
                padding: "4px 12px",
                border: `1px solid ${selectedRange === r ? "var(--accent)" : "rgba(230,232,240,0.18)"}`,
                borderRadius: "4px",
                background: selectedRange === r ? "rgba(255,138,61,0.14)" : "transparent",
                color: selectedRange === r ? "var(--text-primary)" : "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {containerWidth > 0 && model && (
        <div style={{ position: "relative" }}>
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`Line chart. Latest: ${ariaSummary}.`}
            style={{ display: "block", overflow: "visible" }}
            onMouseMove={handleMove}
            onMouseLeave={() => {
              setHoverMs(null);
              setHoverX(null);
            }}
          >
            {yTicks.map((v, i) => (
              <g key={i}>
                <line x1={pad.left} y1={yOf(v)} x2={pad.left + chartW} y2={yOf(v)} stroke={GRID} />
                <text x={pad.left - 8} y={yOf(v) + 4} textAnchor="end" fontSize="11" fill={LABEL} fontFamily="var(--font-mono)">
                  {Math.round(v)}
                </text>
              </g>
            ))}

            {xTicks.map((t, i) => (
              <text key={i} x={xOf(t)} y={height - 8} textAnchor="middle" fontSize="11" fill={LABEL} fontFamily="var(--font-mono)">
                {fmtDate(t, model.spanDays)}
              </text>
            ))}

            {/* axes */}
            <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + chartH} stroke={AXIS} />
            <line x1={pad.left} y1={pad.top + chartH} x2={pad.left + chartW} y2={pad.top + chartH} stroke={AXIS} />

            {/* live-tracking divider */}
            {observedFrom &&
              (() => {
                const t = msOf(observedFrom);
                if (t <= model.tMin || t >= model.tMax) return null;
                return (
                  <g>
                    <line x1={xOf(t)} y1={pad.top} x2={xOf(t)} y2={pad.top + chartH} stroke="rgba(230,232,240,0.18)" strokeDasharray="2,3" />
                    <text x={xOf(t) + 4} y={pad.top + 10} fontSize="9.5" fill={LABEL} fontFamily="var(--font-mono)">
                      live tracking →
                    </text>
                  </g>
                );
              })()}

            {/* margin-spread band */}
            {bandPolygon && <polygon points={bandPolygon} fill={band!.color} />}

            {/* series lines */}
            {series.map((s) =>
              s.data.length < 2 ? null : (
                <polyline
                  key={s.name}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.width ?? 2}
                  strokeLinejoin="round"
                  strokeDasharray={s.style === "dashed" ? "6,4" : undefined}
                  points={pointsFor(s)}
                />
              )
            )}

            {/* hover crosshair + dots */}
            {hoverMs !== null && hoverX !== null && (
              <line x1={hoverX} y1={pad.top} x2={hoverX} y2={pad.top + chartH} stroke="rgba(230,232,240,0.4)" strokeDasharray="4,3" />
            )}
            {hoverMs !== null &&
              series.map((s) => {
                const pt = s.data.find((d) => msOf(d.date) === hoverMs);
                if (!pt) return null;
                return <circle key={s.name} cx={xOf(hoverMs)} cy={yOf(pt.value)} r="4" fill="#0a0c14" stroke={s.color} strokeWidth="2" />;
              })}
          </svg>

          {hoverMs !== null && hoverX !== null && (
            <div
              style={{
                position: "absolute",
                left: Math.min(hoverX + 12, width - 170),
                top: 6,
                background: TIP_BG,
                border: `1px solid ${TIP_BORDER}`,
                borderRadius: "5px",
                padding: "8px 11px",
                fontSize: "0.72rem",
                fontFamily: "var(--font-mono)",
                pointerEvents: "none",
                zIndex: 10,
                minWidth: "140px",
              }}
            >
              <div style={{ color: "#cfd5e3", marginBottom: "5px", fontWeight: 600 }}>
                {new Date(hoverMs).toISOString().split("T")[0]}
              </div>
              {series.map((s) => {
                const pt = s.data.find((d) => msOf(d.date) === hoverMs);
                if (!pt) return null;
                return (
                  <div key={s.name} style={{ display: "flex", justifyContent: "space-between", gap: "14px", color: s.color }}>
                    <span style={{ opacity: 0.85 }}>{s.name}</span>
                    <span style={{ fontWeight: 700 }}>{pt.value.toFixed(pt.value < 10 ? 2 : 0)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* legend with style-aware swatches (not color-only) */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "10px", alignItems: "center" }}>
        {yLabel && <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{yLabel}</span>}
        {series.filter((s) => s.data.length).map((s) => (
          <div key={s.name} style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.7rem", color: "var(--text-secondary)" }}>
            <svg width="22" height="8" aria-hidden>
              <line x1="0" y1="4" x2="22" y2="4" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.style === "dashed" ? "5,3" : undefined} />
            </svg>
            {s.name}
          </div>
        ))}
      </div>
    </div>
  );
}
