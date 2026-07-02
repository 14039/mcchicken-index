/**
 * Local pipeline verification — exercises every deterministic component with
 * real network calls but writes nothing. Run:
 *
 *   set -a; source .env.local; set +a; npx tsx scripts/test-pipeline.ts
 */

import manifestJson from "../data/panel-manifest.json";
import { Q_REF_GRAMS } from "../lib/config";
import { fetchPortionSpec } from "../lib/portion-spec";
import { fetchWage } from "../lib/fred";
import { fetchCpiLimitedService } from "../lib/bls";
import { verifyCitation } from "../lib/citation-check";
import { buildSurveyPrompt } from "../lib/survey-prompt";
import { promptHash } from "../lib/openai";
import { advanceSpecState, computePoint, processPanel } from "../lib/pipeline";
import type { PanelManifest, SurveyResponse } from "../lib/types";

const manifest = manifestJson as PanelManifest;
let failures = 0;

function check(label: string, ok: boolean, detail: string) {
  console.log(`${ok ? "✅" : "❌"} ${label}: ${detail}`);
  if (!ok) failures++;
}

async function main() {
  // 1. Portion spec — official McDonald's endpoint, two derivations agree.
  const spec = await fetchPortionSpec();
  check(
    "portion-spec",
    Math.abs(spec.reading.grams - Q_REF_GRAMS) < 0.05,
    `component sum ${spec.reading.grams} g (nutrient median ${spec.reading.nutrientMedianGrams} g, Δ ${spec.reading.crossCheckDeltaGrams} g); components: ${spec.reading.components.map((c) => `${c.name} ${c.grams}g`).join(", ")}`
  );

  // 2. Wage — FRED AHETPI (fredgraph fallback locally, no key present).
  const wage = await fetchWage();
  check(
    "wage",
    wage.usdPerHour > 25 && wage.usdPerHour < 45,
    `$${wage.usdPerHour}/hr, ${wage.month} via ${wage.source}`
  );

  // 3. BLS CPI context series.
  const cpi = await fetchCpiLimitedService(4);
  const last = cpi[cpi.length - 1];
  check(
    "bls-cpi",
    cpi.length > 30 && last.yoyPct !== null,
    `${cpi.length} months, latest ${last.month} = ${last.value} (YoY ${last.yoyPct}%)`
  );

  // 4. Citation re-fetch against two live panel pages with known prices.
  const nyc = await verifyCitation(
    "https://menupricetracker.com/mcdonalds/new-york/new-york",
    4.05
  );
  check("citation-nyc", nyc.priceFound, JSON.stringify(nyc));
  const wrong = await verifyCitation(
    "https://menupricetracker.com/mcdonalds/new-york/new-york",
    1.99
  );
  check("citation-rejects-wrong-price", !wrong.priceFound, JSON.stringify(wrong));

  // 5. Prompt build + hash stability.
  const prompt = buildSurveyPrompt(manifest, "2026-07-02");
  check(
    "prompt",
    prompt.includes("PANEL MANIFEST") && manifest.metros.every((m) => prompt.includes(m.primaryUrl)),
    `hash ${promptHash(prompt)}, ${prompt.length} chars`
  );

  // 6. Index math: reference values from METHODOLOGY.md — P 2.74, Q 139.46,
  //    W 32.38 → 5.1 minutes, factor 1.0.
  const computed = computePoint({
    surveyDate: "2026-07-02",
    panelPriceUsd: 2.74,
    portionGrams: 139.46,
    wage: { usdPerHour: 32.38, month: "2026-06", fetchedAt: "", source: "test" },
    prior: null,
    instrument: { model: "test", promptHash: "test" },
  });
  check(
    "mci-math",
    computed.point.mciMinutes === 5.1 && computed.point.portionFactor === 1,
    `MCI ${computed.point.mciMinutes} min, factor ${computed.point.portionFactor}`
  );

  // 7. Shrinkflation guard math: 10% portion cut at flat price must RAISE the
  //    index ~11%, and the sign-off hold must trip.
  const prior = { ...computed.point };
  const shrunk = computePoint({
    surveyDate: "2026-07-06",
    panelPriceUsd: 2.74,
    portionGrams: 125.51, // −10%
    wage: { usdPerHour: 32.38, month: "2026-06", fetchedAt: "", source: "test" },
    prior,
    instrument: { model: "test", promptHash: "test" },
  });
  check(
    "shrinkflation-guard",
    shrunk.point.mciMinutes > prior.mciMinutes &&
      shrunk.holdReason !== null &&
      shrunk.point.decomposition!.dLnPortionPct < -10,
    `MCI ${prior.mciMinutes} → ${shrunk.point.mciMinutes} min, portion Δln ${shrunk.point.decomposition!.dLnPortionPct}%, hold: ${shrunk.holdReason}`
  );

  // 8. Spec state machine: jitter ignored; >1g change requires two runs.
  const s0 = advanceSpecState(null, spec.reading, "2026-07-02");
  const jitter = advanceSpecState(
    s0.state,
    { ...spec.reading, grams: spec.reading.grams + 0.3 },
    "2026-07-06"
  );
  const bigChange = { ...spec.reading, grams: spec.reading.grams - 5 };
  const strike1 = advanceSpecState(jitter.state, bigChange, "2026-07-09");
  const strike2 = advanceSpecState(strike1.state, bigChange, "2026-07-13");
  check(
    "spec-state-machine",
    jitter.status === "verified" &&
      strike1.status === "pending_change" &&
      !strike1.state.pending!.awaitingSignoff &&
      strike2.state.pending!.awaitingSignoff &&
      strike2.appliedGrams === s0.state.current.grams,
    `jitter=${jitter.status}, strike1 signoff=${strike1.state.pending!.awaitingSignoff}, strike2 signoff=${strike2.state.pending!.awaitingSignoff}, applied stays ${strike2.appliedGrams}g`
  );

  // 9. Panel processing on a synthetic survey (2 real URLs fetched, rest null)
  //    → verifies blocklist rejection, quorum gap accounting.
  const synthetic: SurveyResponse = {
    survey_date: "2026-07-02",
    observations: [
      {
        metro: "New York, NY",
        price: 4.05,
        source_url: "https://menupricetracker.com/mcdonalds/new-york/new-york",
        source_type: "pinned_aggregator",
        price_type: "standard_menu",
        page_updated: null,
        as_of: "2026-07-02",
        notes: "",
      },
      {
        metro: "Dallas, TX",
        price: 2.1,
        source_url: "https://www.doordash.com/store/mcdonalds-dallas",
        source_type: "aggregator",
        price_type: "standard_menu",
        page_updated: null,
        as_of: "2026-07-02",
        notes: "delivery platform — must be rejected",
      },
    ],
    national_estimates: [],
    regime_events: [],
    quality_notes: "synthetic",
  };
  const panel = await processPanel(synthetic, manifest, {}, "2026-07-02");
  const nycResult = panel.metros.find((m) => m.metro === "New York, NY")!;
  const dallasResult = panel.metros.find((m) => m.metro === "Dallas, TX")!;
  check(
    "panel-processing",
    nycResult.status === "verified" &&
      dallasResult.status === "discarded_blocklist" &&
      panel.gapReason !== null &&
      panel.quorum.verified === 1,
    `nyc=${nycResult.status}, dallas=${dallasResult.status}, gap="${panel.gapReason}"`
  );

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
