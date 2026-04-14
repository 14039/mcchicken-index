/**
 * McChicken Index AI Agent Prompts
 *
 * Used by the McChicken cron job and historical seeding scripts.
 * The McChicken Index™ tracks the price of a McDonald's McChicken
 * sandwich as an economic indicator, similar to The Economist's Big Mac Index.
 *
 * Base Period: January 2014, Base Value = 100 (price = $1.00)
 */

export const MCCHICKEN_PRICE_PROMPT = `Search for the current average price of a McDonald's McChicken sandwich in the United States.

Check these sources:
1. menupricetracker.com — the most comprehensive source with 9,000+ locations
2. McDonald's official website or app pricing
3. Recent news articles about McDonald's menu prices
4. Other fast food price aggregator sites (mcdordermenu.com, fastfoodmenuprices.com, etc.)

I need:
- National average price
- Regional variation (Northeast, South, Midwest, West) if available
- Price range (min and max observed)

Return ONLY a JSON object in this exact format, no other text:
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
    {"name": "<source name>", "url": "<url>", "reportedPrice": <number>, "date": "<YYYY-MM-DD>"}
  ],
  "dataDate": "<YYYY-MM-DD>"
}`;

export const MCCHICKEN_NEWS_PROMPT = `Search for recent news related to McDonald's pricing, fast food inflation, or food costs in the United States from the past 30 days.

Focus on:
- McDonald's menu price changes or announcements
- Fast food industry pricing trends
- Food inflation data or CPI reports
- Chicken wholesale price changes
- Minimum wage changes affecting fast food

Return ONLY a JSON array in this exact format, no other text:
[
  {
    "title": "<headline>",
    "url": "<article url>",
    "source": "<publication name>",
    "date": "<YYYY-MM-DD>",
    "summary": "<1-2 sentence summary>"
  }
]

Include 3-5 of the most relevant stories.`;

export function mcchickenHistoricalPrompt(startYear: number, endYear: number): string {
  return `Research the price of a McDonald's McChicken sandwich in the United States from ${startYear} to ${endYear}.

CRITICAL: Only report prices you can verify from actual sources. Do NOT interpolate or estimate prices between known data points. If you can't find data for a specific period, omit it.

Known reference points to validate against:
- 2014: $1.00 (McDonald's Dollar Menu — verified via corporate announcement)
- 2019: ~$1.49 (FinanceBuzz data, $1 $2 $3 Dollar Menu era)
- 2024: ~$3.19 (FinanceBuzz 2024 analysis)

Search these sources:
1. FinanceBuzz McDonald's menu inflation analysis
2. VisualCapitalist McDonald's price charts
3. MenuPriceTracker.com historical data
4. News articles about McChicken or Dollar Menu price changes
5. McDonald's corporate announcements about menu restructuring

Return ONLY a JSON array (no prose before or after). Each element:
{
  "date": "<YYYY or YYYY-MM>",
  "price": <number>,
  "source": "<exact source name>",
  "sourceUrl": "<url>",
  "confidence": "verified|estimated",
  "context": "<Dollar Menu era, $1 $2 $3 Menu, etc.>"
}

Only include data points with actual source evidence. Quality over quantity.`;
}

export const MCCHICKEN_BASE_PERIOD_PROMPT = `I am building the "McChicken Index" — a novel economic indicator tracking the price of a McDonald's McChicken sandwich, similar to The Economist's Big Mac Index.

I need to establish January 2014 as the base period with a verified price of $1.00.

Search extensively for:
1. McDonald's corporate press releases about the Dollar Menu from 2013-2014
2. The November 2013 "Dollar Menu & More" launch — McChicken remained at $1.00
3. News articles confirming the McChicken was $1.00 in 2014
4. Wikipedia articles about McDonald's Dollar Menu history
5. FinanceBuzz or VisualCapitalist analyses citing 2014 McChicken at $1.00
6. Any archived McDonald's menus from early 2014

Return ONLY a JSON object (no prose):
{
  "basePrice": 1.00,
  "basePeriod": "2014-01",
  "confirmed": true,
  "evidence": [
    {
      "type": "corporate_announcement|news_article|analysis|archive|wikipedia",
      "title": "<title>",
      "url": "<url>",
      "date": "<date>",
      "excerpt": "<key quote or finding>",
      "reliability": "high|medium|low"
    }
  ],
  "dollarMenuTimeline": {
    "started": "<year Dollar Menu began>",
    "renamedTo": "<new name>",
    "renamedDate": "<date>",
    "ended": "<year fully retired>",
    "notes": "<relevant context>"
  }
}`;

export const MCCHICKEN_COMPONENTS_PROMPT = `Search for the latest US economic data relevant to fast food pricing:

1. BLS Consumer Price Index for "Food Away From Home" (Series CUUR0000SEFV) — latest value
2. USDA chicken wholesale price (cents per pound, broiler composite)
3. BLS average hourly earnings for food service workers (NAICS 722)
4. Current federal minimum wage and average state minimum wage

Return ONLY a JSON object:
{
  "cpiFood": <number — CPI index value>,
  "cpiDate": "<YYYY-MM>",
  "chickenWholesale": <number — cents per pound>,
  "chickenDate": "<YYYY-MM>",
  "avgFoodServiceWage": <number — dollars per hour>,
  "wageDate": "<YYYY-MM>",
  "federalMinWage": <number>,
  "avgStateMinWage": <number or null>,
  "sources": ["<url1>", "<url2>"]
}`;
