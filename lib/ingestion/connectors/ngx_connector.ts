// Connecteur NGX (source officielle doclib). Le cron l'appelle via
// `runNgxDailyIngest`, pas dans le lot réconcilié BRVM/Sika/Richbourse.

import type { ConnectorResult, MarketDataConnector, RawIndexQuote, RawPriceQuote } from "../types";
import { loadNgxCover, loadNgxEquities } from "../ngx/load-session";

const SOURCE = "NGX_OFFICIEL" as const;

export const ngxConnector: MarketDataConnector = {
  source: SOURCE,

  async fetchIndices(date?: string): Promise<ConnectorResult<RawIndexQuote[]>> {
    const fetchedAt = new Date().toISOString();
    const cover = await loadNgxCover({ onlyDate: date, walkbackDays: date ? 1 : 6 });
    if (!cover.ok) {
      return { ok: false, source: SOURCE, error: cover.warnings.join(" | ") || "couverture NGX introuvable", fetchedAt };
    }
    const rows = [cover.snapshot.asi, ...cover.snapshot.indices];
    return {
      ok: true,
      source: SOURCE,
      fetchedAt,
      data: rows.map((row) => ({
        code: row.code,
        label: row.name,
        value: row.value,
        changePercent: row.changePercent,
        source: SOURCE,
        date: cover.snapshot.printDate,
        fetchedAt,
      })),
    };
  },

  async fetchQuotes(tickers: string[]): Promise<ConnectorResult<RawPriceQuote[]>> {
    const fetchedAt = new Date().toISOString();
    const wanted = new Set(tickers.map((ticker) => ticker.toUpperCase()));
    const loaded = await loadNgxEquities({ allowJson: true, walkbackDays: 6 });
    if (!loaded.ok) {
      return { ok: false, source: SOURCE, error: loaded.warnings.join(" | ") || "cours NGX introuvables", fetchedAt };
    }
    const data = loaded.quotes
      .filter((row) => wanted.size === 0 || wanted.has(row.symbol))
      .map((row) => ({
        ticker: row.symbol,
        closePrice: row.close,
        volume: row.volume,
        source: SOURCE,
        date: row.tradeDate,
        fetchedAt,
        changePercent: row.changePercent,
        prevClose: row.prevClose,
      }));
    return { ok: true, source: SOURCE, fetchedAt, data };
  },
};
