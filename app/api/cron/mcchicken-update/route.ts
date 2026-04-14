import { NextResponse } from "next/server";
import { dispatchStructuredSearch } from "@/lib/ai-agent";
import {
  setMcChickenCurrent,
  setMcChickenNews,
  appendMcChickenHistory,
  type McChickenCurrentData,
  type NewsItem,
} from "@/lib/redis";
import {
  MCCHICKEN_PRICE_PROMPT,
  MCCHICKEN_NEWS_PROMPT,
  MCCHICKEN_COMPONENTS_PROMPT,
} from "@/lib/prompts";

const BASE_PRICE = 1.0; // 2014 base price

/**
 * GET /api/cron/mcchicken-update
 *
 * Vercel cron job: runs weekly on Mondays at 8 AM UTC.
 * Dispatches AI for current McChicken prices, components, and news.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const priceData = await dispatchStructuredSearch<{
      nationalAverage: number;
      priceRange: { min: number; max: number };
      regionalPrices: {
        northeast: number | null;
        south: number | null;
        midwest: number | null;
        west: number | null;
      };
      sources: Array<{
        name: string;
        url: string;
        reportedPrice: number;
        date: string;
      }>;
      dataDate: string;
    }>(MCCHICKEN_PRICE_PROMPT, "gpt-4o");

    const componentsData = await dispatchStructuredSearch<{
      cpiFood: number;
      chickenWholesale: number;
      avgFoodServiceWage: number;
      federalMinWage: number;
      avgStateMinWage: number | null;
    }>(MCCHICKEN_COMPONENTS_PROMPT, "gpt-4o");

    const newsData = await dispatchStructuredSearch<
      Array<{
        title: string;
        url: string;
        source: string;
        date: string;
        summary: string;
      }>
    >(MCCHICKEN_NEWS_PROMPT, "gpt-4o");

    if (!priceData?.data) {
      return NextResponse.json(
        { error: "Failed to extract price data from AI response" },
        { status: 500 }
      );
    }

    const price = priceData.data.nationalAverage;

    if (price < 0.5 || price > 10) {
      return NextResponse.json(
        { error: `Suspicious price: $${price}. Expected $0.50-$10.00.` },
        { status: 500 }
      );
    }

    const indexValue = Math.round((price / BASE_PRICE) * 100);

    const currentData: McChickenCurrentData = {
      indexValue,
      price,
      previousPrice: price,
      change: 0,
      changePercent: 0,
      regionalPrices: priceData.data.regionalPrices || {
        northeast: null,
        south: null,
        midwest: null,
        west: null,
      },
      components: componentsData?.data || {
        cpiFood: 0,
        chickenWholesale: 0,
        avgFoodServiceWage: 0,
        federalMinWage: 7.25,
      },
      lastUpdated: new Date().toISOString(),
      methodologyVersion: "1.0",
      source: "AI web search aggregation",
      dataSources: priceData.data.sources?.map((s) => s.name) || [],
    };

    await setMcChickenCurrent(currentData);

    const today = new Date().toISOString().split("T")[0];
    await appendMcChickenHistory({
      date: today,
      price,
      indexValue,
      source: "Weekly AI update",
    });

    if (newsData?.data) {
      const newsItems: NewsItem[] = newsData.data.map((n) => ({
        title: n.title,
        url: n.url,
        source: n.source,
        date: n.date,
        summary: n.summary,
      }));
      await setMcChickenNews(newsItems);
    }

    return NextResponse.json({
      success: true,
      price,
      indexValue,
      timestamp: currentData.lastUpdated,
    });
  } catch (error) {
    console.error("McChicken cron update failed:", error);
    return NextResponse.json(
      { error: "McChicken update failed", details: String(error) },
      { status: 500 }
    );
  }
}
