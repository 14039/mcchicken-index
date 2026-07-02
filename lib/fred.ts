/**
 * FRED client — wage denominator (AHETPI).
 *
 * Primary path: official API with FRED_API_KEY. Fallback: fredgraph.csv,
 * FRED's public keyless CSV export of the same series — identical data,
 * used when the key is absent (local dev) or the API errors. Both paths
 * return real FRED observations; there is no synthetic fallback.
 */

import { FRED_WAGE_SERIES } from "./config";
import type { WageObservation } from "./types";

const API_BASE = "https://api.stlouisfed.org/fred/series/observations";
const GRAPH_BASE = "https://fred.stlouisfed.org/graph/fredgraph.csv";

interface FredApiObservation {
  date: string;
  value: string;
}

async function fetchViaApi(seriesId: string): Promise<{ date: string; value: number } | null> {
  const key = process.env.FRED_API_KEY;
  if (!key) return null;
  const url =
    `${API_BASE}?series_id=${seriesId}&api_key=${key}&file_type=json` +
    `&sort_order=desc&limit=12`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`FRED API ${res.status}`);
  const body = (await res.json()) as { observations?: FredApiObservation[] };
  for (const obs of body.observations ?? []) {
    const v = Number(obs.value);
    if (obs.value !== "." && isFinite(v)) return { date: obs.date, value: v };
  }
  return null;
}

async function fetchViaFredgraph(seriesId: string): Promise<{ date: string; value: number } | null> {
  const res = await fetch(`${GRAPH_BASE}?id=${seriesId}`, {
    signal: AbortSignal.timeout(15000),
    headers: { "User-Agent": "mcchickenindex.org data pipeline" },
  });
  if (!res.ok) throw new Error(`fredgraph ${res.status}`);
  const csv = await res.text();
  const lines = csv.trim().split("\n");
  for (let i = lines.length - 1; i > 0; i--) {
    const [date, raw] = lines[i].split(",");
    const v = Number(raw);
    if (raw !== "." && isFinite(v) && date) return { date: date.trim(), value: v };
  }
  return null;
}

/**
 * Latest AHETPI observation. The month + value get vintage-pinned into every
 * published point; history is never restated when BLS revises.
 */
export async function fetchWage(): Promise<WageObservation> {
  let viaApi: { date: string; value: number } | null = null;
  let apiError: string | null = null;
  try {
    viaApi = await fetchViaApi(FRED_WAGE_SERIES);
  } catch (e) {
    apiError = e instanceof Error ? e.message : String(e);
  }
  if (viaApi) {
    return {
      usdPerHour: viaApi.value,
      month: viaApi.date.slice(0, 7),
      fetchedAt: new Date().toISOString(),
      source: "FRED AHETPI (api)",
    };
  }
  const viaGraph = await fetchViaFredgraph(FRED_WAGE_SERIES);
  if (viaGraph) {
    return {
      usdPerHour: viaGraph.value,
      month: viaGraph.date.slice(0, 7),
      fetchedAt: new Date().toISOString(),
      source: "FRED AHETPI (fredgraph)",
    };
  }
  throw new Error(
    `AHETPI unavailable via API${apiError ? ` (${apiError})` : ""} and fredgraph — cannot compute W`
  );
}
