/**
 * Fail-closed citation check (publication rule 5): a deterministic fetcher
 * re-retrieves every cited page and must find the reported price in its
 * content. Unverifiable observations are discarded — never imputed.
 */

import type { CitationCheck } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Price string variants to search for: "2.10", "2.1", "$2.10". */
function priceVariants(price: number): string[] {
  const fixed = price.toFixed(2);
  const variants = new Set<string>([fixed]);
  if (fixed.endsWith("0")) variants.add(fixed.slice(0, -1)); // 2.10 → 2.1
  return [...variants];
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
    const hasPrice = priceVariants(price).some((v) => text.includes(v));
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
