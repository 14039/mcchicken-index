import { getAllSeriesObs, indexedAsOf, type FredSeriesKey } from "@/lib/fred";
import { buildSnapshot } from "@/lib/build-snapshot";
import {
  computeCostBasis,
  computeHeadline,
  computeSpread,
  RETAIL_ABS_MIN,
  RETAIL_ABS_MAX,
} from "@/lib/index-model";
import { NextResponse } from "next/server";
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

export const maxDuration = 120;

/**
 * POST /api/admin/migrate  (auth: Bearer CRON_SECRET)
 *
 * Idempotent cleanup + upgrade:
 *   1. Merge v2 series doc with the legacy sorted set.
 *   2. Purge out-of-band reads, de-duplicate by date (keeping the reading
 *      closest to the observed median), and drop isolated spikes — the $1.79
 *      point is removed here.
 *   3. Backfill a consistent BLENDED headline across all history using FRED
 *      data as of each point's date (so the headline series is comparable
 *      across time and week-over-week is real, not a methodology artifact).
 *   4. Recompute the live snapshot from the latest point.
 *
 * Safe to run repeatedly.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Gather all known points, normalized to v2.
    const v2 = await getMcChickenSeries();
    const legacy = (await getLegacyHistory()).map(normalizeLegacy);
    const all = [...v2, ...legacy];

    const purged: string[] = [];

    // 2a. Drop absolutely implausible observed reads.
    const plausible = all.filter((p) => {
      const bad =
        p.observed && (p.retailPrice < RETAIL_ABS_MIN || p.retailPrice > RETAIL_ABS_MAX);
      if (bad) purged.push(`${p.date} $${p.retailPrice} (out-of-band)`);
      return !bad;
    });

    // Robust center of the observed distribution.
    const obsPrices = plausible
      .filter((p) => p.observed)
      .map((p) => p.retailPrice)
      .sort((a, b) => a - b);
    const median = obsPrices.length ? obsPrices[Math.floor(obsPrices.length / 2)] : 0;

    // 2b. One point per date; on collision keep the reading closest to median.
    const byDate = new Map<string, McChickenHistoryPoint>();
    for (const p of plausible) {
      const cur = byDate.get(p.date);
      if (!cur) {
        byDate.set(p.date, p);
        continue;
      }
      const pWins =
        (p.observed && !cur.observed) ||
        (p.observed === cur.observed &&
          Math.abs(p.retailPrice - median) < Math.abs(cur.retailPrice - median));
      const loser = pWins ? cur : p;
      const winner = pWins ? p : cur;
      if (loser.retailPrice !== winner.retailPrice) {
        purged.push(`${loser.date} $${loser.retailPrice} (duplicate date)`);
      }
      byDate.set(p.date, winner);
    }
    let clean = Array.from(byDate.values()).sort((a, b) => msOf(a.date) - msOf(b.date));

    // 2c. Drop isolated observed spikes (>20% from BOTH neighbors).
    const obs = clean.filter((p) => p.observed);
    const spikeDates = new Set<string>();
    for (let i = 1; i < obs.length - 1; i++) {
      const dPrev = Math.abs(obs[i].retailPrice / obs[i - 1].retailPrice - 1);
      const dNext = Math.abs(obs[i].retailPrice / obs[i + 1].retailPrice - 1);
      if (dPrev > 0.2 && dNext > 0.2) {
        spikeDates.add(obs[i].date);
        purged.push(`${obs[i].date} $${obs[i].retailPrice} (isolated spike)`);
      }
    }
    clean = clean.filter((p) => !spikeDates.has(p.date));

    // 3. Backfill a blended headline across history using FRED as-of each date.
    const seriesObs = await getAllSeriesObs();
    const backfilled: McChickenHistoryPoint[] = clean.map((p) => {
      const ms = msOf(p.date);
      const cb = computeCostBasis({
        chicken: indexedAsOf(seriesObs.chicken, ms),
        labor: indexedAsOf(seriesObs.labor, ms),
        overhead: indexedAsOf(seriesObs.overhead, ms),
      });
      const headline = computeHeadline(p.retailIndex, cb);
      const spread = computeSpread(p.retailIndex, cb.value);
      return {
        ...p,
        costBasisIndex: cb.value,
        headlineIndex: headline.value,
        marginSpreadPoints: spread?.points ?? null,
      };
    });

    // 4. Recompute the live snapshot from the latest observed point + prior.
    const nowMs = Date.now();
    const fred = Object.fromEntries(
      (Object.keys(seriesObs) as FredSeriesKey[]).map((k) => [k, indexedAsOf(seriesObs[k], nowMs)])
    ) as Record<FredSeriesKey, ReturnType<typeof indexedAsOf>>;

    const observedB = backfilled.filter((p) => p.observed);
    const latest = observedB[observedB.length - 1] ?? backfilled[backfilled.length - 1] ?? null;
    let snapshotInfo: Record<string, unknown> = { recomputed: false };

    if (latest) {
      const prior = observedB.filter((p) => p.date < latest.date).slice(-1)[0] ?? null;
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
      const merged = backfilled.filter((p) => p.date !== point.date);
      merged.push(point);
      await setMcChickenSeries(merged);
      await setMcChickenCurrent(current);
      snapshotInfo = {
        recomputed: true,
        headlineIndex: current.headlineIndex,
        retailIndex: current.retailIndex,
        costBasisIndex: current.costBasisIndex,
        marginSpread: current.marginSpreadPoints,
        changeWoWPct: current.changes.headlineWoWPct,
        method: current.headlineMethod,
        confidence: current.confidence,
      };
    } else {
      await setMcChickenSeries(backfilled);
      const existing = await getMcChickenCurrent();
      snapshotInfo = { recomputed: false, currentPresent: Boolean(existing) };
    }

    await setQuarantine(null);

    return NextResponse.json({
      success: true,
      purged,
      purgedCount: purged.length,
      cleanPoints: backfilled.length,
      snapshot: snapshotInfo,
      fredAvailable: Object.fromEntries(
        Object.entries(seriesObs).map(([k, v]) => [k, v !== null])
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
