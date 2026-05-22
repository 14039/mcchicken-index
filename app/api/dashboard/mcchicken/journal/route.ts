import { NextResponse } from "next/server";
import { getMcChickenJournal } from "@/lib/redis";

/**
 * GET /api/dashboard/mcchicken/journal
 * Weekly analyst notes (newest first) for the on-site newsfeed.
 */
export async function GET() {
  try {
    const entries = await getMcChickenJournal();
    return NextResponse.json({ count: entries.length, entries });
  } catch (error) {
    console.error("McChicken journal API error:", error);
    return NextResponse.json({ count: 0, entries: [] }, { status: 500 });
  }
}
