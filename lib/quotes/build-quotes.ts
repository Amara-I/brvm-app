// Construction pure des derniers cours à partir des 2 dernières lignes canoniques
// par société — même règle que les notifications (evaluate-all : dernier cours
// canonique ÷ diviseur de fractionnement, variation vs séance canonique précédente
// ou variation officielle publiée).

import { priceDivisor, roundPrice, sessionChangePercent } from "@/lib/corporate-actions/adjust";
import type { AdjustmentAction } from "@/lib/corporate-actions/types";
import type { LatestQuote, QuoteMarket } from "./types";

export interface LatestQuoteRow {
  ticker: string;
  date: Date | string;
  close: unknown;
  changePercent: unknown;
  ingestedAt: Date | string | null;
}

function iso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Regroupe les lignes (≤ 2 par ticker, toutes canoniques) et calcule le dernier cours.
 * `actionsByTicker` : fractionnements actifs (vide = aucun ajustement).
 */
export function buildLatestQuotes(
  market: QuoteMarket,
  rows: readonly LatestQuoteRow[],
  actionsByTicker: ReadonlyMap<string, AdjustmentAction[]> = new Map()
): LatestQuote[] {
  const byTicker = new Map<string, LatestQuoteRow[]>();
  for (const row of rows) {
    const list = byTicker.get(row.ticker) ?? [];
    list.push(row);
    byTicker.set(row.ticker, list);
  }
  const out: LatestQuote[] = [];
  for (const [ticker, list] of byTicker) {
    list.sort((a, b) => iso(b.date).localeCompare(iso(a.date)));
    const last = list[0]!;
    const prev = list[1] ?? null;
    const rawClose = num(last.close);
    if (rawClose == null || !(rawClose > 0)) continue;
    const actions = actionsByTicker.get(ticker) ?? [];
    const date = iso(last.date).slice(0, 10);
    const close = roundPrice(rawClose / priceDivisor(actions, date));
    const rawPrev = prev ? num(prev.close) : null;
    const prevDate = prev ? iso(prev.date).slice(0, 10) : null;
    const prevClose =
      rawPrev != null && rawPrev > 0 && prevDate ? roundPrice(rawPrev / priceDivisor(actions, prevDate)) : null;
    const stored = num(last.changePercent);
    const changePercent = sessionChangePercent(
      rawPrev != null && prevDate ? { date: prevDate, close: rawPrev } : null,
      { date, close: rawClose },
      stored,
      actions
    );
    const changeAbs =
      prevClose != null
        ? roundPrice(close - prevClose)
        : changePercent != null
          ? roundPrice(close - close / (1 + changePercent / 100))
          : null;
    out.push({
      ticker,
      market,
      close,
      prevClose,
      changePercent: changePercent != null ? Math.round(changePercent * 100) / 100 : null,
      changeAbs,
      date,
      asOf: last.ingestedAt ? iso(last.ingestedAt) : `${date}T00:00:00.000Z`,
    });
  }
  return out.sort((a, b) => a.ticker.localeCompare(b.ticker));
}
