# The McChicken Index — Methodology v3.1

*Adopted July 2026. v3.1 adds the portion-spec (shrinkflation) adjustment. Supersedes v2.0 (retail/cost-basis/margin-spread blend). This document is the canonical methodology; the site's `/methodology` page should present its contents.*

> The McChicken Index is a novel economic indicator designed to capture real-price changes in American fast food. The index is an analytical signal for investors and economic researchers that reflects the pricing pressures on food spend put on every day Americans. The McChicken Index elaborates on the Economist's Big Mac Index by designing a methodology that incorporates LLM-driven real-time research into the index itself, providing a highly accurate and flexible indicator.
> — [SOUL.md](SOUL.md)

---

## 1. The Index

**The McChicken Index is the number of minutes an average American worker must work to earn one standard McChicken.**

```
MCI_t  =  60 × (P_t × Q_ref / Q_t) / W_t        (minutes of work; published to one decimal)
```

where:

- **P_t** — the **panel price**: the median verified in-store, à-la-carte McChicken price across a fixed, published panel of 12 U.S. metros (Appendix B), collected twice weekly by the research agent (§2).
- **Q_t** — the **portion spec**: the official published serving weight of the McChicken in grams, taken from McDonald's own machine-readable nutrition data (deterministic poll, §2). **Q_ref = 139.46 g**, the official spec at v3.1 adoption, defines the **standard McChicken** — the fixed quantity of sandwich the index prices.
- **W_t** — **Average Hourly Earnings, Production & Nonsupervisory Employees, Total Private** (BLS CES; FRED: `AHETPI`), the latest month published at computation time. The wage value used is stored inside each published observation (**vintage-pinned**): published index history is never restated when BLS revises.

The Q_ref/Q_t factor is the **shrinkflation guard**: if the sandwich shrinks while the menu price stays flat, the effective price of a *standard* McChicken rises and the index correctly registers a real price increase — never a phantom affordability gain. (A portion increase symmetrically registers as relief.) While the spec is unchanged — the normal state; it moves at most every few years — the factor is exactly 1.0 and the formula reduces to `60 × P_t / W_t`.

**Reference values (July 2, 2026):** P = $2.74 (pilot survey, 10/12 metros), Q = 139.46 g (factor 1.000), W = $32.38 (June 2026) → **MCI = 5.1 minutes**. Third-party national panels ($2.81–2.86) imply 5.2–5.3 minutes; the fixed-panel level gap is disclosed in Appendix D.

**Decomposition (published with every release):**

```
Δln MCI_t  =  Δln P_t  −  Δln Q_t  −  Δln W_t
```

Each move is attributed to its price, portion, and wage components, so a reader can always see whether the index moved because menus changed, sandwiches shrank, or paychecks grew.

**Companion display (subordinate to the headline, never blended into it):**
- The nominal panel price P_t in dollars — the raw observable.
- Year-over-year % change of P_t charted against CPI *Limited service meals and snacks* YoY (`CUUR0000SEFV02`, NSA, BLS API) — the investor/nowcast context layer.

There is no base period. The index is a pure ratio of contemporaneous observables and cannot be gamed by the choice of anchor date. Q_ref is a **unit definition, not a base period**: like pricing gasoline per gallon or Nordhaus pricing light per lumen-hour, it fixes *what quantity* is priced — it never anchors the index to what anything *cost* at some moment in time.

### Publication rules

1. **Item specification (frozen):** McChicken sandwich, à la carte, standard in-store/app-pickup menu price. Value-menu membership (e.g., the Under $3 Menu) is *metadata, not an exclusion* — the posted menu price is the price. Excluded: limited-time offers, app-only coupons, combos/bundles/meal deals, and all delivery-platform prices (deterministic domain blocklist).
2. **Portion spec (shrinkflation guard):** Q_t is polled every run from McDonald's official machine-readable nutrition data (item 200438; Appendix A), computed as the median of the nutrient-density-derived weights (`100 × value / hundred_g_per_product` per nutrient row) and cross-checked against the published component-weight sum (patty + bun + lettuce + mayonnaise; the two methods currently agree to 0.02 g). A spec change registers only if |ΔQ| > 1 g (above cross-nutrient jitter) and it persists across two consecutive runs (the endpoint sits behind a ~7-day CDN cache); it then enters with human sign-off, a regime-timeline annotation, and **per-component attribution** (e.g., "patty −25%"). The spec source is official-only — third-party nutrition aggregators are blocklisted (fastfoodnutrition.org has published a stale 410 kcal since 2019). If the endpoint is unavailable, the last verified spec carries forward with a staleness badge (safe: spec changes are multi-year events). Calories and protein are archived per run as diagnostics but never enter the formula (§3).
3. **Quorum:** a new value publishes only if ≥9 of 12 metros are verified (fresh, or carried forward ≤45 days with a staleness flag, at most 3 carried). Otherwise the run records a gap — an explicit gap is better than a corrupted value.
4. **Validation bands (deterministic, non-LLM):** per-metro hard bounds $1.50–$6.00; a per-metro move >15% vs. its last verified value is held one cycle and requires confirmation on the next run (two-strike rule); a headline move >5% requires human sign-off before publication.
5. **Fail-closed citation check:** every observation must carry a source URL; a deterministic fetcher re-retrieves the page and must find the reported price in its content. Unverifiable observations are discarded — never imputed.
6. **Evidence log:** every run appends per-metro raw evidence (URL, extracted price, price-type classification, page timestamp, verification status, model ID, prompt hash) plus the raw portion-spec JSON to a public append-only log. Every published point links to its evidence.
7. **Precision:** the headline is displayed to 0.1 minute (≈ $0.05 at current wages), which dead-bands survey noise below the size of real price moves. No smoothing or interpolation: national prices move in steps every 6–9 months, and the chart should look like the honest step function it is.

---

## 2. The Instrument — LLM research agent

Price collection is performed by a scheduled LLM research agent (currently **GPT-5.5, reasoning effort `xhigh`, web-search enabled**, via the OpenAI Responses API), dispatched by CRON **twice weekly (Mon & Thu, 08:00 UTC)**. The agent is the surveyor; all math and validation are deterministic code. A pilot dispatch (2026-07-02) priced 10/10 metros in 145 s with full citations.

The agent's instructions, verbatim (`{{SURVEY_DATE}}` and the panel manifest are injected at dispatch):

```
You are the price-survey agent for the McChicken Index (mcchickenindex.org),
a U.S. economic indicator. Survey date: {{SURVEY_DATE}}.

TASK: Determine the current IN-STORE menu price of a McDonald's McChicken
sandwich (the standard sandwich alone — à la carte, not a meal/combo, not a
limited-time offer or app coupon) in each metro of the PANEL MANIFEST below.

PANEL MANIFEST (pinned primary URLs — survey these exact pages):
{{for each metro: name, primary URL, secondary source class}}

RULES:
1. SOURCES, in order of preference: (a) the pinned primary URL for each metro;
   (b) another store-level page on the same aggregator for that metro;
   (c) the McDonald's app/website store pages; (d) recent local news.
   NEVER use DoorDash/UberEats/Grubhub or any delivery platform — delivery
   menus carry 10-30% markups. Never use these known content farms:
   {{blocklist}}.
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
  "survey_date": "{{SURVEY_DATE}}",
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
}
```

**Deterministic post-processing** (code, not model): portion-spec poll (McDonald's `dnaapp/itemDetails` JSON, item 200438 — no auth, ~0.5 s; the LLM never touches the spec) → manifest/blocklist URL enforcement → fail-closed citation re-fetch → per-metro bands and two-strike holds → quorum check → median → MCI computation with pinned W and verified Q → evidence-log append → publish. Observations with `page_updated` older than 45 days are excluded as stale.

**Instrument versioning:** model ID and prompt hash are logged per observation. Any model or prompt migration requires a parallel run against the outgoing configuration with a documented no-level-shift test; detected shifts are chain-linked as instrument breaks.

---

## 3. Description & Justification

**What the number means.** MCI = 5.1 says: *five and a bit minutes of work at the average American production-worker wage buys a McChicken.* It is a time price — the real price of a good expressed in the only universal currency, human labor time. When the index rises, fast food is claiming more of an ordinary hour's pay; when it falls, wages are outrunning the menu board. That is precisely the "pricing pressure on every day Americans' food spend" the index exists to measure, in one number a reader can grasp in one sentence.

**Why the old methodology was retired.** Version 2.0 blended a retail price index with a modeled "cost basis" (60/40) and headlined the blend — a number that was neither what customers pay nor what operators spend, built from hand-assigned weights and proxy series. Worse, it anchored everything to January 2014 = $1.00, a promotional Dollar-Menu loss leader. Anchoring to a subsidized price meant the index chiefly measured *the withdrawal of a promotion* — the same flaw behind the viral "McDonald's prices doubled" claims that Snopes rated False, and exactly what the IMF CPI Manual warns against. The margin-spread statistic (+93%) claimed margin insight the data could not support. v3 deletes all of it.

**Why a time price.** Three reasons. First, it is base-free: a pure ratio of contemporaneous observables. There is no anchor date to choose, defend, or be embarrassed by — the failure mode that killed v2.0 is structurally impossible. Second, it is first-principles: price ÷ wage is the oldest real-price measure in economics, with direct lineage to UBS's *Prices & Earnings* ("minutes of work to buy a Big Mac"), Ashenfelter's "Big Macs per hour" real-wage work, and the modern time-price literature. Where the Big Mac Index converts a burger into a currency-valuation gimmick, the McChicken Index converts one into a domestic affordability signal — a genuine elaboration, not an imitation. Third, it is operationally clean: AHETPI publishes ~2 days after month-end (versus ~45 for CPI), has no October-2025 hole, extends to 1964, and covers production and nonsupervisory employees — roughly four-fifths of private employment, the "everyday Americans" of the mission statement. Wage-side confounds (recession composition spikes, CES revisions) are handled by disclosure rather than adjustment: the published decomposition makes every move attributable, and vintage-pinning makes history immutable.

**Why a fixed-panel median, collected by an LLM.** There is no "national McChicken price" to look up — ~95% of U.S. McDonald's set prices independently, and dispersion is ~2× (pilot: $2.10 Dallas to $4.28 Seattle). Asking anyone, human or model, for "the national average" is an ill-posed question that invites a made-up answer; v2.0's data problems traced to exactly that. v3 instead adopts the discipline of the MIT Billion Prices Project and BLS practice: a fixed, published outlet panel; a frozen item specification; a median (robust to any single bad read); matched-panel continuity rules; and no unverifiable observation, ever. The LLM is the survey instrument — the AI-native successor to the phone survey and the scraper, and to our knowledge the first LLM-collected production price index — but it is never the arbiter: every observation must survive deterministic citation re-fetch, bands, quorum, and an append-only public evidence log. The twice-weekly cadence is honest about its purpose: prices step every 6–9 months, so most runs are *revalidation passes* that confirm the level and catch repricing events within days — faster than the monthly, ~2-week-lagged official CPI print, which is the nowcasting value. No free, methodologically stable, high-frequency single-item QSR price series exists elsewhere; professional equivalents are paywalled B2B products and the Big Mac Index is semiannual.

**Why the shrinkflation guard normalizes by weight, not calories.** Shrinkflation is a price increase wearing a flat sticker; BLS treats it the same way v3.1 does, computing an "effective price per standard size" so a package-size cut prints as a price rise. But that machinery applies only "for items where size is reported" — restaurant portions are a documented blind spot of the CPI (BLS's shrinkflation research series covers food-at-home only; GAO's 2025 shrinkflation report never mentions restaurants), and the Big Mac Index makes no quantity adjustment at all. v3.1 closes that hole for one sentinel item, using McDonald's own published spec — whose archived history already captured a real event: a bun cut, 140.06 g → 139.46 g, between 2023 and 2025. Weight is the normalizer because it isolates portion from recipe: the official calorie count swung 360→370→350→410→400→390 across 2014–2026 (reformulations and FDA rounding) while weight drifted just −2.5%, so a calorie-normalized index would manufacture a false ~17% shrink-reversal around 2018–19 (Appendix E). Calories and protein are archived as diagnostics. The lineage is Nordhaus's labor price of light per lumen-hour and USDA's per-gram food-price measures: fix the quantity, then price it in minutes of work.

**How to read it — and how not to.** The headline is affordability, not inflation: if prices and wages both rise 5%, MCI is flat, and that is the correct reading of pressure on food spend. Inflation questions belong to the companion layer (nominal P_t YoY vs. official limited-service CPI YoY). The unit is pre-tax minutes at the average production-worker wage — level-shifting but trend-preserving, noted wherever the number appears. Menu-regime events (McValue, Jan 2025; Extra Value Meal cuts, Sep 2025; Under $3 Menu, Apr 2026) and spec changes are annotated on the chart so regime shifts are never mistaken for drift.

**Continuity commitments.** Panel and item spec are versioned; any panel change runs old and new in parallel for ≥2 source-refresh cycles and splices via the overlap ratio, logged publicly. Wage vintages are pinned; published history is never silently restated. The historical backfill (Appendix C) is computed from independently verified price and spec anchors and marked as sparse anchors, distinct from live survey data: 2.9 minutes in the 2014 Dollar-Menu era (annotated as promotional), 3.2 in 2019, a 5.5-minute peak in mid-2024, easing to 5.1 today — the index recovers the true arc of the fast-food affordability story, including the 2024 squeeze and the 2025–26 value-menu response.

*(~1000 words)*

---

## Appendix A — Data series (verified July 2, 2026)

| Series | ID / Source | Latest | Role |
|---|---|---|---|
| Avg hourly earnings, production & nonsupervisory, total private (SA) | `AHETPI` (FRED; BLS CES0500000008) | $32.38, Jun 2026 | **Denominator W_t** |
| Panel price | Twice-weekly LLM survey (§2) | $2.74, Jul 2, 2026 (pilot) | **Numerator P_t** |
| McChicken portion spec (serving weight, derived) | McDonald's official nutrition JSON: `mcdonalds.com/dnaapp/itemDetails?country=US&language=en&showLiveData=true&item=200438` (no auth; ~7-day CDN cache) | 139.46 g (390 kcal, 14 g protein), Jul 2, 2026 | **Quantity Q_t** (deterministic poll, never LLM) |
| CPI, limited service meals and snacks (NSA, Dec 1997=100) | `CUUR0000SEFV02` (BLS API only — not on FRED) | 258.549, May 2026 | Context: official fast-food CPI, YoY-only |
| CPI-U, all items (SA) | `CPIAUCSL` (FRED) | 333.979, May 2026 | Context/research (note: permanent Oct 2025 gap) |
| CPI, food away from home (SA) | `CUSR0000SEFV` (FRED) | 394.728, May 2026 | Context |
| Chicken, fresh, whole, per lb | `APU0000706111` (FRED) | $2.036, May 2026 | Context only — **not** a formula input |

## Appendix B — Panel manifest v1

Twelve metros spanning all four census regions; pinned primary URLs on menupricetracker.com (store-level McDonald's-app-sourced data, ~9,200 locations, monthly refresh). Secondary source classes per §2 rules. Pilot-verified 2026-07-02 except where noted.

| Region | Metros |
|---|---|
| Northeast | New York NY · Philadelphia PA† | 
| South | Atlanta GA · Miami FL · Dallas TX |
| Midwest | Chicago IL · Kansas City MO · Columbus OH‡ |
| West | Los Angeles CA · Seattle WA · Denver CO · Phoenix AZ† |

† Added to complete regional balance; URL verified live, first priced at panel activation. ‡ City page lacks a McChicken average; manifest pins a named store page.
Known content-farm blocklist: macmenus.us, mac-menus.com, mcd-menu.us, hackthemenu.com, menuwithprice.com, fastfoodmenuprices.com (stale single-store data with fresh SEO dates).

## Appendix C — Historical anchors and backfill policy

**Backfill policy (pre-committed):** the survey series P_t begins at instrument birth (July 2026) and is never backfilled. Verified 2026 evidence: the primary source launched ~March 26, 2026, has no published price history, and has no usable Internet Archive coverage of the panel pages — so no pre-launch panel value can be verified, and none will be published. History is shown as (a) the discrete verified anchors below, plotted as cited dots visually distinct from the survey line and never interpolated between, and (b) optional clearly-labeled context series with genuine deep history (`CUUR0000SEFV02`, `AHETPI`). Anchors use different, independently documented price instruments (disclosed per point); they are accurate for their dates but are not the panel series. An explicit gap is always preferred to a reconstructed value.

### Historical anchors (sparse; marked `historical`, not survey data)

Spec-adjusted: MCI = 60 × (P × 139.46/Q) / W.

| Date | Price (verified) | Spec Q (g) | AHETPI | MCI (min) | Note |
|---|---|---|---|---|---|
| Jan 2014 | $1.00 | 143 | $20.39 | 2.9 | Dollar Menu — promotional era |
| Jun 2019 | $1.29 | 144† | $23.48 | 3.2 | $1 $2 $3 menu era |
| Jun 2024 | $2.79 (Snopes, 150 stores) | 140.06 | $30.07 | 5.5 | Peak affordability squeeze |
| Jul 2026 | $2.74 (pilot survey) | 139.46 | $32.38 | 5.1 | Under $3 Menu era |

† Last officially published weight (2016); McDonald's published no consumer-facing gram weights 2017–2020, so 144 g is carried and flagged as interpolated.

## Appendix D — Known limitations (disclosed by design)

Fixed-panel median sits ~2–4% below third-party national means ($2.81–2.86) — the index measures *change* on a fixed panel, not a national price level. AHETPI is a mean over the currently employed (composition spikes possible in recessions, e.g. Apr 2020) and is pre-tax, excluding benefits. Single-SKU, single-chain: the McChicken is a sentinel item, not a food basket; reformulation/discontinuation triggers the pre-registered successor-item overlap-splice protocol. Primary-aggregator dependency is mitigated by the source hierarchy, fail-closed citation checks, per-source success monitoring, and dispersion-collapse canaries.

The shrinkflation guard trusts McDonald's official published spec, which FDA labeling rules oblige to reflect the actual product; a hypothetical unlabeled portion cut would be invisible to Q_t (as it is to the CPI). Anecdotal shrink claims (e.g., the Aug 2025 "smaller McChicken" Reddit wave, which official specs contradict) never move the index — the survey agent logs them as regime-watch items for human review. Ingredient-quality degradation at constant weight is out of scope: no simple, defensible metric exists, and pretending otherwise would reintroduce the pseudo-precision v3 was built to remove.

## Appendix E — Official McChicken spec history (why weight, not calories)

All values from McDonald's official publications (nutrition PDFs, product pages, and the dnaapp API), verified via the Internet Archive; full citations in the evidence log.

| Period | Official weight | Official calories | Event |
|---|---|---|---|
| 2011 – late 2014 | 143 g | 360 | Stable spec |
| Dec 2014 – 2016 | 144 g | 370 | Reformulation (sodium 800→650 mg) |
| late 2017 – 2018 | n/p† | 350 | Recipe change — calories *down*, weight ~flat |
| 2019 | n/p† | 410 → 400 (Oct) | Recipe/measurement change — calories up 17% |
| 2021 – 2023 | 140.06 g | 400 | Stable (API-derived weight) |
| ~2024/25 – present | 139.46 g | 390 | **Captured shrink event**: bun −0.57 g |

† Not published; McDonald's exposed no consumer-facing gram weights 2017–2020.

The calorie column swings ±17% on recipe and rounding changes while the weight column drifts −2.5% in twelve years — which is why Q_t is defined by weight, with calories archived only as a diagnostic.
