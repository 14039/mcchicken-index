import { NextResponse } from "next/server";
import {
  getMcChickenSeries,
  getLegacyHistory,
  msOf,
  type McChickenHistoryPoint,
} from "@/lib/redis";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * GET /api/dashboard/mcchicken/history?range=ALL|1Y|5Y|1M
 *
 * Source priority: v2 series document → legacy sorted set → in-repo seed JSON.
 * Legacy/seed points are normalized to the v2 shape and marked observed:false
 * (historical anchors), distinct from live weekly observations.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "ALL";
    const start = rangeStart(range);

    let points: McChickenHistoryPoint[] = await getMcChickenSeries();

    if (points.length === 0) {
      const legacy = await getLegacyHistory();
      points = legacy.map(normalizeLegacy);
    }
    if (points.length === 0) {
      points = readSeedFile();
    }

    const min = start ? msOf(start) : -Infinity;
    const filtered = points
      .filter((p) => msOf(p.date) >= min)
      .sort((a, b) => msOf(a.date) - msOf(b.date));

    return NextResponse.json({
      range,
      dataPoints: filtered.length,
      history: filtered,
    });
  } catch (error) {
    console.error("McChicken history API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch McChicken history" },
      { status: 500 }
    );
  }
}

function rangeStart(range: string): string | undefined {
  const now = Date.now();
  const day = 86400000;
  switch (range) {
    case "1M":
      return new Date(now - 30 * day).toISOString().split("T")[0];
    case "1Y":
      return new Date(now - 365 * day).toISOString().split("T")[0];
    case "5Y":
      return new Date(now - 5 * 365 * day).toISOString().split("T")[0];
    default:
      return undefined;
  }
}

function normalizeLegacy(d: {
  date: string;
  price: number;
  indexValue?: number;
  source?: string;
}): McChickenHistoryPoint {
  const idx = d.indexValue ?? Math.round((d.price / 1.0) * 100);
  return {
    date: d.date,
    headlineIndex: idx,
    retailIndex: idx,
    retailPrice: d.price,
    costBasisIndex: null,
    marginSpreadPoints: null,
    source: d.source ?? "Historical",
    observed: (d.source ?? "").toLowerCase().includes("weekly"),
  };
}

function readSeedFile(): McChickenHistoryPoint[] {
  try {
    const filePath = join(process.cwd(), "data/price-history.json");
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as Array<{
      date: string;
      price: number;
      source?: string;
    }>;
    return raw.map((d) => normalizeLegacy(d));
  } catch {
    return [];
  }
}
