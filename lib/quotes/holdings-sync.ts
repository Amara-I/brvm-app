// Portefeuille : faut-il relire les lignes (valeur de marché, P&L) après un sondage
// des derniers cours ? Oui seulement si un cours diffère de celui des lignes affichées.

import type { LatestQuote } from "./types";

export interface HoldingQuoteView {
  ticker: string;
  currentPrice: number | "N/D" | null;
  currentPriceDate?: string | "N/D" | null;
}

export function holdingsBehindQuotes(holdings: readonly HoldingQuoteView[], quotes: readonly LatestQuote[]): boolean {
  const byTicker = new Map(quotes.map((q) => [q.ticker, q]));
  for (const h of holdings) {
    const q = byTicker.get(h.ticker.toUpperCase());
    if (!q) continue;
    const date = typeof h.currentPriceDate === "string" && h.currentPriceDate !== "N/D" ? h.currentPriceDate : null;
    const price = typeof h.currentPrice === "number" ? h.currentPrice : null;
    if (price == null || date == null) return true;
    if (q.date > date) return true;
    if (q.date === date && Math.abs(q.close - price) > 0.005) return true;
  }
  return false;
}
