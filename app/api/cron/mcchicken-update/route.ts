import { NextResponse } from "next/server";
import {
  dispatchStructuredSearch,
  dispatchStructuredCompletion,
} from "@/lib/ai-agent";
import { getAllIndexedSeries } from "@/lib/fred";
import { validateRetailPrice } from "@/lib/index-model";
import { buildSnapshot } from "@/lib/build-snapshot";
import {
  MCCHICKEN_PRICE_PROMPT,
  MCCHICKEN_NEWS_PROMPT,
  analystNotePrompt,
} from "@/lib/prompts";
import {
  setMcChickenCurrent,
  setMcChickenNews,
  upsertMcChickenSeriesPoint,
  getMcChickenSeries,
  getQuarantine,
  setQuarantine,
  prependJournalEntry,
  appendRunLog,
  type NewsItem,
} from "@/lib/redis";

export const maxDuration = 120;

interface PriceData {
  nationalAverage: number;
  priceRange: { min: number; max: number } | null;
  sources?: Array<{ name: string; url: string; reportedPrice: number; date: string }>;
  dataDate?: string;
}
type NewsData = Array<{ title: string; url: string; source: string; date: string; summary: string }>;
interface NoteData { title: string; body: string; marginRead: string }

/**
 * GET /api/cron/mcchicken-update — weekly (Mondays 08:00 UTC).
 *
 * Observed retail price + news via AI web search; economic cost basis via FRED.
 * Computes the blended index + real week-over-week movement, validates the
 * retail read (quarantining bad data so it is never published), then writes the
 * snapshot, series point, news, a weekly analyst note, and a run-log entry.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    const [priceRes, newsRes, fred] = await Promise.all([
      dispatchStructuredSearch<PriceData>(MCCHICKEN_PRICE_PROMPT, "gpt-4o"),
      dispatchStructuredSearch<NewsData>(MCCHICKEN_NEWS_PROMPT, "gpt-4o"),
      getAllIndexedSeries(),
    ]);

    // News is independently truthful — refresh regardless of price outcome.
    const newsItems: NewsItem[] = (newsRes?.data ?? []).map((n) => ({
      title: n.title,
      url: n.url,
      source: n.source,
      date: n.date,
      summary: n.summary,
    }));
    if (newsItems.length) await setMcChickenNews(newsItems);

    if (!priceRes?.data || typeof priceRes.data.nationalAverage !== "number") {
      await appendRunLog({
        timestamp: new Date().toISOString(),
        status: "error",
        reason: "AI returned no parseable retail price",
      });
      return NextResponse.json(
        { error: "Failed to extract retail price from AI response" },
        { status: 502 }
      );
    }

    const price = priceRes.data.nationalAverage;
    const range = priceRes.data.priceRange ?? null;

    // Prior good (observed) point, for WoW + validation baseline.
    const series = await getMcChickenSeries();
    const prior = series
      .filter((p) => p.observed && p.date < today)
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null;

    const quarantine = await getQuarantine();
    const verdict = validateRetailPrice({
      price,
      range,
      prevGoodPrice: prior?.retailPrice ?? null,
      quarantinedPrice: quarantine?.price ?? null,
    });

    // Quarantine path — withhold from the index, never publish bad data.
    if (!verdict.ok) {
      await setQuarantine({ price, range, timestamp: new Date().toISOString(), reason: verdict.reason });
      await prependJournalEntry({
        date: today,
        title: "Retail reading flagged for review",
        body: `This week's retail read ($${price.toFixed(2)}) was withheld from the index: ${verdict.reason}. The published index is unchanged until a clean reading is confirmed.`,
        headlineIndex: prior?.headlineIndex ?? 0,
        headlineWoWPct: null,
        marginRead: "No update — data integrity hold.",
      });
      await appendRunLog({
        timestamp: new Date().toISOString(),
        status: "quarantined",
        reason: verdict.reason,
        retailPrice: price,
        retailSources: priceRes.data.sources?.map((s) => s.name),
      });
      return NextResponse.json(
        { success: false, quarantined: true, reason: verdict.reason, price },
        { status: 200 }
      );
    }

    // Compute + persist (single shared compute path).
    const { current, point } = buildSnapshot({
      today,
      retailPrice: price,
      range,
      dataDate: priceRes.data.dataDate ?? today,
      retailSources: priceRes.data.sources?.map((s) => s.name) ?? [],
      fred,
      prior,
      source: "Weekly AI + FRED update",
    });

    await setMcChickenCurrent(current);
    await upsertMcChickenSeriesPoint(point);
    await setQuarantine(null);

    // Weekly analyst note — grounded only in the computed numbers + news titles.
    try {
      const note = await dispatchStructuredCompletion<NoteData>(
        analystNotePrompt({
          date: today,
          headlineIndex: current.headlineIndex,
          headlineWoWPct: current.changes.headlineWoWPct,
          retailIndex: current.retailIndex,
          retailPrice: price,
          costBasisIndex: current.costBasisIndex,
          marginSpreadPoints: current.marginSpreadPoints,
          marginSpreadPct: current.marginSpreadPct,
          confidence: current.confidence,
          newsTitles: newsItems.slice(0, 3).map((n) => n.title),
        })
      );
      if (note?.data?.body) {
        await prependJournalEntry({
          date: today,
          title: note.data.title || `McChicken Index: ${current.headlineIndex}`,
          body: note.data.body,
          headlineIndex: current.headlineIndex,
          headlineWoWPct: current.changes.headlineWoWPct,
          marginRead: note.data.marginRead || "",
        });
      }
    } catch (e) {
      console.error("Analyst note generation failed (non-fatal):", e);
    }

    await appendRunLog({
      timestamp: new Date().toISOString(),
      status: "published",
      retailPrice: price,
      headlineIndex: current.headlineIndex,
      retailSources: current.retailSources,
      fredCoverage: current.costCoverage,
    });

    return NextResponse.json({
      success: true,
      headlineIndex: current.headlineIndex,
      retailIndex: current.retailIndex,
      costBasisIndex: current.costBasisIndex,
      marginSpread: current.marginSpreadPoints,
      method: current.headlineMethod,
      confidence: current.confidence,
      action: verdict.action,
      timestamp: current.lastUpdated,
    });
  } catch (error) {
    console.error("McChicken cron update failed:", error);
    await appendRunLog({
      timestamp: new Date().toISOString(),
      status: "error",
      reason: String(error),
    });
    return NextResponse.json(
      { error: "McChicken update failed", details: String(error) },
      { status: 500 }
    );
  }
}
