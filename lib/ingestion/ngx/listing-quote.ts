/** Cotation NGX normalisée, quelle que soit la source (JSON ou PDF). */

export interface NgxListingQuote {
  symbol: string;
  name: string;
  sector: string | null;
  board: string | null;
  close: number;
  prevClose: number | null;
  changePercent: number | null;
  volume: number | null;
  tradeDate: string;
}

export type NgxEquitiesKind = "json" | "official-list" | "daily-summary";
