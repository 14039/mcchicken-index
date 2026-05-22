import { NextResponse } from "next/server";
import {
  getMcChickenCurrent,
  getMcChickenNews,
  type McChickenCurrentData,
} from "@/lib/redis";

/**
 * GET /api/dashboard/mcchicken
 *
 * Returns the current index snapshot + news from Redis. There is NO synthetic
 * fallback: if no real data exists, `available: false` is returned and the UI
 * shows an honest empty state. Legacy (v1) snapshots are normalized to the v2
 * shape as retail-only (no fabricated movement or cost basis).
 */
export async function GET() {
  try {
    const [currentRaw, news] = await Promise.all([
      getMcChickenCurrent(),
      getMcChickenNews(),
    ]);

    if (!currentRaw) {
      return NextResponse.json({ available: false, news }, { status: 200 });
    }

    const current = normalizeCurrent(currentRaw);
    return NextResponse.json({ available: true, ...current, news });
  } catch (error) {
    console.error("McChicken dashboard API error:", error);
    return NextResponse.json(
      { available: false, error: "Failed to fetch McChicken data" },
      { status: 500 }
    );
  }
}

/**
 * Adapt either schema to the v2 shape. A v1 snapshot only knew a price and a
 * (never-computed) change; we surface it truthfully as retail-only with no
 * week-over-week movement rather than inventing one.
 */
function normalizeCurrent(raw: McChickenCurrentData | LegacyCurrent): McChickenCurrentData {
  if ("headlineIndex" in raw && typeof raw.headlineIndex === "number") {
    return raw as McChickenCurrentData;
  }
  const v1 = raw as LegacyCurrent;
  const price = v1.price ?? 0;
  const retailIndex = v1.indexValue ?? Math.round((price / 1.0) * 100);
  return {
    headlineIndex: retailIndex,
    headlineMethod: "retail-only",
    retailWeight: 1,
    costWeight: 0,
    retailIndex,
    retailPrice: price,
    costBasisIndex: null,
    costCoverage: 0,
    costComponents: [],
    marginSpreadPoints: null,
    marginSpreadPct: null,
    changes: {
      headlineWoWPct: null,
      headlineWoWPoints: null,
      retailWoWPct: null,
      spreadWoWPoints: null,
      sinceBasePct: Math.round((retailIndex - 100) * 100) / 100,
      previousDate: null,
    },
    confidence: "retail-only",
    priceRange: null,
    dataDate: null,
    retailSources: v1.dataSources ?? [],
    context: [],
    lastUpdated: v1.lastUpdated ?? new Date().toISOString(),
    methodologyVersion: v1.methodologyVersion ?? "1.0",
    notes: "Legacy snapshot — awaiting first v2 update.",
  };
}

interface LegacyCurrent {
  indexValue?: number;
  price?: number;
  lastUpdated?: string;
  methodologyVersion?: string;
  dataSources?: string[];
}
