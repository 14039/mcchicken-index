/**
 * McChicken Index — AI agent prompts.
 *
 * AI web search is used ONLY for things with no authoritative API:
 *   • the observed national-average retail McChicken price
 *   • recent news context
 *   • the prose layer of the weekly analyst note (numbers are supplied to it)
 *
 * Economic series (CPI, wages, chicken commodity) come from FRED (lib/fred.ts),
 * not from these prompts.
 *
 * Base period: January 2014, McChicken = $1.00, index = 100.
 */

// ── Retail price (hardened against the "cheapest vs. average" error) ──

export const MCCHICKEN_PRICE_PROMPT = `Find the CURRENT national AVERAGE retail price of a McDonald's McChicken sandwich in the United States.

CRITICAL RULES — read carefully:
- Report the NATIONAL AVERAGE, never the "cheapest", "lowest", "starting at", "as low as", or a single-location price.
- Promotional / value-menu floor prices (e.g. "$1.79 at some locations") are the MINIMUM, not the average. Do not report the minimum as the average.
- The value must be a current (within ~60 days) U.S. national average.

Primary source: menupricetracker.com — it aggregates thousands of locations and publishes an explicit national average. Cross-check against McDonald's app pricing, other fast-food price aggregators, and recent news.

Return ONLY this JSON object, no prose:
{
  "nationalAverage": <number>,
  "priceRange": {"min": <number>, "max": <number>},
  "regionalPrices": {
    "northeast": <number or null>,
    "south": <number or null>,
    "midwest": <number or null>,
    "west": <number or null>
  },
  "sources": [
    {"name": "<source>", "url": "<url>", "reportedPrice": <number>, "date": "<YYYY-MM-DD>"}
  ],
  "dataDate": "<YYYY-MM-DD>"
}

SANITY CHECK before answering: a U.S. national-average McChicken in the mid-2020s is roughly $2.50–$3.50. If your "nationalAverage" equals "priceRange.min", you have almost certainly grabbed the cheapest price — go back and report the AVERAGE instead.`;

// ── News ─────────────────────────────────────────────────────────

export const MCCHICKEN_NEWS_PROMPT = `Search for recent U.S. news (past 30 days) on McDonald's pricing, fast-food value menus, food inflation, chicken/poultry commodity prices, or fast-food labor costs.

Return ONLY a JSON array, no prose:
[
  {"title": "<headline>", "url": "<article url>", "source": "<publication>", "date": "<YYYY-MM-DD>", "summary": "<1-2 sentence summary>"}
]

Include 3-5 of the most relevant, recent, real stories with working URLs.`;

// ── Weekly analyst note (grounded: numbers are supplied, not invented) ──

export interface AnalystNoteFacts {
  date: string;
  headlineIndex: number;
  headlineWoWPct: number | null;
  retailIndex: number;
  retailPrice: number;
  costBasisIndex: number | null;
  marginSpreadPoints: number | null;
  marginSpreadPct: number | null;
  confidence: string;
  newsTitles: string[];
}

export function analystNotePrompt(f: AnalystNoteFacts): string {
  const wow =
    f.headlineWoWPct === null
      ? "no prior week to compare"
      : `${f.headlineWoWPct >= 0 ? "+" : ""}${f.headlineWoWPct}% week-over-week`;
  const spread =
    f.marginSpreadPoints === null
      ? "cost basis unavailable this week"
      : `${f.marginSpreadPoints >= 0 ? "+" : ""}${f.marginSpreadPoints} index points (retail vs. cost basis)`;

  return `You are the analyst for the McChicken Index, an inflation indicator for financial researchers and investors. Write this week's brief note.

USE ONLY THESE FIGURES. Do not invent or estimate any number not listed here:
- Date: ${f.date}
- Headline index: ${f.headlineIndex} (${wow})
- Retail index: ${f.retailIndex} (observed price $${f.retailPrice.toFixed(2)})
- Cost-basis index: ${f.costBasisIndex ?? "unavailable"}
- Margin spread: ${spread}
- Data confidence: ${f.confidence}
- Relevant news headlines this week: ${f.newsTitles.length ? f.newsTitles.map((t) => `"${t}"`).join("; ") : "none retrieved"}

Write 2-3 sentences of neutral, professional analysis: what moved the index, whether retail price or input costs drove it, and what the margin spread implies about McDonald's pricing posture (expanding margin vs. absorbing cost). No hype, no superlatives, no fabricated statistics. If a number is "unavailable", say so plainly.

Return ONLY this JSON, no prose:
{"title": "<= 70 chars, factual headline>", "body": "<= 600 chars analysis>", "marginRead": "<= 120 chars, one-line margin interpretation>"}`;
}

// ── Historical seeding prompts (used only by scripts/seed; kept for reference) ──

export function mcchickenHistoricalPrompt(startYear: number, endYear: number): string {
  return `Research the price of a McDonald's McChicken sandwich in the United States from ${startYear} to ${endYear}.

CRITICAL: Only report prices you can verify from actual sources. Do NOT interpolate or estimate between known data points. If you can't find data for a period, omit it.

Known reference points to validate against:
- 2014: $1.00 (Dollar Menu — verified)
- 2019: ~$1.49 (FinanceBuzz)
- 2024: ~$2.79–$2.99 (Snopes 150-store sample / VisualCapitalist)

Return ONLY a JSON array (no prose). Each element:
{"date": "<YYYY or YYYY-MM>", "price": <number>, "source": "<exact source>", "sourceUrl": "<url>", "confidence": "verified|estimated", "context": "<era>"}

Only include points with actual source evidence.`;
}

export const MCCHICKEN_BASE_PERIOD_PROMPT = `Establish January 2014 as the McChicken Index base period with a verified $1.00 price.

Search McDonald's corporate releases about the Dollar Menu / Dollar Menu & More (2013-2014) and reputable analyses confirming the McChicken at $1.00 in 2014.

Return ONLY a JSON object (no prose):
{"basePrice": 1.00, "basePeriod": "2014-01", "confirmed": true, "evidence": [{"type": "<corporate_announcement|news_article|analysis|archive|wikipedia>", "title": "<title>", "url": "<url>", "date": "<date>", "excerpt": "<quote>", "reliability": "high|medium|low"}]}`;
