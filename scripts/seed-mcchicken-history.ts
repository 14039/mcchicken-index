/**
 * McChicken Index Historical Data Seeding Script
 *
 * Uses OpenAI web search to compile historical McChicken prices and
 * base period evidence. Runs multiple AI calls for different eras.
 * Saves all raw outputs + parsed data to repo files.
 *
 * Run: npx tsx scripts/seed-mcchicken-history.ts
 */

import OpenAI from "openai";
import { writeFileSync } from "fs";
import {
  mcchickenHistoricalPrompt,
  MCCHICKEN_BASE_PERIOD_PROMPT,
  MCCHICKEN_COMPONENTS_PROMPT,
  MCCHICKEN_PRICE_PROMPT,
} from "../lib/prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface McChickenPricePoint {
  date: string;
  price: number;
  source: string;
  sourceUrl?: string;
  confidence: string;
  context?: string;
}

interface ResearchLogEntry {
  timestamp: string;
  model: string;
  task: string;
  prompt: string;
  rawResponse: string;
  parsedData: unknown;
  citations: Array<{ url: string; title: string }>;
}

function extractJSON<T>(text: string): T | null {
  try { return JSON.parse(text) as T; } catch {}
  const cb = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (cb) { try { return JSON.parse(cb[1].trim()) as T; } catch {} }
  const jm = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jm) { try { return JSON.parse(jm[1]) as T; } catch {} }
  return null;
}

function extractCitations(response: OpenAI.Responses.Response): Array<{ url: string; title: string }> {
  const citations: Array<{ url: string; title: string }> = [];
  if (response.output && Array.isArray(response.output)) {
    for (const item of response.output) {
      if (item.type === "message" && item.content) {
        for (const block of item.content) {
          if (block.type === "output_text" && block.annotations) {
            for (const ann of block.annotations) {
              if (ann.type === "url_citation") {
                citations.push({ url: ann.url, title: ann.title || "" });
              }
            }
          }
        }
      }
    }
  }
  return citations;
}

async function runResearch(
  task: string,
  prompt: string,
  model: string = "gpt-4.1"
): Promise<ResearchLogEntry> {
  console.log(`\n🔍 ${task} (${model})...`);

  const response = await openai.responses.create({
    model,
    tools: [{ type: "web_search_preview" as const }],
    input: prompt,
  });

  const text = response.output_text || "";
  const parsedData = extractJSON(text);
  const citations = extractCitations(response);

  console.log(`  Response: ${text.length} chars, JSON: ${parsedData ? "✅" : "❌"}, Citations: ${citations.length}`);

  return {
    timestamp: new Date().toISOString(),
    model,
    task,
    prompt,
    rawResponse: text,
    parsedData,
    citations,
  };
}

async function main() {
  console.log("🍔 McChicken Index Historical Data Seeding\n");

  const researchLog: ResearchLogEntry[] = [];

  const baseEvidence = await runResearch(
    "Base Period Evidence ($1.00 in 2014)",
    MCCHICKEN_BASE_PERIOD_PROMPT,
    "gpt-4.1"
  );
  researchLog.push(baseEvidence);

  if (baseEvidence.parsedData) {
    writeFileSync("data/base-period-evidence.json", JSON.stringify(baseEvidence.parsedData, null, 2));
    console.log("  📁 Saved base period evidence");
  }

  const eras = [
    { task: "Dollar Menu Era (2014-2017)", start: 2014, end: 2017 },
    { task: "Value Menu Transition (2017-2020)", start: 2017, end: 2020 },
    { task: "Inflation Era (2020-2024)", start: 2020, end: 2024 },
    { task: "Current Era (2024-2026)", start: 2024, end: 2026 },
  ];

  for (const { task, start, end } of eras) {
    const entry = await runResearch(task, mcchickenHistoricalPrompt(start, end), "gpt-4.1");
    researchLog.push(entry);
  }

  const crossVal = await runResearch(
    "Cross-Validation Full Range (2014-2026)",
    mcchickenHistoricalPrompt(2014, 2026),
    "gpt-4o"
  );
  researchLog.push(crossVal);

  const currentPrice = await runResearch(
    "Current Price (April 2026)",
    MCCHICKEN_PRICE_PROMPT,
    "gpt-4o"
  );
  researchLog.push(currentPrice);

  const components = await runResearch(
    "Economic Components",
    MCCHICKEN_COMPONENTS_PROMPT,
    "gpt-4o"
  );
  researchLog.push(components);

  writeFileSync("data/research-log.json", JSON.stringify(researchLog, null, 2));
  console.log("\n📁 Saved research log to data/research-log.json");

  const allPrices = new Map<string, McChickenPricePoint>();
  for (const entry of researchLog) {
    if (entry.parsedData && Array.isArray(entry.parsedData)) {
      for (const point of entry.parsedData as McChickenPricePoint[]) {
        if (point.date && point.price && point.price > 0 && point.price < 10) {
          const existing = allPrices.get(point.date);
          if (!existing || point.confidence === "verified") {
            allPrices.set(point.date, point);
          }
        }
      }
    }
  }

  const mergedPrices = Array.from(allPrices.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  writeFileSync("data/price-history.json", JSON.stringify(mergedPrices, null, 2));
  console.log(`📁 Saved ${mergedPrices.length} merged price points to data/price-history.json`);

  const methodology = {
    version: "1.0",
    lastUpdated: new Date().toISOString(),
    indexName: "McChicken Index™",
    definition: "The McChicken Index tracks the average price of a McDonald's McChicken sandwich in the United States as an economic indicator for food price inflation, labor costs, and consumer purchasing power.",
    basePeriod: {
      date: "2014-01",
      price: 1.00,
      indexValue: 100,
      justification: "The McChicken was priced at $1.00 as part of McDonald's Dollar Menu, which featured the McChicken at this price from its inception in 2002 through its restructuring into 'Dollar Menu & More' in November 2013, where the McChicken remained at $1.00.",
      evidence: baseEvidence.parsedData,
    },
    calculation: {
      formula: "Index Value = (National Average McChicken Price / $1.00) × 100",
      example: "If the national average McChicken price is $3.49, the index value is 349 (a 249% increase from the base period).",
    },
    dataCollection: {
      frequency: "Weekly (Monday)",
      method: "AI-powered web search aggregation across multiple price tracking sources",
      sources: [
        "MenuPriceTracker.com (9,000+ McDonald's locations)",
        "McDonald's official app/website pricing",
        "Fast food price aggregator sites",
        "News articles reporting McDonald's prices",
      ],
      processing: [
        "Collect price reports from available sources",
        "Filter outliers (prices below $0.50 or above $8.00)",
        "Compute population-weighted average by region (Northeast, South, Midwest, West)",
        "Report: median, mean, min, max across sources",
      ],
    },
    constituentComponents: {
      description: "These economic indicators provide context for price movements but are not used in the index calculation itself.",
      components: [
        {
          name: "CPI for Food Away From Home",
          series: "CUUR0000SEFV",
          source: "Bureau of Labor Statistics",
          description: "Consumer Price Index for food purchased at restaurants and other food-away-from-home establishments",
        },
        {
          name: "Chicken Wholesale Price",
          source: "USDA",
          description: "National composite broiler chicken wholesale price (cents per pound)",
        },
        {
          name: "Food Service Worker Wages",
          series: "NAICS 722",
          source: "Bureau of Labor Statistics",
          description: "Average hourly earnings for accommodation and food services workers",
        },
        {
          name: "Federal Minimum Wage",
          source: "US Department of Labor",
          description: "Federal minimum wage rate, which sets the floor for fast food worker compensation",
        },
      ],
    },
    api: {
      endpoint: "GET /api/mcchicken",
      parameters: {
        range: "Optional. One of: 1M, 3M, 6M, 1Y, 3Y, 5Y, ALL. Default: current value only.",
      },
      response: {
        indexValue: "Current index value (base 100 = $1.00 in 2014)",
        price: "Current national average McChicken price in USD",
        change: "Change from previous period",
        changePercent: "Percentage change from previous period",
        lastUpdated: "ISO timestamp of last data update",
        methodologyVersion: "Version of the methodology used",
      },
    },
  };

  writeFileSync("data/methodology.json", JSON.stringify(methodology, null, 2));
  console.log("📁 Saved methodology to data/methodology.json");

  console.log("\n📊 McChicken Price History:");
  for (const p of mergedPrices) {
    const indexValue = Math.round((p.price / 1.00) * 100);
    console.log(`  ${p.date}: $${p.price.toFixed(2)} (Index: ${indexValue}) [${p.confidence}] — ${p.source}`);
  }

  console.log("\n✅ McChicken historical data seeding complete!");
}

main().catch(console.error);
