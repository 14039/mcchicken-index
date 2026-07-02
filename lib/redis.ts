/**
 * McChicken Index v3.1 — Redis storage (Upstash).
 *
 * Key schema (all new; v2 keys under dashboard:mcchicken:* are left frozen
 * as an archive and are never read or written by v3 code):
 *
 *   mci:v3:latest            JSON  latest PublishedPoint
 *   mci:v3:series            JSON  PublishedPoint[] (ascending by surveyDate)
 *   mci:v3:panel-state       JSON  PanelState (per-metro validation state)
 *   mci:v3:spec-state        JSON  SpecState (portion-spec state machine)
 *   mci:v3:evidence:<date>   JSON  EvidenceRecord for one run
 *   mci:v3:evidence-index    JSON  string[] of survey dates (append-only)
 *   mci:v3:journal           JSON  JournalEntry[] (newest first, capped)
 *   mci:v3:runs              JSON  RunLogEntry[] (capped audit log)
 *   mci:v3:held              JSON  HeldPublication or absent
 *   mci:v3:regime-events     JSON  RegimeEvent[] (deduped, capped)
 *   mci:v3:context:cpi       JSON  CpiPoint[] (CUUR0000SEFV02, monthly)
 *   mci:v3:lock:<date>       STR   idempotency lock (EX 7200)
 */

import { Redis } from "@upstash/redis";
import type {
  CpiPoint,
  EvidenceRecord,
  HeldPublication,
  JournalEntry,
  PanelState,
  PublishedPoint,
  RegimeEvent,
  RunLogEntry,
  SpecState,
} from "./types";

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

const K = {
  latest: "mci:v3:latest",
  series: "mci:v3:series",
  panelState: "mci:v3:panel-state",
  specState: "mci:v3:spec-state",
  evidence: (date: string) => `mci:v3:evidence:${date}`,
  evidenceIndex: "mci:v3:evidence-index",
  journal: "mci:v3:journal",
  runs: "mci:v3:runs",
  held: "mci:v3:held",
  regimeEvents: "mci:v3:regime-events",
  cpi: "mci:v3:context:cpi",
  lock: (date: string) => `mci:v3:lock:${date}`,
};

// ── Published series ─────────────────────────────────────────────

export function getLatestPoint(): Promise<PublishedPoint | null> {
  return getJSON<PublishedPoint>(K.latest);
}

export async function getSeries(): Promise<PublishedPoint[]> {
  return (await getJSON<PublishedPoint[]>(K.series)) ?? [];
}

/** Insert or replace the point for its survey date, keep ascending order. */
export async function publishPoint(point: PublishedPoint): Promise<void> {
  const series = await getSeries();
  const next = series.filter((p) => p.surveyDate !== point.surveyDate);
  next.push(point);
  next.sort((a, b) => a.surveyDate.localeCompare(b.surveyDate));
  await setJSON(K.series, next);
  await setJSON(K.latest, next[next.length - 1]);
}

// ── Validation state ─────────────────────────────────────────────

export async function getPanelState(): Promise<PanelState> {
  return (await getJSON<PanelState>(K.panelState)) ?? {};
}
export async function setPanelState(state: PanelState): Promise<void> {
  await setJSON(K.panelState, state);
}

export function getSpecState(): Promise<SpecState | null> {
  return getJSON<SpecState>(K.specState);
}
export async function setSpecState(state: SpecState): Promise<void> {
  await setJSON(K.specState, state);
}

// ── Evidence (append-only public log) ────────────────────────────

export async function appendEvidence(record: EvidenceRecord): Promise<void> {
  await setJSON(K.evidence(record.surveyDate), record);
  const index = (await getJSON<string[]>(K.evidenceIndex)) ?? [];
  if (!index.includes(record.surveyDate)) {
    index.push(record.surveyDate);
    index.sort();
    await setJSON(K.evidenceIndex, index);
  }
}

export function getEvidence(date: string): Promise<EvidenceRecord | null> {
  return getJSON<EvidenceRecord>(K.evidence(date));
}

export async function getEvidenceIndex(): Promise<string[]> {
  return (await getJSON<string[]>(K.evidenceIndex)) ?? [];
}

// ── Journal ──────────────────────────────────────────────────────

const JOURNAL_CAP = 120;

export async function getJournal(): Promise<JournalEntry[]> {
  return (await getJSON<JournalEntry[]>(K.journal)) ?? [];
}

export async function prependJournalEntry(entry: JournalEntry): Promise<void> {
  const entries = await getJournal();
  const next = [entry, ...entries.filter((e) => e.date !== entry.date)];
  await setJSON(K.journal, next.slice(0, JOURNAL_CAP));
}

// ── Run log ──────────────────────────────────────────────────────

const RUNS_CAP = 60;

export async function getRuns(): Promise<RunLogEntry[]> {
  return (await getJSON<RunLogEntry[]>(K.runs)) ?? [];
}

export async function appendRunLog(entry: RunLogEntry): Promise<void> {
  const runs = await getRuns();
  runs.push(entry);
  await setJSON(K.runs, runs.slice(-RUNS_CAP));
}

// ── Held publication (>5% headline move awaiting sign-off) ───────

export function getHeld(): Promise<HeldPublication | null> {
  return getJSON<HeldPublication>(K.held);
}
export async function setHeld(held: HeldPublication | null): Promise<void> {
  if (held === null) {
    await getRedis().del(K.held);
  } else {
    await setJSON(K.held, held);
  }
}

// ── Regime events (menu-regime watch feed) ───────────────────────

const REGIME_CAP = 40;

export async function getRegimeEvents(): Promise<RegimeEvent[]> {
  return (await getJSON<RegimeEvent[]>(K.regimeEvents)) ?? [];
}

export async function mergeRegimeEvents(events: RegimeEvent[]): Promise<void> {
  if (events.length === 0) return;
  const existing = await getRegimeEvents();
  const seen = new Set(existing.map((e) => `${e.date}|${e.event}`));
  const merged = [...existing];
  for (const e of events) {
    const key = `${e.date}|${e.event}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(e);
    }
  }
  merged.sort((a, b) => b.date.localeCompare(a.date));
  await setJSON(K.regimeEvents, merged.slice(0, REGIME_CAP));
}

// ── CPI context series ───────────────────────────────────────────

export async function getCpiSeries(): Promise<CpiPoint[]> {
  return (await getJSON<CpiPoint[]>(K.cpi)) ?? [];
}
export async function setCpiSeries(points: CpiPoint[]): Promise<void> {
  await setJSON(K.cpi, points);
}

// ── Idempotency lock ─────────────────────────────────────────────

/** Returns true if the lock was acquired (first invocation for this date). */
export async function acquireRunLock(date: string): Promise<boolean> {
  const res = await getRedis().set(K.lock(date), new Date().toISOString(), {
    nx: true,
    ex: 7200,
  });
  return res === "OK";
}

export async function releaseRunLock(date: string): Promise<void> {
  await getRedis().del(K.lock(date));
}
