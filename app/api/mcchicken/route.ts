import { NextResponse } from "next/server";
import {
  getMcChickenCurrent,
  getMcChickenSeriesRange,
  type McChickenCurrentData,
} from "@/lib/redis";

/**
 * GET /api/mcchicken — public McChicken Index™ API (v2).
 *
 * Query: range = 1M | 3M | 6M | 1Y | 3Y | 5Y | ALL (includes history when set).
 * Returns the blended headline plus its retail and cost-basis layers, the
 * margin spread, real week-over-week movement, and a data-confidence flag.
 */
export async function GET(request: Request) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=3600",
  };

  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range");
    const c = (await getMcChickenCurrent()) as
      | (McChickenCurrentData & LegacyFields)
      | null;

    // Tolerate legacy (v1) snapshots: headline falls back to the old indexValue.
    const headlineIndex = c?.headlineIndex ?? c?.indexValue ?? null;
    const retailIndex = c?.retailIndex ?? c?.indexValue ?? null;
    const retailPrice = c?.retailPrice ?? c?.price ?? null;

    const response: Record<string, unknown> = {
      index: {
        headline: headlineIndex,
        method: c?.headlineMethod ?? "retail-only",
        retail: retailIndex,
        retailPrice,
        costBasis: c?.costBasisIndex ?? null,
        marginSpread: c?.marginSpreadPoints ?? null,
        marginSpreadPct: c?.marginSpreadPct ?? null,
        changeWoWPct: c?.changes?.headlineWoWPct ?? null,
        sinceBasePct: c?.changes?.sinceBasePct ?? null,
        confidence: c?.confidence ?? null,
        basePeriod: "2014-01",
        basePrice: 1.0,
        lastUpdated: c?.lastUpdated ?? null,
        methodologyVersion: c?.methodologyVersion ?? "2.0",
      },
      api: {
        version: "2.0",
        documentation: "https://mcchickenindex.org/methodology",
      },
    };

    if (range) {
      const start = rangeStart(range);
      response.history = await getMcChickenSeriesRange(start);
    }

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error("McChicken public API error:", error);
    return NextResponse.json(
      {
        error: "Service temporarily unavailable",
        api: { version: "2.0", documentation: "https://mcchickenindex.org/methodology" },
      },
      { status: 500, headers }
    );
  }
}

function rangeStart(range: string): string | undefined {
  const now = Date.now();
  const day = 86400000;
  const map: Record<string, number> = {
    "1M": 30,
    "3M": 90,
    "6M": 180,
    "1Y": 365,
    "3Y": 3 * 365,
    "5Y": 5 * 365,
  };
  const days = map[range];
  return days ? new Date(now - days * day).toISOString().split("T")[0] : undefined;
}

interface LegacyFields {
  indexValue?: number;
  price?: number;
}
