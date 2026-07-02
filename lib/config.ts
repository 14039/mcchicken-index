/**
 * McChicken Index v3.1 — canonical constants.
 *
 * Every number here is specified by METHODOLOGY.md; the site and pipeline
 * must read from this module so the published rules and the enforced rules
 * cannot drift apart.
 */

export const METHODOLOGY_VERSION = "3.1";

/** Unit definition: grams of sandwich the index prices (official spec at v3.1 adoption). */
export const Q_REF_GRAMS = 139.46;

/** Survey instrument (§2). Snapshot-pinned: model migrations are instrument changes. */
export const SURVEY_MODEL = "gpt-5.5-2026-04-23";
export const SURVEY_REASONING_EFFORT = "xhigh";

/** Journal writer — grounded generation, no web access, cheap effort. */
export const JOURNAL_MODEL = "gpt-5.5";
export const JOURNAL_REASONING_EFFORT = "low";

/** Publication rules (§1). */
export const METRO_PRICE_MIN_USD = 1.5;
export const METRO_PRICE_MAX_USD = 6.0;
export const METRO_HOLD_MOVE_PCT = 15; // per-metro move > this vs last verified → two-strike hold
export const METRO_HOLD_CONFIRM_PCT = 8; // next-run read within this of held value → confirmed regime shift
export const HEADLINE_SIGNOFF_PCT = 5; // headline move > this → human sign-off before publication
export const PANEL_SIZE = 12;
export const QUORUM_MIN = 9;
export const CARRY_FORWARD_MAX = 3;
export const CARRY_FORWARD_MAX_AGE_DAYS = 45;
export const STALE_PAGE_MAX_AGE_DAYS = 45;

/** Portion-spec rules (§1 rule 2). */
export const SPEC_CHANGE_THRESHOLD_GRAMS = 1.0; // |ΔQ| must exceed this…
export const SPEC_CONFIRM_TOLERANCE_GRAMS = 0.25; // …and repeat within this across two consecutive runs
export const SPEC_CROSSCHECK_ALARM_GRAMS = 0.5; // component-sum vs nutrient-median divergence alarm

/** Official portion-spec source (McDonald's machine-readable nutrition data, item 200438). */
export const MCD_ITEM_DETAILS_URL =
  "https://www.mcdonalds.com/dnaapp/itemDetails?country=US&language=en&showLiveData=true&item=200438";

/** Wage series: FRED AHETPI (BLS CES0500000008). */
export const FRED_WAGE_SERIES = "AHETPI";

/** Context CPI series: limited service meals and snacks (BLS API only, NSA). */
export const BLS_CPI_SERIES = "CUUR0000SEFV02";

export const SITE_URL = "https://www.mcchickenindex.org";
