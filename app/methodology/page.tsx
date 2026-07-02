/**
 * Methodology & API — renders METHODOLOGY.md (the canonical document)
 * directly, followed by the live panel manifest with pinned URLs and the
 * public API reference. The doc file is the single source of truth; this
 * page never paraphrases it.
 */

import type { Metadata } from "next";
import { readFileSync } from "fs";
import { join } from "path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import manifestJson from "@/data/panel-manifest.json";
import { SITE_URL } from "@/lib/config";
import type { PanelManifest } from "@/lib/types";

export const metadata: Metadata = {
  title: "Methodology & API — McChicken Index",
  description:
    "Methodology v3.1 of the McChicken Index: time-price formula, portion-spec shrinkflation guard, fixed 12-metro LLM survey, integrity rules, and the free public API.",
};

const manifest = manifestJson as PanelManifest;

export default function MethodologyPage() {
  const doc = readFileSync(join(process.cwd(), "METHODOLOGY.md"), "utf8");

  return (
    <>
      <div className="md-doc">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc}</ReactMarkdown>
      </div>

      <div className="md-doc">
        <hr />
        <h2>Panel manifest v1 — pinned primary URLs</h2>
        <p>
          The fixed, published outlet panel (verified {manifest.adopted}). The
          survey instrument is pointed at these exact pages first on every run.
        </p>
        <table>
          <thead>
            <tr>
              <th>Metro</th>
              <th>Region</th>
              <th>Pinned primary URL</th>
            </tr>
          </thead>
          <tbody>
            {manifest.metros.map((m) => (
              <tr key={m.metro}>
                <td>{m.metro}</td>
                <td>{m.region}</td>
                <td>
                  <a href={m.primaryUrl} rel="noopener noreferrer" target="_blank">
                    {m.primaryUrl.replace("https://", "")}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Public API</h2>
        <p>
          Free, public, no authentication. Responses are cached for one hour;
          the index changes at most twice weekly.
        </p>
        <pre>
          <code>{`GET ${SITE_URL}/api/mcchicken            latest reading + historical anchors
GET ${SITE_URL}/api/mcchicken?range=3M   adds history + CPI context (1M|3M|6M|1Y|ALL)
GET ${SITE_URL}/api/mcchicken/evidence   append-only evidence log (?date=YYYY-MM-DD)
GET ${SITE_URL}/api/mcchicken/journal    run journal + regime watch`}</code>
        </pre>
        <p>
          Key fields: <code>index.mciMinutes</code> (the headline, minutes of
          work per standard McChicken), <code>index.panelPriceUsd</code>,{" "}
          <code>index.portionGrams</code>, <code>index.wageUsdPerHour</code>{" "}
          (vintage-pinned), <code>index.quorum</code>,{" "}
          <code>index.decomposition</code> (log-difference attribution to
          price, portion, and wage), and <code>anchors</code> (sparse verified
          historical points from independent instruments — not survey data).
          Every published point links to its evidence record.
        </p>
      </div>
    </>
  );
}
