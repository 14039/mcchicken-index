/**
 * Deterministic post-processing (METHODOLOGY.md §2) — code, not model:
 *
 *   portion-spec state machine → manifest/blocklist URL enforcement →
 *   fail-closed citation re-fetch → per-metro bands and two-strike holds →
 *   staleness exclusion → carry-forward → quorum → median →
 *   MCI with pinned W and verified Q → sign-off hold on >5% headline moves.
 *
 * Everything here is pure or explicitly async-idempotent so a run can be
 * re-executed (Vercel crons occasionally double-fire) without corruption.
 */

import {
  CARRY_FORWARD_MAX,
  CARRY_FORWARD_MAX_AGE_DAYS,
  HEADLINE_SIGNOFF_PCT,
  METRO_HOLD_CONFIRM_PCT,
  METRO_HOLD_MOVE_PCT,
  METRO_PRICE_MAX_USD,
  METRO_PRICE_MIN_USD,
  PANEL_SIZE,
  Q_REF_GRAMS,
  QUORUM_MIN,
  SPEC_CHANGE_THRESHOLD_GRAMS,
  SPEC_CONFIRM_TOLERANCE_GRAMS,
  STALE_PAGE_MAX_AGE_DAYS,
  METHODOLOGY_VERSION,
} from "./config";
import { verifyCitation } from "./citation-check";
import type {
  Decomposition,
  MetroResult,
  PanelManifest,
  PanelState,
  PortionSpecReading,
  PublishedPoint,
  SpecState,
  SurveyObservation,
  SurveyResponse,
  WageObservation,
} from "./types";

// ── small helpers ────────────────────────────────────────────────

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return ms / 86_400_000;
}

function median(values: number[]): number {
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeMetro(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

// ── portion-spec state machine ───────────────────────────────────

export interface SpecAdvance {
  state: SpecState;
  appliedGrams: number;
  status: "verified" | "carried" | "pending_change";
}

export function initialSpecState(reading: PortionSpecReading, surveyDate: string): SpecState {
  return {
    current: {
      grams: reading.grams,
      components: reading.components,
      verifiedAt: reading.fetchedAt,
      since: surveyDate,
    },
    pending: null,
    events: [],
  };
}

/**
 * Advance the spec state with a new reading (or null when the endpoint was
 * unavailable). A spec change must exceed 1 g, persist across two consecutive
 * runs, and then be approved by a human before it enters the formula — until
 * then the last verified spec applies.
 */
export function advanceSpecState(
  state: SpecState | null,
  reading: PortionSpecReading | null,
  surveyDate: string
): SpecAdvance {
  if (!state) {
    if (reading) {
      return {
        state: initialSpecState(reading, surveyDate),
        appliedGrams: reading.grams,
        status: "verified",
      };
    }
    // Bootstrap with the endpoint down: Q_ref is the documented spec at adoption.
    return {
      state: {
        current: {
          grams: Q_REF_GRAMS,
          components: [],
          verifiedAt: "2026-07-02T00:00:00.000Z",
          since: "2026-07-02",
        },
        pending: null,
        events: [],
      },
      appliedGrams: Q_REF_GRAMS,
      status: "carried",
    };
  }

  if (!reading) {
    return { state, appliedGrams: state.current.grams, status: "carried" };
  }

  const delta = Math.abs(reading.grams - state.current.grams);
  if (delta <= SPEC_CHANGE_THRESHOLD_GRAMS) {
    // Same spec (sub-threshold differences are cross-nutrient jitter).
    const next: SpecState = {
      ...state,
      current: { ...state.current, verifiedAt: reading.fetchedAt },
      pending: null,
    };
    return { state: next, appliedGrams: next.current.grams, status: "verified" };
  }

  // Candidate spec change.
  if (
    state.pending &&
    Math.abs(reading.grams - state.pending.grams) <= SPEC_CONFIRM_TOLERANCE_GRAMS
  ) {
    const next: SpecState = {
      ...state,
      pending: {
        ...state.pending,
        components: reading.components,
        confirmedRuns: state.pending.confirmedRuns + 1,
        awaitingSignoff: true, // persisted across ≥2 consecutive runs
      },
    };
    return { state: next, appliedGrams: state.current.grams, status: "pending_change" };
  }

  const next: SpecState = {
    ...state,
    pending: {
      grams: reading.grams,
      components: reading.components,
      firstSeen: surveyDate,
      confirmedRuns: 1,
      awaitingSignoff: false,
    },
  };
  return { state: next, appliedGrams: state.current.grams, status: "pending_change" };
}

/** Human-readable per-component attribution for an approved spec change. */
export function specChangeAttribution(state: SpecState): string {
  const pending = state.pending;
  if (!pending) return "";
  const before = new Map(state.current.components.map((c) => [c.name, c.grams]));
  const parts: string[] = [];
  for (const c of pending.components) {
    const prev = before.get(c.name);
    if (prev === undefined) {
      parts.push(`${c.name} added (${c.grams} g)`);
    } else if (Math.abs(c.grams - prev) >= 0.05) {
      const d = round2(c.grams - prev);
      parts.push(`${c.name} ${d > 0 ? "+" : ""}${d} g`);
    }
  }
  for (const c of state.current.components) {
    if (!pending.components.some((p) => p.name === c.name)) {
      parts.push(`${c.name} removed (−${c.grams} g)`);
    }
  }
  return parts.join(", ") || "composition unchanged at component level";
}

// ── per-metro validation ─────────────────────────────────────────

export interface PanelProcessResult {
  metros: MetroResult[];
  panelState: PanelState;
  quorum: { verified: number; carried: number; of: number };
  panelPriceUsd: number | null;
  gapReason: string | null;
}

/**
 * Validate the survey observations against the manifest and rolling panel
 * state. Performs the fail-closed citation re-fetch (network) for every
 * candidate observation.
 */
export async function processPanel(
  survey: SurveyResponse,
  manifest: PanelManifest,
  priorState: PanelState,
  surveyDate: string
): Promise<PanelProcessResult> {
  const blockedHosts = [
    ...manifest.contentFarmBlocklist,
    ...manifest.deliveryPlatformBlocklist,
  ].map((d) => d.toLowerCase());

  const obsByMetro = new Map<string, SurveyObservation>();
  for (const obs of survey.observations) {
    obsByMetro.set(normalizeMetro(obs.metro), obs);
  }

  const state: PanelState = JSON.parse(JSON.stringify(priorState));
  const results: MetroResult[] = [];

  for (const panelMetro of manifest.metros) {
    const key = normalizeMetro(panelMetro.metro);
    const obs = obsByMetro.get(key) ?? null;
    const metroState = state[panelMetro.metro] ?? null;

    const base: MetroResult = {
      metro: panelMetro.metro,
      status: "missing",
      price: null,
      reportedPrice: obs?.price ?? null,
      sourceUrl: obs?.source_url ?? null,
      sourceType: obs?.source_type ?? null,
      priceType: obs?.price_type ?? null,
      pageUpdated: obs?.page_updated ?? null,
      asOf: obs?.as_of ?? null,
      carriedFromDate: null,
      citationCheck: null,
      notes: obs?.notes ?? null,
    };

    let result = base;

    if (obs && obs.price !== null && isFinite(obs.price)) {
      const host = hostnameOf(obs.source_url);
      const blocked =
        !host || blockedHosts.some((b) => host === b || host.endsWith(`.${b}`));
      const stale =
        obs.page_updated !== null &&
        isFinite(new Date(obs.page_updated).getTime()) &&
        daysBetween(obs.page_updated, surveyDate) > STALE_PAGE_MAX_AGE_DAYS;
      const outOfBand =
        obs.price < METRO_PRICE_MIN_USD || obs.price > METRO_PRICE_MAX_USD;

      if (blocked) {
        result = { ...base, status: "discarded_blocklist" };
      } else if (stale) {
        result = { ...base, status: "discarded_stale" };
      } else if (outOfBand) {
        result = { ...base, status: "discarded_band" };
      } else {
        const citation = await verifyCitation(obs.source_url, obs.price);
        if (!citation.priceFound) {
          result = { ...base, status: "discarded_citation", citationCheck: citation };
        } else {
          // Two-strike rule vs last verified value.
          const price = round2(obs.price);
          if (!metroState) {
            state[panelMetro.metro] = {
              lastVerifiedPrice: price,
              lastVerifiedDate: surveyDate,
              hold: null,
            };
            result = { ...base, status: "verified", price, citationCheck: citation };
          } else {
            const movePct =
              Math.abs(price / metroState.lastVerifiedPrice - 1) * 100;
            if (movePct <= METRO_HOLD_MOVE_PCT) {
              state[panelMetro.metro] = {
                lastVerifiedPrice: price,
                lastVerifiedDate: surveyDate,
                hold: null,
              };
              result = { ...base, status: "verified", price, citationCheck: citation };
            } else if (
              metroState.hold &&
              Math.abs(price / metroState.hold.price - 1) * 100 <=
                METRO_HOLD_CONFIRM_PCT
            ) {
              // Second strike confirms a genuine repricing.
              state[panelMetro.metro] = {
                lastVerifiedPrice: price,
                lastVerifiedDate: surveyDate,
                hold: null,
              };
              result = { ...base, status: "verified", price, citationCheck: citation };
            } else {
              state[panelMetro.metro] = {
                ...metroState,
                hold: {
                  price,
                  date: surveyDate,
                  reason: `move ${round2(movePct)}% vs last verified $${metroState.lastVerifiedPrice}`,
                },
              };
              result = { ...base, status: "held", citationCheck: citation };
            }
          }
        }
      }
    }

    results.push(result);
  }

  // Carry-forward: metros without a fresh verified read may reuse their last
  // verified value if it is ≤45 days old — at most 3, most recent first.
  const carryCandidates = results
    .map((r, i) => ({ r, i, s: state[r.metro] }))
    .filter(
      ({ r, s }) =>
        r.status !== "verified" &&
        s &&
        s.lastVerifiedDate !== surveyDate &&
        daysBetween(s.lastVerifiedDate, surveyDate) <= CARRY_FORWARD_MAX_AGE_DAYS
    )
    .sort((a, b) => b.s!.lastVerifiedDate.localeCompare(a.s!.lastVerifiedDate))
    .slice(0, CARRY_FORWARD_MAX);

  for (const { r, i, s } of carryCandidates) {
    results[i] = {
      ...r,
      status: "carried",
      price: s!.lastVerifiedPrice,
      carriedFromDate: s!.lastVerifiedDate,
    };
  }

  const verified = results.filter((r) => r.status === "verified").length;
  const carried = results.filter((r) => r.status === "carried").length;
  const quorum = { verified, carried, of: PANEL_SIZE };

  if (verified + carried < QUORUM_MIN) {
    return {
      metros: results,
      panelState: state,
      quorum,
      panelPriceUsd: null,
      gapReason: `quorum ${verified + carried}/${PANEL_SIZE} below minimum ${QUORUM_MIN} — explicit gap recorded`,
    };
  }

  const prices = results
    .filter((r) => r.price !== null)
    .map((r) => r.price as number);
  return {
    metros: results,
    panelState: state,
    quorum,
    panelPriceUsd: round2(median(prices)),
    gapReason: null,
  };
}

// ── index computation ────────────────────────────────────────────

function rawMci(priceUsd: number, portionGrams: number, wage: number): number {
  return (60 * (priceUsd * (Q_REF_GRAMS / portionGrams))) / wage;
}

export interface ComputeResult {
  point: PublishedPoint;
  /** Set when |headline move| > 5% — publication requires human sign-off. */
  holdReason: string | null;
  headlineMovePct: number | null;
}

export function computePoint(input: {
  surveyDate: string;
  panelPriceUsd: number;
  portionGrams: number;
  wage: WageObservation;
  prior: PublishedPoint | null;
  instrument: { model: string; promptHash: string };
}): ComputeResult {
  const { surveyDate, panelPriceUsd, portionGrams, wage, prior, instrument } = input;

  const raw = rawMci(panelPriceUsd, portionGrams, wage.usdPerHour);

  let decomposition: Decomposition | null = null;
  let holdReason: string | null = null;
  let headlineMovePct: number | null = null;

  if (prior) {
    const priorRaw = rawMci(prior.panelPriceUsd, prior.portionGrams, prior.wageUsdPerHour);
    const dP = Math.log(panelPriceUsd / prior.panelPriceUsd) * 100;
    const dQ = Math.log(portionGrams / prior.portionGrams) * 100;
    const dW = Math.log(wage.usdPerHour / prior.wageUsdPerHour) * 100;
    decomposition = {
      dLnMciPct: round2(dP - dQ - dW),
      dLnPricePct: round2(dP),
      dLnPortionPct: round2(dQ),
      dLnWagePct: round2(dW),
      vsDate: prior.surveyDate,
    };
    headlineMovePct = round2((raw / priorRaw - 1) * 100);
    if (Math.abs(headlineMovePct) > HEADLINE_SIGNOFF_PCT) {
      holdReason = `headline move ${headlineMovePct}% exceeds ±${HEADLINE_SIGNOFF_PCT}% — human sign-off required`;
    }
  }

  const point: PublishedPoint = {
    surveyDate,
    mciMinutes: round1(raw),
    panelPriceUsd,
    portionGrams,
    portionFactor: round4(Q_REF_GRAMS / portionGrams),
    wageUsdPerHour: wage.usdPerHour,
    wageMonth: wage.month,
    quorum: { verified: 0, carried: 0, of: PANEL_SIZE }, // caller fills
    decomposition,
    publishedAt: new Date().toISOString(),
    methodologyVersion: METHODOLOGY_VERSION,
    instrument,
  };

  return { point, holdReason, headlineMovePct };
}
