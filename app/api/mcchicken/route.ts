/**
 * Public API — free, no authentication, CORS-open.
 *
 *   GET /api/mcchicken            → latest index reading + anchors
 *   GET /api/mcchicken?range=3M   → adds `history` and `context` (1M|3M|6M|1Y|ALL)
 *
 * The first external consumer is 16burget.com. Successful responses are
 * cacheable (the index changes at most twice weekly); errors are never
 * cached (a past v2 bug CDN-cached outages for an hour).
 */

import { NextRequest, NextResponse } from "next/server";
import anchorsJson from "@/data/anchors.json";
import { METHODOLOGY_VERSION, SITE_URL } from "@/lib/config";
import {
  getCpiSeries,
  getHeld,
  getLatestPoint,
  getRegimeEvents,
  getRuns,
  getSeries,
  getSpecState,
} from "@/lib/redis";
import type { HistoricalAnchor, PublishedPoint } from "@/lib/types";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const CACHE_OK = { "Cache-Control": "public, max-age=3600, s-maxage=3600" };
const CACHE_ERR = { "Cache-Control": "no-store" };

const RANGES: Record<string, number> = {
  "1M": 31,
  "3M": 92,
  "6M": 183,
  "1Y": 366,
};

function filterRange(series: PublishedPoint[], range: string): PublishedPoint[] {
  const days = RANGES[range];
  if (!days) return series; // ALL / unknown → full survey series
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  return series.filter((p) => p.surveyDate >= cutoff);
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const range = request.nextUrl.searchParams.get("range");
    const [latest, runs, held, specState] = await Promise.all([
      getLatestPoint(),
      getRuns(),
      getHeld(),
      getSpecState(),
    ]);
    const lastRun = runs.length ? runs[runs.length - 1] : null;

    const body: Record<string, unknown> = {
      index: latest,
      lastRun: lastRun
        ? { surveyDate: lastRun.surveyDate, status: lastRun.status, reason: lastRun.reason ?? null }
        : null,
      heldPending: held
        ? { surveyDate: held.point.surveyDate, reason: held.reason, createdAt: held.createdAt }
        : null,
      anchors: anchorsJson as HistoricalAnchor[],
      spec: specState
        ? {
            grams: specState.current.grams,
            verifiedAt: specState.current.verifiedAt,
            since: specState.current.since,
            pendingReview: specState.pending?.awaitingSignoff ?? false,
            events: specState.events,
          }
        : null,
      api: {
        version: METHODOLOGY_VERSION,
        documentation: `${SITE_URL}/methodology`,
        evidence: `${SITE_URL}/api/mcchicken/evidence`,
        journal: `${SITE_URL}/api/mcchicken/journal`,
        note: "Index unit: minutes of work per standard McChicken (139.46 g). Anchors are sparse verified historical points from independent instruments — not survey data.",
      },
    };

    if (range) {
      const [series, cpi, regime] = await Promise.all([
        getSeries(),
        getCpiSeries(),
        getRegimeEvents(),
      ]);
      body.range = RANGES[range] ? range : "ALL";
      body.history = filterRange(series, range);
      body.context = { cpiLimitedService: cpi };
      body.regimeEvents = regime;
    }

    return NextResponse.json(body, { headers: { ...CORS, ...CACHE_OK } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "internal error" },
      { status: 500, headers: { ...CORS, ...CACHE_ERR } }
    );
  }
}
