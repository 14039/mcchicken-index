/**
 * Human sign-off endpoint (publication rule 4 for >5% headline moves; rule 2
 * for portion-spec changes). Bearer-authenticated with CRON_SECRET.
 *
 *   POST /api/admin/release  { "type": "headline", "action": "approve" | "reject" }
 *   POST /api/admin/release  { "type": "spec",     "action": "approve" | "reject" }
 */

import { NextRequest, NextResponse } from "next/server";
import { specChangeAttribution } from "@/lib/pipeline";
import {
  appendRunLog,
  getHeld,
  getSpecState,
  publishPoint,
  setHeld,
  setSpecState,
} from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { type?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { type, action } = body;
  if (!["headline", "spec"].includes(type ?? "") || !["approve", "reject"].includes(action ?? "")) {
    return NextResponse.json(
      { error: 'expected { type: "headline"|"spec", action: "approve"|"reject" }' },
      { status: 400 }
    );
  }

  if (type === "headline") {
    const held = await getHeld();
    if (!held) return NextResponse.json({ error: "nothing held" }, { status: 404 });
    if (action === "approve") {
      await publishPoint(held.point);
      await setHeld(null);
      await appendRunLog({
        surveyDate: held.point.surveyDate,
        timestamp: new Date().toISOString(),
        status: "published",
        reason: `sign-off approved (${held.reason})`,
        mciMinutes: held.point.mciMinutes,
        panelPriceUsd: held.point.panelPriceUsd,
        quorum: held.point.quorum,
      });
      return NextResponse.json({ released: held.point });
    }
    await setHeld(null);
    await appendRunLog({
      surveyDate: held.point.surveyDate,
      timestamp: new Date().toISOString(),
      status: "gap",
      reason: `sign-off rejected (${held.reason})`,
    });
    return NextResponse.json({ rejected: held.point.surveyDate });
  }

  // type === "spec"
  const state = await getSpecState();
  if (!state?.pending?.awaitingSignoff) {
    return NextResponse.json({ error: "no spec change awaiting sign-off" }, { status: 404 });
  }
  if (action === "approve") {
    const attribution = specChangeAttribution(state);
    const today = new Date().toISOString().slice(0, 10);
    const next = {
      current: {
        grams: state.pending.grams,
        components: state.pending.components,
        verifiedAt: new Date().toISOString(),
        since: today,
      },
      pending: null,
      events: [
        ...state.events,
        {
          date: today,
          fromGrams: state.current.grams,
          toGrams: state.pending.grams,
          attribution,
        },
      ],
    };
    await setSpecState(next);
    return NextResponse.json({ approved: next.events[next.events.length - 1] });
  }
  await setSpecState({ ...state, pending: null });
  return NextResponse.json({ rejected: "pending spec change discarded" });
}
