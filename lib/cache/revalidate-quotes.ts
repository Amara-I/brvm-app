// Invalidation après TOUTE écriture de cours (cron quotidien, boutons « Actualiser »,
// ingestion intrajournalière) : derniers cours (place + titres), jeu marché BRVM,
// cache NGX. La prochaine lecture (fiche, liste, sondage live) relit la base une fois.

import { revalidateTag } from "next/cache";
import { NGX_MARKET_TAG } from "./market-cache";
import { QUOTES_TAG, quoteMarketTag, quoteTickerTag } from "@/lib/quotes/tags";
import type { QuoteMarket } from "@/lib/quotes/types";

/** Étiquette du jeu de données marché BRVM (lib/api/companies-full-dataset.ts). */
export const COMPANIES_FULL_TAG = "companies-full";

export function quoteRevalidationTags(opts: { markets: readonly QuoteMarket[]; tickers?: readonly string[] }): string[] {
  const tags = new Set<string>([QUOTES_TAG]);
  for (const market of opts.markets) {
    tags.add(quoteMarketTag(market));
    tags.add(market === "BRVM" ? COMPANIES_FULL_TAG : NGX_MARKET_TAG);
  }
  for (const ticker of opts.tickers ?? []) {
    if (ticker) tags.add(quoteTickerTag(ticker));
  }
  return [...tags];
}

function isMissingNextCache(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /incrementalCache missing|static generation store missing/i.test(message);
}

/** Sans effet hors runtime Next.js (scripts tsx, vitest). */
export function revalidateQuotesAfterWrite(opts: { markets: readonly QuoteMarket[]; tickers?: readonly string[] }): void {
  for (const tag of quoteRevalidationTags(opts)) {
    try {
      revalidateTag(tag);
    } catch (err) {
      if (!isMissingNextCache(err)) throw err;
    }
  }
}
