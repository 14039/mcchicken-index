"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";

export interface DataSeries {
  name: string;
  color: string;
  data: Array<{ date: string; value: number }>;
}

interface LineChartProps {
  series: DataSeries[];
  height?: number;
  ranges?: string[];
  selectedRange?: string;
  onRangeChange?: (range: string) => void;
  accentColor?: string;
  showLegend?: boolean;
  valuePrefix?: string;
  valueSuffix?: string;
}

const CHART_COLORS = {
  grid: "rgba(255,255,255,0.08)",
  gridMajor: "rgba(255,255,255,0.14)",
  axis: "rgba(255,255,255,0.2)",
  label: "#999",
  hoverLine: "rgba(255,255,255,0.35)",
  tooltipBg: "rgba(8,8,16,0.96)",
  tooltipBorder: "rgba(255,255,255,0.18)",
};

export default function LineChart({
  series,
  height = 220,
  ranges,
  selectedRange,
  onRangeChange,
  accentColor = "#6699ff",
  showLegend = true,
  valuePrefix = "",
  valueSuffix = "",
}: LineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(
    null
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const width = containerWidth || 400;
  const padding = { top: 12, right: 16, bottom: 28, left: 52 };
  const chartW = Math.max(width - padding.left - padding.right, 10);
  const chartH = Math.max(height - padding.top - padding.bottom, 10);

  const { globalMin, globalMax, maxLen, dateLabels } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    let ml = 0;
    for (const s of series) {
      for (const d of s.data) {
        if (d.value < min) min = d.value;
        if (d.value > max) max = d.value;
      }
      if (s.data.length > ml) ml = s.data.length;
    }
    const range = max - min || 1;
    min -= range * 0.06;
    max += range * 0.06;
    const longest = series.reduce(
      (a, b) => (a.data.length >= b.data.length ? a : b),
      series[0]
    );
    return {
      globalMin: min,
      globalMax: max,
      maxLen: ml,
      dateLabels: longest?.data.map((d) => d.date) || [],
    };
  }, [series]);

  const seriesPaths = useMemo(() => {
    return series.map((s) => {
      if (s.data.length < 2) return "";
      return s.data
        .map((d, i) => {
          const x = padding.left + (i / (s.data.length - 1)) * chartW;
          const y =
            padding.top +
            chartH -
            ((d.value - globalMin) / (globalMax - globalMin)) * chartH;
          return `${x},${y}`;
        })
        .join(" ");
    });
  }, [series, chartW, chartH, globalMin, globalMax, padding]);

  const yTicks = useMemo(() => {
    const tickCount = 5;
    const rawStep = (globalMax - globalMin) / tickCount;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const niceStep =
      rawStep / mag >= 5 ? 5 * mag : rawStep / mag >= 2 ? 2 * mag : mag;
    const start = Math.ceil(globalMin / niceStep) * niceStep;
    const ticks: { value: number; y: number }[] = [];
    for (let v = start; v <= globalMax; v += niceStep) {
      const y =
        padding.top +
        chartH -
        ((v - globalMin) / (globalMax - globalMin)) * chartH;
      ticks.push({ value: v, y });
    }
    return ticks;
  }, [globalMin, globalMax, chartH, padding]);

  const xLabels = useMemo(() => {
    if (dateLabels.length === 0) return [];

    const spanDays = dateLabels.length;

    const formatDate = (raw: string): string => {
      if (raw.length === 10) {
        const [y, m, d] = raw.split("-").map(Number);
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        if (spanDays < 60) {
          return `${months[m - 1]} ${d}`;
        } else if (spanDays < 730) {
          return `${months[m - 1]} '${String(y).slice(2)}`;
        } else {
          return String(y);
        }
      } else if (raw.length === 7) {
        const [y, m] = raw.split("-").map(Number);
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        return `${months[m - 1]} '${String(y).slice(2)}`;
      } else if (raw.length === 4) {
        return raw;
      }
      return raw;
    };

    const targetCount = Math.min(7, Math.max(3, Math.floor(chartW / 80)));
    const step = Math.max(1, Math.floor((dateLabels.length - 1) / (targetCount - 1)));
    const candidateIndices: number[] = [];
    for (let i = 0; i < targetCount; i++) {
      candidateIndices.push(Math.min(i * step, dateLabels.length - 1));
    }
    if (candidateIndices[candidateIndices.length - 1] !== dateLabels.length - 1) {
      candidateIndices[candidateIndices.length - 1] = dateLabels.length - 1;
    }

    const labels: { x: number; label: string }[] = [];
    let prevLabel = "";
    for (const idx of candidateIndices) {
      const x = padding.left + (idx / Math.max(dateLabels.length - 1, 1)) * chartW;
      const label = formatDate(dateLabels[idx]);
      if (label !== prevLabel) {
        labels.push({ x, label });
        prevLabel = label;
      }
    }
    return labels;
  }, [dateLabels, chartW, padding]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const chartX = mouseX - padding.left;
      if (chartX < 0 || chartX > chartW || maxLen < 2) {
        setHoverIndex(null);
        setHoverPos(null);
        return;
      }
      const idx = Math.round((chartX / chartW) * (maxLen - 1));
      setHoverIndex(Math.max(0, Math.min(idx, maxLen - 1)));
      setHoverPos({ x: mouseX, y: e.clientY - rect.top });
    },
    [chartW, maxLen, padding]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
    setHoverPos(null);
  }, []);

  const formatValue = (v: number) => {
    if (v >= 1000) return `${valuePrefix}${Math.round(v).toLocaleString()}${valueSuffix}`;
    if (v >= 100) return `${valuePrefix}${Math.round(v)}${valueSuffix}`;
    return `${valuePrefix}${v.toFixed(2)}${valueSuffix}`;
  };

  const formatYLabel = (v: number) => {
    if (v >= 1000) return `${valuePrefix}${(v / 1).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (v >= 100) return `${valuePrefix}${Math.round(v)}`;
    if (v >= 10) return `${valuePrefix}${v.toFixed(1)}`;
    return `${valuePrefix}${v.toFixed(2)}`;
  };

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      {ranges && ranges.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "2px",
            marginBottom: "10px",
          }}
        >
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange?.(r)}
              style={{
                fontSize: "0.6rem",
                fontFamily: "var(--font-display)",
                fontWeight: selectedRange === r ? 700 : 400,
                padding: "3px 10px",
                border: "none",
                borderBottom:
                  selectedRange === r
                    ? `2px solid ${accentColor}`
                    : "2px solid transparent",
                background: "transparent",
                color:
                  selectedRange === r ? "#fff" : "rgba(255,255,255,0.4)",
                cursor: "pointer",
                letterSpacing: "1px",
                transition: "all 0.15s",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {containerWidth > 0 && (
        <div style={{ position: "relative" }}>
          <svg
            width={width}
            height={height}
            style={{ display: "block", overflow: "visible" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <rect
              x={padding.left}
              y={padding.top}
              width={chartW}
              height={chartH}
              fill="rgba(0,0,0,0.15)"
              rx="2"
            />

            {yTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={tick.y}
                  x2={padding.left + chartW}
                  y2={tick.y}
                  stroke={CHART_COLORS.grid}
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill={CHART_COLORS.label}
                  fontFamily="var(--font-mono)"
                >
                  {formatYLabel(tick.value ?? 0)}
                </text>
              </g>
            ))}

            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={padding.top + chartH}
              stroke={CHART_COLORS.axis}
              strokeWidth="1"
            />
            <line
              x1={padding.left}
              y1={padding.top + chartH}
              x2={padding.left + chartW}
              y2={padding.top + chartH}
              stroke={CHART_COLORS.axis}
              strokeWidth="1"
            />

            {xLabels.map((l, i) => (
              <text
                key={i}
                x={l.x}
                y={height - 4}
                textAnchor="middle"
                fontSize="10"
                fill={CHART_COLORS.label}
                fontFamily="var(--font-mono)"
              >
                {l.label}
              </text>
            ))}

            {series.map((s, idx) => {
              if (s.data.length < 2) return null;
              const lastX =
                padding.left +
                ((s.data.length - 1) / (s.data.length - 1)) * chartW;
              const firstX = padding.left;
              const baseline = padding.top + chartH;
              return (
                <polygon
                  key={`fill-${s.name}`}
                  points={`${firstX},${baseline} ${seriesPaths[idx]} ${lastX},${baseline}`}
                  fill={`${s.color}10`}
                />
              );
            })}

            {series.map((s, i) => (
              <polyline
                key={s.name}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
                points={seriesPaths[i]}
              />
            ))}

            {hoverIndex !== null && maxLen > 1 && (
              <line
                x1={padding.left + (hoverIndex / (maxLen - 1)) * chartW}
                y1={padding.top}
                x2={padding.left + (hoverIndex / (maxLen - 1)) * chartW}
                y2={padding.top + chartH}
                stroke={CHART_COLORS.hoverLine}
                strokeWidth="1"
                strokeDasharray="4,3"
              />
            )}

            {hoverIndex !== null &&
              series.map((s) => {
                if (hoverIndex >= s.data.length) return null;
                const d = s.data[hoverIndex];
                const x =
                  padding.left +
                  (hoverIndex / (s.data.length - 1)) * chartW;
                const y =
                  padding.top +
                  chartH -
                  ((d.value - globalMin) / (globalMax - globalMin)) * chartH;
                return (
                  <g key={s.name}>
                    <circle
                      cx={x}
                      cy={y}
                      r="5"
                      fill="rgba(0,0,0,0.6)"
                      stroke={s.color}
                      strokeWidth="2"
                    />
                  </g>
                );
              })}
          </svg>

          {hoverIndex !== null && hoverPos && (
            <div
              style={{
                position: "absolute",
                left: Math.min(
                  hoverPos.x + 14,
                  width - 160
                ),
                top: 8,
                background: CHART_COLORS.tooltipBg,
                border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                borderRadius: "4px",
                padding: "8px 12px",
                fontSize: "0.7rem",
                fontFamily: "var(--font-mono)",
                pointerEvents: "none",
                zIndex: 10,
                minWidth: "120px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}
            >
              {dateLabels[hoverIndex] && (
                <div
                  style={{
                    color: "#bbb",
                    marginBottom: "4px",
                    fontSize: "0.65rem",
                    fontWeight: 600,
                  }}
                >
                  {dateLabels[hoverIndex]}
                </div>
              )}
              {series.map((s) => {
                if (hoverIndex >= s.data.length) return null;
                return (
                  <div
                    key={s.name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      color: s.color,
                      fontSize: "0.7rem",
                    }}
                  >
                    <span style={{ opacity: 0.8 }}>{s.name}</span>
                    <span style={{ fontWeight: 600 }}>
                      {formatValue(s.data[hoverIndex].value ?? 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showLegend && series.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "8px",
            justifyContent: "center",
          }}
        >
          {series.map((s) => (
            <div
              key={s.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.65rem",
                color: "#aaa",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "3px",
                  borderRadius: "2px",
                  background: s.color,
                }}
              />
              {s.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
