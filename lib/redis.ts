/**
 * McChicken Index — Redis storage (Upstash)
 *
 * Key schema:
 *   dashboard:mcchicken:current   JSON  current index snapshot
 *   dashboard:mcchicken:series    JSON  McChickenHistoryPoint[] (the time series)
 *   dashboard:mcchicken:news      JSON  NewsItem[]
 *   dashboard:mcchicken:journal   JSON  JournalEntry[]  (weekly analyst notes)
 *   dashboard:mcchicken:runs      JSON  RunLogEntry[]   (cron audit log)
 *   dashboard:mcchicken:history   ZSET  legacy time series (read-only; migrated into :series)
 *
 * The time series is a single JSON document rather than a sorted set so that
 * upsert-by-date is deterministic (one point per date, no duplicates) and not
 * subject to client-side JSON (de)serialization surprises.
 */

import { Redis } from "@upstash/redis";
import type { CostComponent, Confidence } from "./index-model";

// ── Types ────────────────────────────────────────────────────────

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  date: string;
  summary?: string;
}

export interface IndexChanges {
  /** Headline week-over-week. null when there is no prior point. */
  headlineWoWPct: number | null;
  headlineWoWPoints: number | null;
  retailWoWPct: number | null;
  /** Margin-spread change in index points week-over-week. */
  spreadWoWPoints: number | null;
  /** Headline change since the 2014 base (= headline − 100). */
  sinceBasePct: number;
  previousDate: string | null;
}

/** Context-only economic series (not in the cost basket) shown for color. */
export interface ContextSeries {
  label: string;
  value: number;
  unit: string;
  asOf: string;
  source: string;
  sourceUrl: string;
}

export interface McChickenCurrentData {
  // Headline
  headlineIndex: number;
  headlineMethod: "blended" | "retail-only";
  retailWeight: number;
  costWeight: number;
  // Layers
  retailIndex: number;
  retailPrice: number;
  costBasisIndex: number | null;
  costCoverage: number;
  costComponents: CostComponent[];
  marginSpreadPoints: number | null;
  marginSpreadPct: number | null;
  // Movement
  changes: IndexChanges;
  // Provenance / quality
  confidence: Confidence;
  priceRange: { min: number; max: number } | null;
  dataDate: string | null;
  retailSources: string[];
  context: ContextSeries[];
  lastUpdated: string;
  methodologyVersion: string;
  notes?: string;
}

export interface McChickenHistoryPoint {
  date: string; // YYYY-MM-DD (live) or YYYY / YYYY-MM (legacy anchors)
  headlineIndex: number;
  retailIndex: number;
  retailPrice: number;
  costBasisIndex: number | null;
  marginSpreadPoints: number | null;
  source: string;
  /** true for live weekly observations; false for historical/seed anchors. */
  observed: boolean;
}

export interface JournalEntry {
  date: string; // YYYY-MM-DD
  title: string;
  body: string;
  headlineIndex: number;
  headlineWoWPct: number | null;
  marginRead: string;
}

export interface RunLogEntry {
  timestamp: string;
  status: "published" | "quarantined" | "error";
  reason?: string;
  retailPrice?: number;
  headlineIndex?: number;
  retailSources?: string[];
  fredCoverage?: number;
  usage?: { inputTokens: number; outputTokens: number };
}

// ── Redis client ─────────────────────────────────────────────────

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

async function getJSON<T>(key: string): Promise<T | null> {
  return (await getRedis().get<T>(key)) ?? null;
}
async function setJSON<T>(key: string, data: T): Promise<void> {
  await getRedis().set(key, JSON.stringify(data));
}

const CURRENT_KEY = "dashboard:mcchicken:current";
const SERIES_KEY = "dashboard:mcchicken:series";
const NEWS_KEY = "dashboard:mcchicken:news";
const JOURNAL_KEY = "dashboard:mcchicken:journal";
const RUNS_KEY = "dashboard:mcchicken:runs";
const LEGACY_HISTORY_KEY = "dashboard:mcchicken:history";

// ── Current snapshot ─────────────────────────────────────────────

export function getMcChickenCurrent(): Promise<McChickenCurrentData | null> {
  return getJSON<McChickenCurrentData>(CURRENT_KEY);
}
export async function setMcChickenCurrent(data: McChickenCurrentData): Promise<void> {
  await setJSON(CURRENT_KEY, data);
}

// ── News ─────────────────────────────────────────────────────────

export async function getMcChickenNews(): Promise<NewsItem[]> {
  return (await getJSON<NewsItem[]>(NEWS_KEY)) ?? [];
}
export async function setMcChickenNews(items: NewsItem[]): Promise<void> {
  await setJSON(NEWS_KEY, items);
}

// ── Time series (JSON document) ──────────────────────────────────

export async function getMcChickenSeries(): Promise<McChickenHistoryPoint[]> {
  return (await getJSON<McChickenHistoryPoint[]>(SERIES_KEY)) ?? [];
}

export async function setMcChickenSeries(
  points: McChickenHistoryPoint[]
): Promise<void> {
  const sorted = [...points].sort(
    (a, b) => msOf(a.date) - msOf(b.date)
  );
  await setJSON(SERIES_KEY, sorted);
}

/** Insert or replace the point for a given date (one point per date). */
export async function upsertMcChickenSeriesPoint(
  point: McChickenHistoryPoint
): Promise<void> {
  const series = await getMcChickenSeries();
  const next = series.filter((p) => p.date !== point.date);
  next.push(point);
  await setMcChickenSeries(next);
}

export async function getMcChickenSeriesRange(
  startDate?: string,
  endDate?: string
): Promise<McChickenHistoryPoint[]> {
  const min = startDate ? msOf(startDate) : -Infinity;
  const max = endDate ? msOf(endDate) : Infinity;
  return (await getMcChickenSeries()).filter((p) => {
    const t = msOf(p.date);
    return t >= min && t <= max;
  });
}

/** Read legacy sorted-set history (for one-time migration only). */
export async function getLegacyHistory(): Promise<
  Array<{ date: string; price: number; indexValue: number; source?: string }>
> {
  try {
    const raw = await getRedis().zrange<unknown[]>(LEGACY_HISTORY_KEY, 0, -1);
    return raw.map((s) =>
      typeof s === "string" ? JSON.parse(s) : (s as Record<string, unknown>)
    ) as Array<{ date: string; price: number; indexValue: number; source?: string }>;
  } catch {
    return [];
  }
}

// ── Journal (weekly analyst notes) ───────────────────────────────

const JOURNAL_CAP = 52;

export async function getMcChickenJournal(): Promise<JournalEntry[]> {
  const entries = (await getJSON<JournalEntry[]>(JOURNAL_KEY)) ?? [];
  return [...entries].sort((a, b) => msOf(b.date) - msOf(a.date)); // newest first
}

export async function prependJournalEntry(entry: JournalEntry): Promise<void> {
  const entries = (await getJSON<JournalEntry[]>(JOURNAL_KEY)) ?? [];
  const next = entries.filter((e) => e.date !== entry.date);
  next.push(entry);
  next.sort((a, b) => msOf(b.date) - msOf(a.date));
  await setJSON(JOURNAL_KEY, next.slice(0, JOURNAL_CAP));
}

export async function setMcChickenJournal(entries: JournalEntry[]): Promise<void> {
  await setJSON(JOURNAL_KEY, entries.slice(0, JOURNAL_CAP));
}

// ── Quarantine state (one-off bad read awaiting confirmation) ────

export interface QuarantineState {
  price: number;
  range: { min: number; max: number } | null;
  timestamp: string;
  reason: string;
}
const QUARANTINE_KEY = "dashboard:mcchicken:quarantine";

export function getQuarantine(): Promise<QuarantineState | null> {
  return getJSON<QuarantineState>(QUARANTINE_KEY);
}
export async function setQuarantine(q: QuarantineState | null): Promise<void> {
  if (q === null) {
    await getRedis().del(QUARANTINE_KEY);
  } else {
    await setJSON(QUARANTINE_KEY, q);
  }
}

// ── Run audit log ────────────────────────────────────────────────

const RUNS_CAP = 30;

export async function getMcChickenRuns(): Promise<RunLogEntry[]> {
  return (await getJSON<RunLogEntry[]>(RUNS_KEY)) ?? [];
}

export async function appendRunLog(entry: RunLogEntry): Promise<void> {
  const runs = (await getJSON<RunLogEntry[]>(RUNS_KEY)) ?? [];
  runs.push(entry);
  await setJSON(RUNS_KEY, runs.slice(-RUNS_CAP));
}

// ── helpers ──────────────────────────────────────────────────────

/** Date → ms. Tolerates YYYY, YYYY-MM, YYYY-MM-DD. */
export function msOf(date: string): number {
  const t = new Date(date.length === 4 ? `${date}-01-01` : date).getTime();
  return isFinite(t) ? t : 0;
}
