/**
 * McChicken Index v3.1 — shared types.
 *
 * The pipeline is: LLM survey (untrusted input) → deterministic validation →
 * published point + append-only evidence. Types are split along that line:
 * `Survey*` types are what the model returns; `Metro*`/`Published*` types are
 * what deterministic code derived and persisted.
 */

// ── Panel manifest (data/panel-manifest.json) ────────────────────

export interface PanelMetro {
  metro: string;
  region: string;
  primaryUrl: string;
  verified: string;
  notes: string | null;
}

export interface PanelManifest {
  manifestVersion: string;
  adopted: string;
  itemSpec: string;
  primaryAggregator: string;
  metros: PanelMetro[];
  sourceHierarchy: string[];
  contentFarmBlocklist: string[];
  deliveryPlatformBlocklist: string[];
}

// ── Survey agent output (untrusted until validated) ──────────────

export type SourceType = "pinned_aggregator" | "aggregator" | "app" | "news";
export type PriceType = "standard_menu" | "value_menu_listed" | "promo_suspected";

export interface SurveyObservation {
  metro: string;
  price: number | null;
  source_url: string;
  source_type: SourceType;
  price_type: PriceType;
  page_updated: string | null;
  as_of: string;
  notes: string;
}

export interface NationalEstimate {
  estimate: number;
  source_url: string;
  as_of: string;
  description: string;
}

export interface RegimeEvent {
  date: string;
  event: string;
  source_url: string;
}

export interface SurveyResponse {
  survey_date: string;
  observations: SurveyObservation[];
  national_estimates: NationalEstimate[];
  regime_events: RegimeEvent[];
  quality_notes: string;
}

// ── Deterministic per-metro outcome ──────────────────────────────

export type MetroStatus =
  | "verified" // fresh observation passed every check
  | "carried" // no fresh verified read; last verified value carried (≤45d)
  | "held" // >15% move vs last verified — two-strike hold, excluded this run
  | "discarded_blocklist"
  | "discarded_citation" // fail-closed re-fetch could not confirm the price
  | "discarded_stale" // page_updated older than 45 days
  | "discarded_band" // outside $1.50–$6.00 hard bounds
  | "missing"; // model returned null / nothing usable and nothing to carry

export interface CitationCheck {
  fetched: boolean;
  priceFound: boolean;
  httpStatus: number | null;
  error: string | null;
}

export interface MetroResult {
  metro: string;
  status: MetroStatus;
  /** Price that entered the median (verified or carried), else null. */
  price: number | null;
  reportedPrice: number | null;
  sourceUrl: string | null;
  sourceType: SourceType | null;
  priceType: PriceType | null;
  pageUpdated: string | null;
  asOf: string | null;
  carriedFromDate: string | null;
  citationCheck: CitationCheck | null;
  notes: string | null;
}

/** Rolling per-metro validation state (Redis). */
export interface MetroState {
  lastVerifiedPrice: number;
  lastVerifiedDate: string;
  /** Pending two-strike hold, if any. */
  hold: { price: number; date: string; reason: string } | null;
}

export type PanelState = Record<string, MetroState>;

// ── Portion spec (shrinkflation guard) ───────────────────────────

export interface SpecComponent {
  name: string;
  grams: number;
}

export interface PortionSpecReading {
  /** Q_t primary derivation: sum of official component weights (quantity × 100 g). */
  grams: number;
  /** Cross-check: median of nutrient-density-derived weights across all nutrient rows. */
  nutrientMedianGrams: number;
  crossCheckDeltaGrams: number;
  components: SpecComponent[];
  calories: number | null;
  protein: number | null;
  fetchedAt: string;
}

export interface SpecState {
  current: {
    grams: number;
    components: SpecComponent[];
    verifiedAt: string; // last successful poll that agreed with this spec
    since: string; // when this spec value was adopted
  };
  /** Candidate spec change awaiting two-run persistence + sign-off. */
  pending: {
    grams: number;
    components: SpecComponent[];
    firstSeen: string;
    confirmedRuns: number;
    awaitingSignoff: boolean;
  } | null;
  /** Approved spec-change events (chart annotations). */
  events: Array<{
    date: string;
    fromGrams: number;
    toGrams: number;
    attribution: string;
  }>;
}

// ── Wage ─────────────────────────────────────────────────────────

export interface WageObservation {
  usdPerHour: number;
  month: string; // YYYY-MM (reference month)
  fetchedAt: string;
  source: string; // "FRED AHETPI (api)" | "FRED AHETPI (fredgraph)"
}

// ── Published output ─────────────────────────────────────────────

export interface Decomposition {
  /** Log-differences vs the previous published point, in percent (×100). */
  dLnMciPct: number;
  dLnPricePct: number;
  dLnPortionPct: number;
  dLnWagePct: number;
  vsDate: string;
}

export interface PublishedPoint {
  surveyDate: string; // YYYY-MM-DD
  mciMinutes: number; // published to 0.1
  panelPriceUsd: number; // median, 2dp
  portionGrams: number;
  portionFactor: number; // Q_ref / Q_t, 4dp
  wageUsdPerHour: number; // vintage-pinned
  wageMonth: string;
  quorum: { verified: number; carried: number; of: number };
  decomposition: Decomposition | null;
  publishedAt: string;
  methodologyVersion: string;
  instrument: { model: string; promptHash: string };
}

export type RunStatus = "published" | "gap" | "held" | "error" | "skipped";

export interface RunLogEntry {
  surveyDate: string;
  timestamp: string;
  status: RunStatus;
  reason?: string;
  mciMinutes?: number;
  panelPriceUsd?: number;
  quorum?: { verified: number; carried: number; of: number };
  durationMs?: number;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface HeldPublication {
  point: PublishedPoint;
  reason: string;
  priorMciMinutes: number;
  createdAt: string;
}

/** Full per-run evidence (append-only public log). */
export interface EvidenceRecord {
  surveyDate: string;
  runTimestamp: string;
  methodologyVersion: string;
  instrument: { model: string; promptHash: string; reasoningEffort: string };
  metros: MetroResult[];
  spec: {
    reading: PortionSpecReading | null;
    status: "verified" | "carried" | "pending_change";
    appliedGrams: number;
    rawExcerpt: unknown;
  };
  wage: WageObservation;
  nationalEstimates: NationalEstimate[];
  regimeEvents: RegimeEvent[];
  qualityNotes: string;
  outcome: {
    status: RunStatus;
    reason?: string;
    mciMinutes?: number;
    panelPriceUsd?: number;
  };
  usage?: { inputTokens: number; outputTokens: number };
}

export interface JournalEntry {
  date: string; // survey date
  title: string;
  body: string;
  status: RunStatus;
  mciMinutes: number | null;
  decomposition: Decomposition | null;
  quorum: { verified: number; carried: number; of: number } | null;
}

// ── Historical anchors (data/anchors.json) ───────────────────────

export interface HistoricalAnchor {
  date: string; // YYYY-MM
  priceUsd: number;
  specGrams: number;
  specFlag: string | null;
  wageUsdPerHour: number;
  mciMinutes: number;
  note: string;
  priceSource: string;
}

// ── Context series ───────────────────────────────────────────────

export interface CpiPoint {
  month: string; // YYYY-MM
  value: number;
  yoyPct: number | null;
}
