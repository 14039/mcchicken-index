/**
 * FRED (Federal Reserve Economic Data) API client
 *
 * Authoritative source for the McChicken Index's economic backbone.
 * We use FRED for the *exact numeric* series that feed the Input-Cost Basis
 * (chicken commodity, food-service labor, general overhead) so those numbers
 * are real and citable rather than AI-estimated.
 *
 * Free API key: https://fredaccount.stlouisfed.org/apikeys
 * Set FRED_API_KEY in the environment. If it is absent or a fetch fails,
 * every helper degrades to `null` — the index then transparently reports
 * "cost basis unavailable" rather than fabricating a value.
 *
 * Docs: https://fred.stlouisfed.org/docs/api/fred/series_observations.html
 */

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

/** Base period for the index: January 2014. */
export const BASE_YEAR = "2014";

export interface FredSeriesSpec {
  id: string;
  label: string;
  unit: string;
  source: string;
  sourceUrl: string;
}

/**
 * Canonical FRED series powering the cost basis + context panel.
 * IDs are verified, long-running public BLS/DOL series. Each is indexed to
 * its own January-2014 value so the basket equals 100 at the base period.
 */
export const FRED_SERIES = {
  chicken: {
    id: "APU0000706111",
    label: "Chicken, whole (per lb)",
    unit: "$/lb",
    source: "BLS via FRED",
    sourceUrl: "https://fred.stlouisfed.org/series/APU0000706111",
  },
  labor: {
    id: "CES7072200003",
    label: "Food-service hourly wage",
    unit: "$/hr",
    source: "BLS via FRED",
    sourceUrl: "https://fred.stlouisfed.org/series/CES7072200003",
  },
  overhead: {
    id: "CPILFESL",
    label: "Core CPI (overhead proxy)",
    unit: "index 1982-84=100",
    source: "BLS via FRED",
    sourceUrl: "https://fred.stlouisfed.org/series/CPILFESL",
  },
  cpiFaFH: {
    id: "CUSR0000SEFV",
    label: "CPI: Food away from home",
    unit: "index 1982-84=100",
    source: "BLS via FRED",
    sourceUrl: "https://fred.stlouisfed.org/series/CUSR0000SEFV",
  },
} as const satisfies Record<string, FredSeriesSpec>;

export type FredSeriesKey = keyof typeof FRED_SERIES;

export interface IndexedSeries {
  key: string;
  id: string;
  label: string;
  unit: string;
  source: string;
  sourceUrl: string;
  baseValue: number;
  baseDate: string;
  latestValue: number;
  latestDate: string;
  /** latestValue / baseValue * 100 (base period = 100). */
  indexed: number;
}

interface FredObservation {
  date: string;
  value: string;
}

function hasKey(): boolean {
  return Boolean(process.env.FRED_API_KEY);
}

/**
 * Fetch raw observations for a series from 2013-12 to today.
 * Returns [] on any failure (no key, network error, bad payload).
 */
async function fetchObservations(seriesId: string): Promise<FredObservation[]> {
  if (!hasKey()) return [];
  const url =
    `${FRED_BASE}?series_id=${encodeURIComponent(seriesId)}` +
    `&api_key=${process.env.FRED_API_KEY}` +
    `&file_type=json&observation_start=2013-12-01`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error(`FRED ${seriesId}: HTTP ${res.status}`);
      return [];
    }
    const json = (await res.json()) as { observations?: FredObservation[] };
    return json.observations ?? [];
  } catch (err) {
    console.error(`FRED ${seriesId}: fetch failed`, err);
    return [];
  }
}

/** First valid observation dated within the base year (2014). */
function pickBase(obs: FredObservation[]): FredObservation | null {
  for (const o of obs) {
    if (o.date.startsWith(BASE_YEAR) && o.value !== "." && o.value !== "") {
      return o;
    }
  }
  return null;
}

/** Most recent valid (non-".") observation. */
function pickLatest(obs: FredObservation[]): FredObservation | null {
  for (let i = obs.length - 1; i >= 0; i--) {
    if (obs[i].value !== "." && obs[i].value !== "") return obs[i];
  }
  return null;
}

/**
 * Fetch a single series and index it to its 2014 base.
 * Returns null when the series cannot be sourced — callers must treat that
 * as "unavailable" and never substitute a guess.
 */
export async function getIndexedSeries(
  key: FredSeriesKey
): Promise<IndexedSeries | null> {
  const spec = FRED_SERIES[key];
  const obs = await fetchObservations(spec.id);
  if (obs.length === 0) return null;

  const base = pickBase(obs);
  const latest = pickLatest(obs);
  if (!base || !latest) return null;

  const baseValue = Number(base.value);
  const latestValue = Number(latest.value);
  if (!isFinite(baseValue) || baseValue <= 0 || !isFinite(latestValue)) {
    return null;
  }

  return {
    key,
    id: spec.id,
    label: spec.label,
    unit: spec.unit,
    source: spec.source,
    sourceUrl: spec.sourceUrl,
    baseValue,
    baseDate: base.date,
    latestValue,
    latestDate: latest.date,
    indexed: (latestValue / baseValue) * 100,
  };
}

/** Fetch all configured series in parallel. Missing ones come back null. */
export async function getAllIndexedSeries(): Promise<
  Record<FredSeriesKey, IndexedSeries | null>
> {
  const keys = Object.keys(FRED_SERIES) as FredSeriesKey[];
  const results = await Promise.all(keys.map((k) => getIndexedSeries(k)));
  return Object.fromEntries(keys.map((k, i) => [k, results[i]])) as Record<
    FredSeriesKey,
    IndexedSeries | null
  >;
}

export { hasKey as fredKeyConfigured };
