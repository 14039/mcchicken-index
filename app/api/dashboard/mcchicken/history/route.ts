import { NextResponse } from "next/server";
import { getMcChickenHistory } from "@/lib/redis";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * GET /api/dashboard/mcchicken/history?range=ALL
 *
 * Returns historical McChicken Index data.
 * Falls back to in-repo JSON if Redis is empty.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "ALL";

    const now = new Date();
    let startDate: string | undefined;

    switch (range) {
      case "1M":
        startDate = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
        break;
      case "1Y":
        startDate = new Date(now.getTime() - 365 * 86400000).toISOString().split("T")[0];
        break;
      case "5Y":
        startDate = new Date(now.getTime() - 5 * 365 * 86400000).toISOString().split("T")[0];
        break;
      case "ALL":
      default:
        startDate = undefined;
    }

    let history = await getMcChickenHistory(startDate);

    if (!history || history.length === 0) {
      try {
        const filePath = join(process.cwd(), "data/price-history.json");
        const fileData = JSON.parse(readFileSync(filePath, "utf-8"));
        history = fileData.map(
          (d: { date: string; price: number; source?: string }) => ({
            date: d.date,
            price: d.price,
            indexValue: Math.round((d.price / 1.0) * 100),
            source: d.source,
          })
        );
      } catch {
        history = [];
      }
    }

    return NextResponse.json({
      range,
      dataPoints: history.length,
      history,
    });
  } catch (error) {
    console.error("McChicken history API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch McChicken history" },
      { status: 500 }
    );
  }
}
