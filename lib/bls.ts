/**
 * BLS Public Data API v2 — CPI "Limited service meals and snacks"
 * (CUUR0000SEFV02, NSA). Context layer only: charted YoY against the panel
 * price. Not on FRED; requires a registered BLS key (anonymous quota is
 * exhausted on shared egress IPs).
 */

import { BLS_CPI_SERIES } from "./config";
import type { CpiPoint } from "./types";

const BLS_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";

interface BlsDataItem {
  year: string;
  period: string; // "M01".."M12" (M13 = annual average — skipped)
  value: string;
}

/** Fetch the last `years` of CUUR0000SEFV02 and compute YoY per month. */
export async function fetchCpiLimitedService(years = 4): Promise<CpiPoint[]> {
  const key = process.env.BLS_API_KEY;
  if (!key) throw new Error("BLS_API_KEY not set");
  const endYear = new Date().getUTCFullYear();
  const startYear = endYear - years;
  const res = await fetch(BLS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      seriesid: [BLS_CPI_SERIES],
      startyear: String(startYear),
      endyear: String(endYear),
      registrationkey: key,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`BLS API ${res.status}`);
  const body = (await res.json()) as {
    status: string;
    message?: string[];
    Results?: { series?: Array<{ data?: BlsDataItem[] }> };
  };
  if (body.status !== "REQUEST_SUCCEEDED") {
    throw new Error(`BLS: ${body.status} ${(body.message ?? []).join("; ")}`);
  }
  const raw = body.Results?.series?.[0]?.data ?? [];
  const byMonth = new Map<string, number>();
  for (const item of raw) {
    if (!/^M(0[1-9]|1[0-2])$/.test(item.period)) continue;
    const month = `${item.year}-${item.period.slice(1)}`;
    const v = Number(item.value);
    if (isFinite(v)) byMonth.set(month, v);
  }
  const months = [...byMonth.keys()].sort();
  return months.map((month) => {
    const value = byMonth.get(month)!;
    const [y, m] = month.split("-");
    const prior = byMonth.get(`${Number(y) - 1}-${m}`);
    const yoyPct =
      prior !== undefined ? Math.round(((value / prior - 1) * 100) * 100) / 100 : null;
    return { month, value, yoyPct };
  });
}
