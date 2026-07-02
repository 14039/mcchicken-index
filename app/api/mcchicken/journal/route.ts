/**
 * Public journal feed: one grounded entry per survey run, plus the rolling
 * menu-regime event watch (survey-collected, citation-bearing).
 */

import { NextResponse } from "next/server";
import { getJournal, getRegimeEvents } from "@/lib/redis";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(): Promise<NextResponse> {
  try {
    const [entries, regimeEvents] = await Promise.all([
      getJournal(),
      getRegimeEvents(),
    ]);
    return NextResponse.json(
      { count: entries.length, entries, regimeEvents },
      { headers: { ...CORS, "Cache-Control": "public, max-age=900" } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "internal error" },
      { status: 500, headers: { ...CORS, "Cache-Control": "no-store" } }
    );
  }
}
