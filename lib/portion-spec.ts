/**
 * Portion spec (shrinkflation guard) — deterministic poll of McDonald's
 * official machine-readable nutrition data for the McChicken (item 200438).
 * The LLM never touches this path.
 *
 * Q_t primary derivation: sum of official per-component weights — each
 * component's `quantity` field is its weight in units of 100 g (patty
 * 0.6106 → 61.06 g). This matches Q_ref = 139.46 g exactly at adoption and
 * natively supports per-component attribution of spec changes.
 *
 * Cross-check: median of nutrient-density-derived weights over all item
 * nutrient rows (100 × value / hundred_g_per_product). The two methods
 * agreed to 0.02 g at adoption (2026-07-02); divergence beyond
 * SPEC_CROSSCHECK_ALARM_GRAMS marks the reading unusable (fail closed to
 * carry-forward — never a guessed quantity).
 */

import { MCD_ITEM_DETAILS_URL, SPEC_CROSSCHECK_ALARM_GRAMS } from "./config";
import type { PortionSpecReading, SpecComponent } from "./types";

interface NutrientRow {
  name?: string;
  value?: number | string;
  hundred_g_per_product?: number | string;
  uom?: string;
}

interface McdItem {
  item_name?: string;
  nutrient_facts?: { nutrient?: NutrientRow[] };
  components?: {
    component?: Array<{
      product_name?: string;
      quantity?: string | number;
      nutrient_facts?: { nutrient?: NutrientRow[] };
    }>;
  };
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function nutrientValue(rows: NutrientRow[], name: string): number | null {
  const row = rows.find((r) => r.name === name);
  const v = Number(row?.value);
  return isFinite(v) ? v : null;
}

export interface SpecFetchResult {
  reading: PortionSpecReading;
  /** Compact excerpt of the official JSON archived into the evidence log. */
  rawExcerpt: unknown;
}

export async function fetchPortionSpec(): Promise<SpecFetchResult> {
  const res = await fetch(MCD_ITEM_DETAILS_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`dnaapp itemDetails ${res.status}`);
  const body = (await res.json()) as { item?: McdItem };
  const item = body.item;
  if (!item) throw new Error("dnaapp response missing item");

  // Primary: component-quantity sum (hectograms → grams).
  const componentsRaw = item.components?.component ?? [];
  const components: SpecComponent[] = [];
  for (const c of componentsRaw) {
    const q = Number(c.quantity);
    if (!c.product_name || !isFinite(q) || q <= 0) continue;
    components.push({ name: c.product_name, grams: round2(q * 100) });
  }
  if (components.length === 0) throw new Error("dnaapp: no component quantities");
  const componentSum = round2(components.reduce((s, c) => s + c.grams, 0));

  // Cross-check: nutrient-density median over item rows.
  const rows = item.nutrient_facts?.nutrient ?? [];
  const derived: number[] = [];
  for (const r of rows) {
    const value = Number(r.value);
    const per100 = Number(r.hundred_g_per_product);
    if (isFinite(value) && value > 0 && isFinite(per100) && per100 > 0) {
      derived.push((100 * value) / per100);
    }
  }
  if (derived.length < 4) throw new Error("dnaapp: too few nutrient rows for cross-check");
  const nutrientMedian = round2(median(derived));

  const delta = round2(Math.abs(componentSum - nutrientMedian));
  if (delta > SPEC_CROSSCHECK_ALARM_GRAMS) {
    throw new Error(
      `portion-spec cross-check divergence ${delta} g (component sum ${componentSum}, nutrient median ${nutrientMedian})`
    );
  }

  const reading: PortionSpecReading = {
    grams: componentSum,
    nutrientMedianGrams: nutrientMedian,
    crossCheckDeltaGrams: delta,
    components,
    calories: nutrientValue(rows, "Calories"),
    protein: nutrientValue(rows, "Protein"),
    fetchedAt: new Date().toISOString(),
  };

  const rawExcerpt = {
    item_name: item.item_name,
    components: componentsRaw.map((c) => ({
      product_name: c.product_name,
      quantity: c.quantity,
    })),
    nutrient_facts: rows.map((r) => ({
      name: r.name,
      value: r.value,
      hundred_g_per_product: r.hundred_g_per_product,
      uom: r.uom,
    })),
  };

  return { reading, rawExcerpt };
}
