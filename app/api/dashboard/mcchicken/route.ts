import { NextResponse } from "next/server";
import { getMcChickenCurrent, getMcChickenNews } from "@/lib/redis";
import { getMcChickenPrice, getDailyChange } from "@/lib/mcchicken";

/**
 * GET /api/dashboard/mcchicken
 * Returns current McChicken Index data + news. Falls back to static data.
 */
export async function GET() {
  try {
    const [current, news] = await Promise.all([
      getMcChickenCurrent(),
      getMcChickenNews(),
    ]);

    if (current) {
      return NextResponse.json({ ...current, news });
    }

    const now = new Date();
    const price = getMcChickenPrice(now);
    const daily = getDailyChange(now);
    const indexValue = Math.round((price / 1.0) * 100);

    return NextResponse.json({
      indexValue,
      price,
      previousPrice: daily.prevPrice,
      change: daily.change,
      changePercent: daily.changePercent,
      regionalPrices: {
        northeast: null,
        south: null,
        midwest: null,
        west: null,
      },
      components: {
        cpiFood: 0,
        chickenWholesale: 0,
        avgFoodServiceWage: 0,
        federalMinWage: 7.25,
      },
      lastUpdated: now.toISOString(),
      methodologyVersion: "1.0",
      source: "Static fallback",
      dataSources: [],
      news: [],
    });
  } catch (error) {
    console.error("McChicken API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch McChicken data" },
      { status: 500 }
    );
  }
}
