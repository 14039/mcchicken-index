"use client";

import { useEffect, useState } from "react";

interface Entry {
  date: string;
  title: string;
  body: string;
  headlineIndex: number;
  headlineWoWPct: number | null;
  marginRead: string;
}

export default function JournalFeed({ limit }: { limit?: number }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/mcchicken/journal")
      .then((r) => r.json())
      .then((j) => setEntries(j.entries || []))
      .catch(() => setEntries([]));
  }, []);

  if (entries === null) return <p className="muted">Loading notes…</p>;
  if (entries.length === 0) {
    return (
      <p className="muted">
        No analyst notes published yet. The first note posts with the next Monday update.
      </p>
    );
  }

  const shown = limit ? entries.slice(0, limit) : entries;

  return (
    <div>
      {shown.map((e) => {
        const wow = e.headlineWoWPct;
        return (
          <article className="journal-card" key={e.date}>
            <div className="meta">
              <time>{e.date}</time>
              <span>
                Index <strong className="accent">{Math.round(e.headlineIndex)}</strong>
              </span>
              {wow !== null && (
                <span className={wow >= 0 ? "pos" : "neg"}>
                  {wow >= 0 ? "▲" : "▼"} {Math.abs(wow).toFixed(2)}% WoW
                </span>
              )}
            </div>
            <h3>{e.title}</h3>
            <p>{e.body}</p>
            {e.marginRead && <div className="margin-read">{e.marginRead}</div>}
          </article>
        );
      })}
    </div>
  );
}
