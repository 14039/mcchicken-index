"use client";

/**
 * StepChart — honest survey-series chart. Renders step lines (no smoothing or
 * interpolation: national prices move in discrete steps and the chart should
 * look like it), calendar-aligned ticks, dated event annotations, and a
 * crosshair tooltip. Pure SVG, no dependencies.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ChartPoint {
  date: string; // YYYY-MM-DD or YYYY-MM
  value: number;
  /** Extra tooltip lines, e.g. { "Panel price": "$2.74" }. */
  meta?: Record<string, string>;
}

export interface ChartSeries {
  name: string;
  color: string;
  mode: "step" | "line";
  points: ChartPoint[];
}

export interface ChartEvent {
  date: string;
  label: string;
}

interface Props {
  series: ChartSeries[];
  events?: ChartEvent[];
  height?: number;
  yLabel: string;
  xLabel: string;
  valueFormat?: (v: number) => string;
  /** Extend the last step to "now" (true for live survey series). */
  extendToNow?: boolean;
}

const AXIS = "rgba(230,232,240,0.35)";
const GRID = "rgba(230,232,240,0.08)";
const LABEL = "#a7b0c0";

const ms = (d: string) => new Date(d.length === 7 ? `${d}-15` : d).getTime();

function niceTicks(min: number, max: number, target = 5): number[] {
  if (min === max) {
    min -= 0.5;
    max += 0.5;
  }
  const span = max - min;
  const step0 = Math.pow(10, Math.floor(Math.log10(span / target)));
  const candidates = [step0, step0 * 2, step0 * 5, step0 * 10];
  const step = candidates.find((s) => span / s <= target) ?? step0 * 10;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

/** Calendar-aligned x ticks: month starts or year starts depending on span. */
function timeTicks(t0: number, t1: number): { t: number; label: string }[] {
  const spanDays = (t1 - t0) / 86_400_000;
  const out: { t: number; label: string }[] = [];
  const d0 = new Date(t0);
  if (spanDays > 900) {
    for (let y = d0.getUTCFullYear() + 1; ; y++) {
      const t = Date.UTC(y, 0, 1);
      if (t > t1) break;
      out.push({ t, label: String(y) });
    }
  } else if (spanDays > 100) {
    const stepMonths = spanDays > 400 ? 3 : 1;
    const start = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1));
    for (let m = 0; ; m += stepMonths) {
      const t = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m, 1);
      if (t > t1) break;
      const dt = new Date(t);
      out.push({
        t,
        label: `${dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} '${String(dt.getUTCFullYear()).slice(2)}`,
      });
    }
  } else {
    const stepDays = spanDays > 45 ? 14 : spanDays > 18 ? 7 : 3;
    for (let t = t0 + stepDays * 86_400_000; t < t1; t += stepDays * 86_400_000) {
      const dt = new Date(t);
      out.push({
        t,
        label: `${dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${dt.getUTCDate()}`,
      });
    }
  }
  return out.slice(0, 8);
}

export default function StepChart({
  series,
  events = [],
  height = 300,
  yLabel,
  xLabel,
  valueFormat = (v) => v.toFixed(1),
  extendToNow = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(Math.max(280, entries[0].contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { top: 14, right: 14, bottom: 42, left: 52 };
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;

  const model = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    if (all.length === 0) return null;
    const times = all.map((p) => ms(p.date));
    let t0 = Math.min(...times);
    let t1 = Math.max(...times);
    if (extendToNow) t1 = Math.max(t1, Date.now());
    if (t1 - t0 < 86_400_000 * 5) {
      t0 -= 86_400_000 * 3;
      t1 += 86_400_000 * 3;
    }
    const values = all.map((p) => p.value);
    let vMin = Math.min(...values);
    let vMax = Math.max(...values);
    const vPad = Math.max((vMax - vMin) * 0.18, Math.abs(vMax) * 0.04, 0.15);
    vMin -= vPad;
    vMax += vPad;
    const x = (t: number) => pad.left + ((t - t0) / (t1 - t0)) * iw;
    const y = (v: number) => pad.top + (1 - (v - vMin) / (vMax - vMin)) * ih;
    return { t0, t1, vMin, vMax, x, y };
  }, [series, extendToNow, iw, ih, pad.left, pad.top]);

  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!model) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - rect.left;
      if (px < pad.left || px > width - pad.right) {
        setHover(null);
        return;
      }
      const t = model.t0 + ((px - pad.left) / iw) * (model.t1 - model.t0);
      setHover({ x: px, t });
    },
    [model, iw, pad.left, pad.right, width]
  );

  if (!model) {
    return (
      <div ref={wrapRef} className="chart-empty">
        No published survey data yet — the instrument runs Mon &amp; Thu 08:00 UTC.
      </div>
    );
  }

  const { x, y, t0, t1, vMin, vMax } = model;
  const yTicks = niceTicks(vMin, vMax);
  const xTicks = timeTicks(t0, t1);

  // Nearest point per series for the tooltip.
  const hoverInfo =
    hover &&
    series
      .map((s) => {
        if (s.points.length === 0) return null;
        let best = s.points[0];
        let bestD = Infinity;
        for (const p of s.points) {
          // For steps, the value at time t is the last point at/before t.
          const pt = ms(p.date);
          const d = s.mode === "step" ? (pt <= hover.t ? hover.t - pt : Infinity) : Math.abs(pt - hover.t);
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
        return isFinite(bestD) ? { series: s, point: best } : null;
      })
      .filter(Boolean) as Array<{ series: ChartSeries; point: ChartPoint }> | null;

  const pathFor = (s: ChartSeries): string => {
    const pts = [...s.points].sort((a, b) => ms(a.date) - ms(b.date));
    if (pts.length === 0) return "";
    let d = `M ${x(ms(pts[0].date))} ${y(pts[0].value)}`;
    for (let i = 1; i < pts.length; i++) {
      const px = x(ms(pts[i].date));
      const py = y(pts[i].value);
      if (s.mode === "step") {
        d += ` H ${px} V ${py}`;
      } else {
        d += ` L ${px} ${py}`;
      }
    }
    if (s.mode === "step" && extendToNow) {
      d += ` H ${x(t1)}`;
    }
    return d;
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <svg
        width={width}
        height={height}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`${yLabel} chart`}
        style={{ display: "block" }}
      >
        {/* gridlines + y ticks */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke={GRID} />
            <text x={pad.left - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill={LABEL}>
              {valueFormat(v)}
            </text>
          </g>
        ))}
        {/* x ticks */}
        {xTicks.map((tk) => (
          <g key={tk.t}>
            <line x1={x(tk.t)} x2={x(tk.t)} y1={height - pad.bottom} y2={height - pad.bottom + 4} stroke={AXIS} />
            <text x={x(tk.t)} y={height - pad.bottom + 16} textAnchor="middle" fontSize={11} fill={LABEL}>
              {tk.label}
            </text>
          </g>
        ))}
        {/* axes */}
        <line x1={pad.left} x2={pad.left} y1={pad.top} y2={height - pad.bottom} stroke={AXIS} />
        <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke={AXIS} />
        {/* axis labels */}
        <text
          transform={`translate(12 ${pad.top + ih / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={11}
          fill={LABEL}
          letterSpacing={0.5}
        >
          {yLabel}
        </text>
        <text x={pad.left + iw / 2} y={height - 6} textAnchor="middle" fontSize={11} fill={LABEL} letterSpacing={0.5}>
          {xLabel}
        </text>
        {/* event annotations */}
        {events
          .filter((e) => {
            const t = ms(e.date);
            return t >= t0 && t <= t1;
          })
          .map((e) => (
            <g key={`${e.date}-${e.label}`}>
              <line
                x1={x(ms(e.date))}
                x2={x(ms(e.date))}
                y1={pad.top}
                y2={height - pad.bottom}
                stroke="rgba(255,180,84,0.5)"
                strokeDasharray="3 4"
              />
              <circle cx={x(ms(e.date))} cy={pad.top + 4} r={3.5} fill="#ffb454">
                <title>{`${e.date}: ${e.label}`}</title>
              </circle>
            </g>
          ))}
        {/* series */}
        {series.map((s) => (
          <g key={s.name}>
            <path d={pathFor(s)} fill="none" stroke={s.color} strokeWidth={2} />
            {s.points.map((p) => (
              <circle key={p.date} cx={x(ms(p.date))} cy={y(p.value)} r={2.6} fill={s.color} />
            ))}
          </g>
        ))}
        {/* crosshair */}
        {hover && (
          <line x1={hover.x} x2={hover.x} y1={pad.top} y2={height - pad.bottom} stroke="rgba(230,232,240,0.25)" />
        )}
      </svg>
      {/* tooltip */}
      {hover && hoverInfo && hoverInfo.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: Math.min(hover.x + 12, width - 190),
            top: 10,
            background: "rgba(10,12,20,0.97)",
            border: "1px solid rgba(230,232,240,0.22)",
            borderRadius: 6,
            padding: "8px 10px",
            pointerEvents: "none",
            fontSize: "0.7rem",
            lineHeight: 1.55,
            minWidth: 130,
            zIndex: 5,
          }}
        >
          {hoverInfo.map(({ series: s, point }) => (
            <div key={s.name}>
              <div style={{ color: s.color, fontWeight: 600 }}>
                {s.name}: {valueFormat(point.value)}
              </div>
              <div style={{ color: "#a7b0c0" }}>{point.date}</div>
              {point.meta &&
                Object.entries(point.meta).map(([k, v]) => (
                  <div key={k} style={{ color: "#a7b0c0" }}>
                    {k}: {v}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
      {/* legend for multi-series */}
      {series.length > 1 && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: "6px 4px 0", fontSize: "0.68rem" }}>
          {series.map((s) => (
            <span key={s.name} style={{ color: s.color }}>
              ── {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
