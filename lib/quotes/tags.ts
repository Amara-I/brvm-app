// Étiquettes de cache des derniers cours (invalidées après chaque écriture de cours).

import type { QuoteMarket } from "./types";

export const QUOTES_TAG = "quotes";

export function quoteMarketTag(market: QuoteMarket): string {
  return `quotes:${market}`;
}

export function quoteTickerTag(ticker: string): string {
  return `quote:${ticker.toUpperCase()}`;
}
