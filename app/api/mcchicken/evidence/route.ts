/**
 * Public evidence log (publication rule 6): every run's per-metro raw
 * evidence, portion-spec reading, wage vintage, and outcome — append-only.
 *
 *   GET /api/mcchicken/evidence              → { dates, latest }
 *   GET /api/mcchicken/evidence?date=YYYY-MM-DD → one EvidenceRecord
 */

import { NextRequest, NextResponse } from "next/server";
import { getEvidence, getEvidenceIndex } from "@/lib/redis";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const date = request.nextUrl.searchParams.get("date");
    if (date) {
      const record = await getEvidence(date);
      if (!record) {
        return NextResponse.json(
          { error: `no evidence for ${date}` },
          { status: 404, headers: { ...CORS, "Cache-Control": "no-store" } }
        );
      }
      return NextResponse.json(record, {
        headers: { ...CORS, "Cache-Control": "public, max-age=3600" },
      });
    }
    const dates = await getEvidenceIndex();
    const latest = dates.length ? await getEvidence(dates[dates.length - 1]) : null;
    return NextResponse.json(
      { dates, latest },
      { headers: { ...CORS, "Cache-Control": "public, max-age=900" } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "internal error" },
      { status: 500, headers: { ...CORS, "Cache-Control": "no-store" } }
    );
  }
}
