/**
 * Survey prompt builder — the agent's instructions from METHODOLOGY.md §2,
 * verbatim, with {{SURVEY_DATE}}, the panel manifest, and the blocklist
 * injected at dispatch. Any wording change here is an instrument change and
 * must follow the parallel-run migration protocol.
 */

import type { PanelManifest } from "./types";

export function buildSurveyPrompt(manifest: PanelManifest, surveyDate: string): string {
  const manifestLines = manifest.metros
    .map(
      (m) =>
        `- ${m.metro}: primary URL ${m.primaryUrl} (secondary: another store-level page on ${manifest.primaryAggregator} for this metro)`
    )
    .join("\n");
  const blocklist = manifest.contentFarmBlocklist.join(", ");

  return `You are the price-survey agent for the McChicken Index (mcchickenindex.org),
a U.S. economic indicator. Survey date: ${surveyDate}.

TASK: Determine the current IN-STORE menu price of a McDonald's McChicken
sandwich (the standard sandwich alone — à la carte, not a meal/combo, not a
limited-time offer or app coupon) in each metro of the PANEL MANIFEST below.

PANEL MANIFEST (pinned primary URLs — survey these exact pages):
${manifestLines}

RULES:
1. SOURCES, in order of preference: (a) the pinned primary URL for each metro;
   (b) another store-level page on the same aggregator for that metro;
   (c) the McDonald's app/website store pages; (d) recent local news.
   NEVER use DoorDash/UberEats/Grubhub or any delivery platform — delivery
   menus carry 10-30% markups. Never use these known content farms:
   ${blocklist}.
2. For every observation report: the price, the EXACT URL you consulted, the
   page's own last-updated date if displayed, and your fetch date. Classify
   the price type: "standard_menu" | "value_menu_listed" | "promo_suspected".
   A posted everyday value-menu price (e.g. Under $3 Menu) IS the menu price —
   report it as value_menu_listed, do not skip it and do not report bundle or
   coupon prices.
3. If you cannot find a credible CURRENT price for a metro, return null for
   that metro. Never guess, never use a price you remember from training data,
   never substitute a different city or a national average for a metro.
4. Plausibility: a single-store McChicken in mid-2026 is roughly $2.00-$4.50.
   Report prices outside this band anyway, but flag them in notes.
5. Also report, separately: any national-average estimates you encounter
   (with URLs), and any MENU-REGIME EVENTS from the past 14 days (national
   value-menu launches/withdrawals, corporate pricing announcements, and any
   reports — including credible anecdotal waves — of McChicken reformulation
   or portion/size changes; these are flagged for review, never used to
   change the index directly).

Return ONLY this JSON object, no prose:
{
  "survey_date": "${surveyDate}",
  "observations": [
    {"metro": "<city, st>", "price": <number|null>, "source_url": "<url>",
     "source_type": "pinned_aggregator|aggregator|app|news",
     "price_type": "standard_menu|value_menu_listed|promo_suspected",
     "page_updated": "<date|null>", "as_of": "<YYYY-MM-DD>", "notes": "<brief>"}
  ],
  "national_estimates": [
    {"estimate": <number>, "source_url": "<url>", "as_of": "<date>",
     "description": "<what this is>"}
  ],
  "regime_events": [
    {"date": "<date>", "event": "<description>", "source_url": "<url>"}
  ],
  "quality_notes": "<2-3 sentences: freshness, reliability, hardest metros>"
}`;
}
