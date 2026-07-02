/**
 * Journal writer — a separate, grounded LLM call (no web access). The model
 * receives only the run's own published facts and must not introduce outside
 * numbers; every figure in a journal entry is traceable to the run record.
 */

import { dispatchJournal } from "./openai";
import type {
  Decomposition,
  JournalEntry,
  MetroResult,
  RegimeEvent,
  RunStatus,
} from "./types";

export interface JournalFacts {
  surveyDate: string;
  status: RunStatus;
  reason?: string;
  mciMinutes: number | null;
  panelPriceUsd: number | null;
  wageUsdPerHour: number | null;
  wageMonth: string | null;
  portionGrams: number | null;
  specStatus: string;
  quorum: { verified: number; carried: number; of: number } | null;
  decomposition: Decomposition | null;
  metros: MetroResult[];
  regimeEvents: RegimeEvent[];
}

function factsBlock(f: JournalFacts): string {
  const lines: string[] = [
    `survey_date: ${f.surveyDate}`,
    `run_status: ${f.status}${f.reason ? ` (${f.reason})` : ""}`,
    `mci_minutes: ${f.mciMinutes ?? "n/a"}`,
    `panel_price_median_usd: ${f.panelPriceUsd ?? "n/a"}`,
    `wage_usd_per_hour: ${f.wageUsdPerHour ?? "n/a"} (AHETPI ${f.wageMonth ?? "n/a"})`,
    `portion_grams: ${f.portionGrams ?? "n/a"} (spec ${f.specStatus})`,
    `quorum: ${f.quorum ? `${f.quorum.verified} verified + ${f.quorum.carried} carried of ${f.quorum.of}` : "n/a"}`,
  ];
  if (f.decomposition) {
    lines.push(
      `decomposition_vs_${f.decomposition.vsDate}: mci ${f.decomposition.dLnMciPct}% = price ${f.decomposition.dLnPricePct}% − portion ${f.decomposition.dLnPortionPct}% − wage ${f.decomposition.dLnWagePct}% (log-differences)`
    );
  }
  const holds = f.metros.filter((m) => m.status === "held");
  const carried = f.metros.filter((m) => m.status === "carried");
  const discarded = f.metros.filter((m) => m.status.startsWith("discarded"));
  if (holds.length)
    lines.push(`held_metros: ${holds.map((m) => m.metro).join(", ")}`);
  if (carried.length)
    lines.push(
      `carried_metros: ${carried.map((m) => `${m.metro} (from ${m.carriedFromDate})`).join(", ")}`
    );
  if (discarded.length)
    lines.push(
      `discarded_observations: ${discarded.map((m) => `${m.metro} (${m.status})`).join(", ")}`
    );
  if (f.regimeEvents.length)
    lines.push(
      `regime_events: ${f.regimeEvents.map((e) => `${e.date}: ${e.event}`).join(" | ")}`
    );
  return lines.join("\n");
}

function journalPrompt(f: JournalFacts): string {
  return `You write the run journal for the McChicken Index (mcchickenindex.org), a
U.S. fast-food affordability indicator measured in minutes of work per
standard McChicken. Below are the complete facts of one survey run.

Write a short journal entry: a title (max 10 words) and a body of 2-4
sentences. Neutral, analytical tone for researchers and investors. Use ONLY
the facts below — never introduce numbers, dates, events, or causes that are
not listed. If the run published, say what moved (prices, portion, or wages)
using the decomposition. If it recorded a gap or hold, state that plainly and
why. Do not speculate.

FACTS:
${factsBlock(f)}`;
}

export async function writeJournalEntry(f: JournalFacts): Promise<JournalEntry> {
  const draft = await dispatchJournal(journalPrompt(f));
  return {
    date: f.surveyDate,
    title: draft.title,
    body: draft.body,
    status: f.status,
    mciMinutes: f.mciMinutes,
    decomposition: f.decomposition,
    quorum: f.quorum,
  };
}
