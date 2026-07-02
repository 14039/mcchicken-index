/**
 * Survey run orchestrator — dispatched by Vercel cron Mon & Thu 08:00 UTC.
 *
 * Query params (all optional, for operations):
 *   ?dry=1    execute the full pipeline but persist nothing (test mode)
 *   ?force=1  bypass the per-date idempotency lock (manual re-run)
 */

import { NextRequest, NextResponse } from "next/server";
import manifestJson from "@/data/panel-manifest.json";
import {
  METHODOLOGY_VERSION,
  SURVEY_REASONING_EFFORT,
} from "@/lib/config";
import { fetchWage } from "@/lib/fred";
import { fetchCpiLimitedService } from "@/lib/bls";
import { fetchPortionSpec, type SpecFetchResult } from "@/lib/portion-spec";
import { buildSurveyPrompt } from "@/lib/survey-prompt";
import { dispatchSurvey } from "@/lib/openai";
import {
  advanceSpecState,
  computePoint,
  processPanel,
} from "@/lib/pipeline";
import { writeJournalEntry, type JournalFacts } from "@/lib/journal";
import {
  acquireRunLock,
  appendEvidence,
  appendRunLog,
  getCpiSeries,
  getLatestPoint,
  getPanelState,
  getSpecState,
  mergeRegimeEvents,
  prependJournalEntry,
  publishPoint,
  releaseRunLock,
  setCpiSeries,
  setHeld,
  setPanelState,
  setSpecState,
} from "@/lib/redis";
import type {
  EvidenceRecord,
  PanelManifest,
  RunLogEntry,
  RunStatus,
} from "@/lib/types";

export const maxDuration = 800; // xhigh survey runs take 145–400s+
export const dynamic = "force-dynamic";

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Fail-closed auth: no CRON_SECRET configured means no access at all.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) return unauthorized();

  const started = Date.now();
  const dry = request.nextUrl.searchParams.get("dry") === "1";
  const force = request.nextUrl.searchParams.get("force") === "1";
  const surveyDate = new Date().toISOString().slice(0, 10);
  const manifest = manifestJson as PanelManifest;

  if (!dry && !force) {
    const locked = await acquireRunLock(surveyDate);
    if (!locked) {
      return NextResponse.json({ surveyDate, status: "skipped", reason: "already ran (lock held)" });
    }
  }

  let runStatus: RunStatus = "error";
  let runReason: string | undefined;

  try {
    // ── Gather deterministic inputs in parallel with dispatching the survey.
    const specPromise: Promise<SpecFetchResult | null> = fetchPortionSpec().catch(() => null);
    const wagePromise = fetchWage(); // throws if wage is unavailable — no W, no run
    const prompt = buildSurveyPrompt(manifest, surveyDate);
    const surveyPromise = dispatchSurvey(prompt);

    const [specFetch, wage, dispatch] = await Promise.all([
      specPromise,
      wagePromise,
      surveyPromise,
    ]);

    const [priorSpecState, priorPanelState, priorPoint] = await Promise.all([
      getSpecState(),
      getPanelState(),
      getLatestPoint(),
    ]);

    // ── Portion spec state machine (deterministic; LLM never involved).
    const spec = advanceSpecState(priorSpecState, specFetch?.reading ?? null, surveyDate);

    // ── Panel validation: blocklist → citation re-fetch → bands → two-strike
    //    holds → carry-forward → quorum → median.
    const panel = await processPanel(dispatch.survey, manifest, priorPanelState, surveyDate);

    const instrument = { model: dispatch.model, promptHash: dispatch.promptHash };
    let mciMinutes: number | null = null;
    let holdReason: string | null = null;
    let decomposition = null;

    if (panel.gapReason) {
      runStatus = "gap";
      runReason = panel.gapReason;
    } else {
      const computed = computePoint({
        surveyDate,
        panelPriceUsd: panel.panelPriceUsd!,
        portionGrams: spec.appliedGrams,
        wage,
        prior: priorPoint,
        instrument,
      });
      computed.point.quorum = panel.quorum;
      mciMinutes = computed.point.mciMinutes;
      decomposition = computed.point.decomposition;
      holdReason = computed.holdReason;

      if (holdReason) {
        runStatus = "held";
        runReason = holdReason;
        if (!dry) {
          await setHeld({
            point: computed.point,
            reason: holdReason,
            priorMciMinutes: priorPoint?.mciMinutes ?? NaN,
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        runStatus = "published";
        if (!dry) await publishPoint(computed.point);
      }
    }

    // ── Persist state + evidence (always, including gaps and holds).
    const evidence: EvidenceRecord = {
      surveyDate,
      runTimestamp: new Date().toISOString(),
      methodologyVersion: METHODOLOGY_VERSION,
      instrument: { ...instrument, reasoningEffort: SURVEY_REASONING_EFFORT },
      metros: panel.metros,
      spec: {
        reading: specFetch?.reading ?? null,
        status: spec.status,
        appliedGrams: spec.appliedGrams,
        rawExcerpt: specFetch?.rawExcerpt ?? null,
      },
      wage,
      nationalEstimates: dispatch.survey.national_estimates,
      regimeEvents: dispatch.survey.regime_events,
      qualityNotes: dispatch.survey.quality_notes,
      outcome: {
        status: runStatus,
        reason: runReason,
        mciMinutes: mciMinutes ?? undefined,
        panelPriceUsd: panel.panelPriceUsd ?? undefined,
      },
      usage: dispatch.usage ?? undefined,
    };

    if (!dry) {
      await Promise.all([
        appendEvidence(evidence),
        setPanelState(panel.panelState),
        setSpecState(spec.state),
        mergeRegimeEvents(dispatch.survey.regime_events),
      ]);
    }

    // ── CPI context refresh (non-fatal, at most monthly-fresh anyway).
    if (!dry) {
      try {
        const existing = await getCpiSeries();
        const lastMonth = existing[existing.length - 1]?.month ?? "";
        const currentMonth = surveyDate.slice(0, 7);
        if (lastMonth < currentMonth) {
          await setCpiSeries(await fetchCpiLimitedService(4));
        }
      } catch {
        // context layer only — never blocks a run
      }
    }

    // ── Journal entry (separate grounded LLM call; non-fatal).
    let journalOk = false;
    try {
      const facts: JournalFacts = {
        surveyDate,
        status: runStatus,
        reason: runReason,
        mciMinutes,
        panelPriceUsd: panel.panelPriceUsd,
        wageUsdPerHour: wage.usdPerHour,
        wageMonth: wage.month,
        portionGrams: spec.appliedGrams,
        specStatus: spec.status,
        quorum: panel.quorum,
        decomposition,
        metros: panel.metros,
        regimeEvents: dispatch.survey.regime_events,
      };
      const entry = await writeJournalEntry(facts);
      if (!dry) await prependJournalEntry(entry);
      journalOk = true;
    } catch {
      journalOk = false;
    }

    const runLog: RunLogEntry = {
      surveyDate,
      timestamp: new Date().toISOString(),
      status: runStatus,
      reason: runReason,
      mciMinutes: mciMinutes ?? undefined,
      panelPriceUsd: panel.panelPriceUsd ?? undefined,
      quorum: panel.quorum,
      durationMs: Date.now() - started,
      usage: dispatch.usage ?? undefined,
    };
    if (!dry) await appendRunLog(runLog);

    return NextResponse.json({
      surveyDate,
      dry,
      status: runStatus,
      reason: runReason,
      mciMinutes,
      panelPriceUsd: panel.panelPriceUsd,
      quorum: panel.quorum,
      spec: { status: spec.status, appliedGrams: spec.appliedGrams },
      wage: { usdPerHour: wage.usdPerHour, month: wage.month },
      metros: panel.metros.map((m) => ({
        metro: m.metro,
        status: m.status,
        price: m.price,
        reportedPrice: m.reportedPrice,
      })),
      journalOk,
      durationMs: Date.now() - started,
      usage: dispatch.usage,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!dry) {
      await appendRunLog({
        surveyDate,
        timestamp: new Date().toISOString(),
        status: "error",
        reason: message,
        durationMs: Date.now() - started,
      }).catch(() => {});
      // Release the lock so a manual retry can run the same day.
      await releaseRunLock(surveyDate).catch(() => {});
    }
    return NextResponse.json(
      { surveyDate, status: "error", error: message },
      { status: 500 }
    );
  }
}
