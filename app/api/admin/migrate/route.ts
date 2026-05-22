import { NextResponse } from "next/server";
import { getAllIndexedSeries } from "@/lib/fred";
import { buildSnapshot } from "@/lib/build-snapshot";
import { RETAIL_ABS_MIN, RETAIL_ABS_MAX } from "@/lib/index-model";
import {
  getMcChickenSeries,
  setMcChickenSeries,
  getLegacyHistory,
  getMcChickenCurrent,
  setMcChickenCurrent,
  setQuarantine,
  msOf,
  type McChickenHistoryPoint,
} from "@/lib/redis";

/**
 * POST /api/admin/migrate  (auth: Bearer CRON_SECRET)
 *
 * One-time / idempotent cleanup + upgrade:
 *   1. Merge the v2 series doc with the legacy sorted set.
 *   2. PURGE implausible reads (e.g. the $1.79 "cheapest-not-average" point)
 *      and de-duplicate to one point per date.
 *   3. Persist the clean series.
 *   4. Recompute the live snapshot in the v2 schema from the latest clean
 *      retail price + current FRED data (so the upgrade shows immediately,
 *      without waiting for Monday's cron).
 *   5. Clear any stale quarantine.
 *
 * Safe to run repeatedly.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Gather every known point (v2 doc + legacy zset), normalize to v2.
    const v2 = await getMcChickenSeries();
    const legacy = (await getLegacyHistory()).map(normalizeLegacy);
    const all = [...v2, ...legacy];

    // 2a. Drop implausible observed reads (the $1.79 class lands here).
    const purged: string[] = [];
    const plausible = all.filter((p) => {
      const bad =
        p.observed && (p.retailPrice < RETAIL_ABS_MIN || p.retailPrice > RETAIL_ABS_MAX);
      if (bad) purged.push(`${p.date} $${p.retailPrice}`);
      return !bad;
    });

    // 2b. De-duplicate by date. Prefer observed points; otherwise keep the last.
    const byDate = new Map<string, McChickenHistoryPoint>();
    for (const p of plausible.sort((a, b) => msOf(a.date) - msOf(b.date))) {
      const existing = byDate.get(p.date);
      if (!existing || (p.observed && !existing.observed)) byDate.set(p.date, p);
    }
    const clean = Array.from(byDate.values()).sort((a, b) => msOf(a.date) - msOf(b.date));

    // 3. Persist clean series.
    await setMcChickenSeries(clean);

    // 4. Recompute the live snapshot from the latest clean observed read.
    const fred = await getAllIndexedSeries();
    const observed = clean.filter((p) => p.observed);
    const latest = observed[observed.length - 1] ?? clean[clean.length - 1] ?? null;
    let snapshotInfo: Record<string, unknown> = { recomputed: false };

    if (latest) {
      const prior = observed.filter((p) => p.date < latest.date).slice(-1)[0] ?? null;
      const { current, point } = buildSnapshot({
        today: latest.date,
        retailPrice: latest.retailPrice,
        range: null,
        dataDate: latest.date,
        retailSources: [],
        fred,
        prior,
        source: latest.source || "Recomputed (migration)",
      });
      // Replace the latest point with its recomputed (now cost-aware) version.
      const merged = clean.filter((p) => p.date !== point.date);
      merged.push(point);
      await setMcChickenSeries(merged);
      await setMcChickenCurrent(current);
      snapshotInfo = {
        recomputed: true,
        headlineIndex: current.headlineIndex,
        retailIndex: current.retailIndex,
        costBasisIndex: current.costBasisIndex,
        marginSpread: current.marginSpreadPoints,
        method: current.headlineMethod,
        confidence: current.confidence,
      };
    } else {
      // No clean point at all — leave current untouched if present.
      const existing = await getMcChickenCurrent();
      snapshotInfo = { recomputed: false, currentPresent: Boolean(existing) };
    }

    // 5. Clear any stale quarantine.
    await setQuarantine(null);

    return NextResponse.json({
      success: true,
      purged,
      purgedCount: purged.length,
      cleanPoints: clean.length,
      snapshot: snapshotInfo,
      fredAvailable: Object.fromEntries(
        Object.entries(fred).map(([k, v]) => [k, v !== null])
      ),
    });
  } catch (error) {
    console.error("Migration failed:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

function normalizeLegacy(d: {
  date: string;
  price: number;
  indexValue?: number;
  source?: string;
}): McChickenHistoryPoint {
  const idx = d.indexValue ?? Math.round((d.price / 1.0) * 100);
  return {
    date: d.date,
    headlineIndex: idx,
    retailIndex: idx,
    retailPrice: d.price,
    costBasisIndex: null,
    marginSpreadPoints: null,
    source: d.source ?? "Historical",
    observed: (d.source ?? "").toLowerCase().includes("weekly"),
  };
}
