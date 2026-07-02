/**
 * Fail-closed citation check (publication rule 5): a deterministic fetcher
 * re-retrieves every cited page and must find the reported price in its
 * content. Unverifiable observations are discarded — never imputed.
 */

import type { CitationCheck } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * Digit-bounded matchers for the reported price ("2.10" also as "2.1").
 * Boundaries are required so $2.10 cannot be "confirmed" by a page that only
 * contains 2.19, 12.10, or "2.1k reviews" — without them the fail-closed
 * check is effectively fail-open for trailing-zero prices.
 */
function priceMatchers(price: number): RegExp[] {
  const fixed = price.toFixed(2).replace(".", "\\.");
  const matchers = [new RegExp(`(^|[^\\d.])${fixed}(?![\\d])`)];
  if (price.toFixed(2).endsWith("0")) {
    // Trailing-zero form ("$2.1") must be dollar-anchored — a bare "2.1"
    // matches counters like "2.1k reviews" and is too weak as price evidence.
    const stripped = price.toFixed(2).slice(0, -1).replace(".", "\\.");
    matchers.push(new RegExp(`\\$${stripped}(?![\\d])`));
  }
  return matchers;
}

export async function verifyCitation(url: string, price: number): Promise<CitationCheck> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/json;q=0.9,*/*;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      return { fetched: false, priceFound: false, httpStatus: res.status, error: null };
    }
    const text = await res.text();
    const mentionsItem = /mcchicken/i.test(text);
    const hasPrice = priceMatchers(price).some((re) => re.test(text));
    return {
      fetched: true,
      priceFound: mentionsItem && hasPrice,
      httpStatus: res.status,
      error: null,
    };
  } catch (e) {
    return {
      fetched: false,
      priceFound: false,
      httpStatus: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
