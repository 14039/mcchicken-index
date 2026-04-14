import { NextResponse } from "next/server";
import {
  getMcChickenCurrent,
  getMcChickenHistory,
} from "@/lib/redis";

/**
 * GET /api/mcchicken
 *
 * Public McChicken Index™ API.
 * Returns the current index value, price, and optional historical data.
 *
 * Query Parameters:
 *   range — Optional. One of: 1M, 3M, 6M, 1Y, 3Y, 5Y, ALL
 *           If provided, includes historical data in the response.
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

    const current = await getMcChickenCurrent();

    const response: Record<string, unknown> = {
      index: {
        value: current?.indexValue || 0,
        price: current?.price || 0,
        change: current?.change || 0,
        changePercent: current?.changePercent || 0,
        basePeriod: "2014-01",
        basePrice: 1.0,
        lastUpdated: current?.lastUpdated || null,
        methodologyVersion: current?.methodologyVersion || "1.0",
      },
      api: {
        version: "1.0",
        documentation: "https://mcchickenindex.org/methodology",
      },
    };

    if (range) {
      const now = new Date();
      let startDate: string | undefined;

      switch (range) {
        case "1M":
          startDate = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
          break;
        case "3M":
          startDate = new Date(now.getTime() - 90 * 86400000).toISOString().split("T")[0];
          break;
        case "6M":
          startDate = new Date(now.getTime() - 180 * 86400000).toISOString().split("T")[0];
          break;
        case "1Y":
          startDate = new Date(now.getTime() - 365 * 86400000).toISOString().split("T")[0];
          break;
        case "3Y":
          startDate = new Date(now.getTime() - 3 * 365 * 86400000).toISOString().split("T")[0];
          break;
        case "5Y":
          startDate = new Date(now.getTime() - 5 * 365 * 86400000).toISOString().split("T")[0];
          break;
        case "ALL":
          startDate = undefined;
          break;
      }

      const history = await getMcChickenHistory(startDate);
      response.history = history;
    }

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error("McChicken public API error:", error);
    return NextResponse.json(
      {
        error: "Service temporarily unavailable",
        api: { version: "1.0", documentation: "https://mcchickenindex.org/methodology" },
      },
      { status: 500, headers }
    );
  }
}
