/**
 * Journal — one grounded entry per survey run, plus the menu-regime watch
 * feed collected by the survey instrument (citation-bearing). Server-rendered
 * straight from storage; no client fetch hop.
 */

import type { Metadata } from "next";
import { getJournal, getRegimeEvents } from "@/lib/redis";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Journal — McChicken Index",
  description:
    "Run-by-run journal of the McChicken Index: what each survey returned, what moved the index, and menu-regime events under watch.",
};

function fmtPct(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export default async function JournalPage() {
  const [entries, regimeEvents] = await Promise.all([
    getJournal(),
    getRegimeEvents(),
  ]);

  return (
    <>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.2rem",
          letterSpacing: 1,
          margin: "10px 0 8px",
        }}
      >
        JOURNAL
      </h1>
      <p className="muted" style={{ fontSize: "0.82rem", marginBottom: 20, lineHeight: 1.6 }}>
        One entry per survey run: what the panel returned, whether prices or
        paychecks moved the index, and any holds, gaps, or regime events. Every
        figure is drawn from that run&apos;s published data.
      </p>

      {entries.length === 0 && (
        <div className="chart-empty">
          No journal entries yet — the first survey run publishes one.
        </div>
      )}

      {entries.map((e) => (
        <article key={e.date} className="journal-card">
          <div className="meta">
            <span>{e.date}</span>
            <span
              className={
                e.status === "published" ? "pos" : e.status === "error" ? "neg" : "accent"
              }
            >
              {e.status.toUpperCase()}
            </span>
            {e.mciMinutes !== null && <span>MCI {e.mciMinutes.toFixed(1)} min</span>}
            {e.quorum && (
              <span>
                quorum {e.quorum.verified}+{e.quorum.carried}/{e.quorum.of}
              </span>
            )}
            <a
              href={`/api/mcchicken/evidence?date=${e.date}`}
              style={{ marginLeft: "auto", fontSize: "0.72rem" }}
            >
              evidence →
            </a>
          </div>
          <h3>{e.title}</h3>
          <p>{e.body}</p>
          {e.decomposition && (
            <div className="margin-read">
              vs. {e.decomposition.vsDate}: MCI {fmtPct(e.decomposition.dLnMciPct)} ·
              price {fmtPct(e.decomposition.dLnPricePct)} · portion{" "}
              {fmtPct(e.decomposition.dLnPortionPct)} · wage{" "}
              {fmtPct(e.decomposition.dLnWagePct)}
            </div>
          )}
        </article>
      ))}

      {regimeEvents.length > 0 && (
        <>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.95rem",
              letterSpacing: 1,
              margin: "28px 0 12px",
            }}
          >
            REGIME WATCH
          </h2>
          <p className="muted" style={{ fontSize: "0.76rem", marginBottom: 14, lineHeight: 1.6 }}>
            Menu-regime events reported by the survey instrument with citations.
            Flagged for review — never used to change the index directly.
          </p>
          {regimeEvents.map((e) => (
            <div key={`${e.date}-${e.event}`} className="journal-card" style={{ borderLeftColor: "var(--warn)" }}>
              <div className="meta">
                <span>{e.date}</span>
                <a href={e.source_url} rel="noopener noreferrer" target="_blank" style={{ marginLeft: "auto", fontSize: "0.72rem" }}>
                  source →
                </a>
              </div>
              <p style={{ color: "var(--text-primary)" }}>{e.event}</p>
            </div>
          ))}
        </>
      )}
    </>
  );
}
