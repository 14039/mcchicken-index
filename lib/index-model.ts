/**
 * McChicken Index — methodology / computation layer (pure, no I/O).
 *
 * Three layered series, all base period January 2014 = 100:
 *
 *   Retail Index     observed national-average McChicken price ÷ $1.00 × 100
 *   Cost-Basis Index weighted basket of real input costs (chicken commodity,
 *                    food-service labor, overhead), each indexed to its own
 *                    2014 value — so the basket = 100 at the base period
 *   Headline Index   0.60 × Retail + 0.40 × Cost-Basis
 *
 * Margin Spread = Retail Index − Cost-Basis Index. Positive ⇒ menu price is
 * outrunning input costs (margin expansion); negative ⇒ costs are outrunning
 * menu price (McDonald's absorbing cost / margin compression).
 *
 * Every value here is derived from real inputs. When an input is missing the
 * model renormalizes over what's available and lowers its reported confidence
 * — it never substitutes a fabricated number.
 */

import type { IndexedSeries } from "./fred";

/** McChicken Dollar-Menu price at the Jan-2014 base period (verified). */
export const BASE_PRICE = 1.0;

/** Weight on observed retail in the blended headline (rest goes to cost basis). */
export const HEADLINE_RETAIL_WEIGHT = 0.6;
export const HEADLINE_COST_WEIGHT = 1 - HEADLINE_RETAIL_WEIGHT;

/**
 * Cost-basis basket weights, normalized to 1.0. Rationale: quick-service
 * restaurant unit economics — food & paper ≈ a third of revenue, labor ≈ a
 * third, occupancy/G&A/energy ≈ a third (operating margin excluded). Overhead
 * is proxied by core CPI. Documented on the methodology page.
 */
export const COST_WEIGHTS: Record<CostKey, number> = {
  chicken: 0.35,
  labor: 0.3,
  overhead: 0.35,
};

export type CostKey = "chicken" | "labor" | "overhead";
export const COST_KEYS: CostKey[] = ["chicken", "labor", "overhead"];

export interface CostComponent {
  key: string;
  label: string;
  weight: number; // effective (renormalized) weight actually applied
  indexed: number; // series value ÷ 2014 base × 100
  latestValue: number;
  unit: string;
  asOf: string;
  source: string;
  sourceUrl: string;
}

export interface CostBasis {
  /** Index value (base 2014 = 100), or null if no components were available. */
  value: number | null;
  /** Fraction of nominal weight that was sourced (0–1). */
  coverage: number;
  components: CostComponent[];
}

export interface Headline {
  value: number;
  method: "blended" | "retail-only";
  retailWeight: number;
  costWeight: number;
}

export type Confidence = "full" | "partial" | "retail-only";

export interface Spread {
  points: number; // retailIndex − costIndex
  pct: number; // points relative to cost index
}

/** Retail Index from an observed national-average price. */
export function retailIndexFromPrice(price: number): number {
  return round2((price / BASE_PRICE) * 100);
}

/**
 * Build the Cost-Basis Index from indexed FRED series. Weights renormalize
 * over whichever components are present, so a missing series lowers coverage
 * instead of zeroing the basket or faking a value.
 */
export function computeCostBasis(
  series: Partial<Record<CostKey, IndexedSeries | null>>
): CostBasis {
  const present = COST_KEYS.map((k) => ({ k, s: series[k] ?? null })).filter(
    (x): x is { k: CostKey; s: IndexedSeries } => x.s !== null
  );

  if (present.length === 0) {
    return { value: null, coverage: 0, components: [] };
  }

  const nominalSum = present.reduce((acc, { k }) => acc + COST_WEIGHTS[k], 0);
  const totalNominal = COST_KEYS.reduce((a, k) => a + COST_WEIGHTS[k], 0);

  let value = 0;
  const components: CostComponent[] = present.map(({ k, s }) => {
    const effWeight = COST_WEIGHTS[k] / nominalSum;
    value += effWeight * s.indexed;
    return {
      key: k,
      label: s.label,
      weight: round4(effWeight),
      indexed: round2(s.indexed),
      latestValue: s.latestValue,
      unit: s.unit,
      asOf: s.latestDate,
      source: s.source,
      sourceUrl: s.sourceUrl,
    };
  });

  return {
    value: round2(value),
    coverage: round4(nominalSum / totalNominal),
    components,
  };
}

/** Blend retail + cost basis. Falls back to retail-only (flagged) if no basis. */
export function computeHeadline(
  retailIndex: number,
  costBasis: CostBasis
): Headline {
  if (costBasis.value === null) {
    return {
      value: round2(retailIndex),
      method: "retail-only",
      retailWeight: 1,
      costWeight: 0,
    };
  }
  const value =
    HEADLINE_RETAIL_WEIGHT * retailIndex + HEADLINE_COST_WEIGHT * costBasis.value;
  return {
    value: round2(value),
    method: "blended",
    retailWeight: HEADLINE_RETAIL_WEIGHT,
    costWeight: HEADLINE_COST_WEIGHT,
  };
}

export function computeSpread(
  retailIndex: number,
  costBasisValue: number | null
): Spread | null {
  if (costBasisValue === null) return null;
  const points = retailIndex - costBasisValue;
  return { points: round2(points), pct: round2((points / costBasisValue) * 100) };
}

export function confidenceFor(costBasis: CostBasis): Confidence {
  if (costBasis.value === null) return "retail-only";
  return costBasis.coverage >= 0.999 ? "full" : "partial";
}

/** Percentage change from prev → curr, or null if prev is missing/zero. */
export function pctChange(curr: number, prev: number | null | undefined): number | null {
  if (prev === null || prev === undefined || prev === 0) return null;
  return round2(((curr - prev) / prev) * 100);
}

// ── Retail price validation (defends against the "$1.79" class of error) ──

/** A national-average McChicken below/above this is implausible. */
export const RETAIL_ABS_MIN = 1.5;
export const RETAIL_ABS_MAX = 6.0;
/** Week-over-week moves beyond this are quarantined pending confirmation. */
export const RETAIL_WOW_MAX = 0.15;

export interface RetailValidationInput {
  price: number;
  range: { min: number; max: number } | null;
  prevGoodPrice: number | null;
  /** A previously-quarantined candidate, if any (enables 2-strike confirm). */
  quarantinedPrice: number | null;
}

export interface RetailValidation {
  /** Whether the price may be published into the index. */
  ok: boolean;
  action: "publish" | "confirm-publish" | "quarantine";
  reason: string;
}

/**
 * Decide whether an observed retail price is trustworthy enough to publish.
 *
 * A one-off out-of-band read (e.g. grabbing the $1.79 "cheapest" price instead
 * of the ~$2.85 average) is quarantined and never published. If the *next*
 * week independently lands near that quarantined value, it's treated as a
 * confirmed regime shift and published — so genuine large moves aren't
 * rejected forever.
 */
export function validateRetailPrice(inp: RetailValidationInput): RetailValidation {
  const { price, range, prevGoodPrice, quarantinedPrice } = inp;

  if (!isFinite(price) || price <= 0) {
    return { ok: false, action: "quarantine", reason: "non-numeric or non-positive price" };
  }
  if (price < RETAIL_ABS_MIN || price > RETAIL_ABS_MAX) {
    return {
      ok: false,
      action: "quarantine",
      reason: `price $${price} outside plausible band $${RETAIL_ABS_MIN}-$${RETAIL_ABS_MAX}`,
    };
  }
  // "Average ≈ minimum" ⇒ the model likely returned the cheapest, not the average.
  if (range && range.max > range.min && price <= range.min * 1.03) {
    return {
      ok: false,
      action: "quarantine",
      reason: `price $${price} matches the range minimum ($${range.min}) — looks like the cheapest, not the average`,
    };
  }
  // Week-over-week guard.
  if (prevGoodPrice && prevGoodPrice > 0) {
    const move = Math.abs(price / prevGoodPrice - 1);
    if (move > RETAIL_WOW_MAX) {
      if (quarantinedPrice && Math.abs(price / quarantinedPrice - 1) <= 0.08) {
        return {
          ok: true,
          action: "confirm-publish",
          reason: `large move (${round2(move * 100)}%) confirmed by second independent read`,
        };
      }
      return {
        ok: false,
        action: "quarantine",
        reason: `week-over-week move ${round2(move * 100)}% exceeds ${RETAIL_WOW_MAX * 100}% — awaiting confirmation`,
      };
    }
  }
  return { ok: true, action: "publish", reason: "within bands" };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
