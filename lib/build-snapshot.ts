/**
 * Shared index-snapshot builder used by BOTH the weekly cron and the admin
 * migration endpoint, so there is exactly one computation path for the
 * published numbers.
 *
 * Given a validated retail price + FRED series + the prior observed point, it
 * returns the full current snapshot and the series point to persist.
 */

import type { FredSeriesKey, IndexedSeries } from "./fred";
import {
  retailIndexFromPrice,
  computeCostBasis,
  computeHeadline,
  computeSpread,
  confidenceFor,
  pctChange,
  round2,
  type CostKey,
} from "./index-model";
import type {
  McChickenCurrentData,
  McChickenHistoryPoint,
  ContextSeries,
} from "./redis";

export const METHODOLOGY_VERSION = "2.0";

export interface SnapshotInputs {
  today: string;
  retailPrice: number;
  range: { min: number; max: number } | null;
  dataDate: string | null;
  retailSources: string[];
  fred: Record<FredSeriesKey, IndexedSeries | null>;
  prior: McChickenHistoryPoint | null;
  source: string;
}

export function buildSnapshot(inp: SnapshotInputs): {
  current: McChickenCurrentData;
  point: McChickenHistoryPoint;
} {
  const { retailPrice, fred, prior } = inp;

  const retailIndex = retailIndexFromPrice(retailPrice);
  const costKeys: CostKey[] = ["chicken", "labor", "overhead"];
  const costSeries = Object.fromEntries(costKeys.map((k) => [k, fred[k]]));
  const costBasis = computeCostBasis(costSeries);
  const headline = computeHeadline(retailIndex, costBasis);
  const spread = computeSpread(retailIndex, costBasis.value);
  const confidence = confidenceFor(costBasis);

  const changes = {
    headlineWoWPct: pctChange(headline.value, prior?.headlineIndex ?? null),
    headlineWoWPoints:
      prior?.headlineIndex != null ? round2(headline.value - prior.headlineIndex) : null,
    retailWoWPct: pctChange(retailIndex, prior?.retailIndex ?? null),
    spreadWoWPoints:
      spread && prior?.marginSpreadPoints != null
        ? round2(spread.points - prior.marginSpreadPoints)
        : null,
    sinceBasePct: round2(headline.value - 100),
    previousDate: prior?.date ?? null,
  };

  const context: ContextSeries[] = [];
  if (fred.cpiFaFH) {
    context.push({
      label: fred.cpiFaFH.label,
      value: fred.cpiFaFH.latestValue,
      unit: fred.cpiFaFH.unit,
      asOf: fred.cpiFaFH.latestDate,
      source: fred.cpiFaFH.source,
      sourceUrl: fred.cpiFaFH.sourceUrl,
    });
  }

  const current: McChickenCurrentData = {
    headlineIndex: headline.value,
    headlineMethod: headline.method,
    retailWeight: headline.retailWeight,
    costWeight: headline.costWeight,
    retailIndex,
    retailPrice,
    costBasisIndex: costBasis.value,
    costCoverage: costBasis.coverage,
    costComponents: costBasis.components,
    marginSpreadPoints: spread?.points ?? null,
    marginSpreadPct: spread?.pct ?? null,
    changes,
    confidence,
    priceRange: inp.range,
    dataDate: inp.dataDate,
    retailSources: inp.retailSources,
    context,
    lastUpdated: new Date().toISOString(),
    methodologyVersion: METHODOLOGY_VERSION,
    notes:
      headline.method === "retail-only"
        ? "Cost basis unavailable (FRED inputs missing) — headline reflects observed retail only."
        : undefined,
  };

  const point: McChickenHistoryPoint = {
    date: inp.today,
    headlineIndex: headline.value,
    retailIndex,
    retailPrice,
    costBasisIndex: costBasis.value,
    marginSpreadPoints: spread?.points ?? null,
    source: inp.source,
    observed: true,
  };

  return { current, point };
}
