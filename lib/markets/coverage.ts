import type { ListingExchange } from "./listing-scope";

export interface CoverageInput {
  ticker: string;
  exchange: ListingExchange;
  firstDate: string | null;
  lastDate: string | null;
  priceCount: number;
  financials: { year: number; revenue: unknown; operatingIncome: unknown; netIncome: unknown }[];
}

/** Mesure les trous, pas une promesse de disponibilité ni une interpolation. */
export function listingCoverage(row: CoverageInput, today = new Date().toISOString().slice(0, 10)) {
  const year = Number(today.slice(0, 4));
  const requiredYears = Array.from({ length: 10 }, (_, i) => year - 10 + i);
  const finite = (value: unknown) => value != null && Number.isFinite(Number(value));
  const complete = new Set(row.financials.filter((r) => [r.revenue, r.operatingIncome, r.netIncome].every(finite)).map((r) => r.year));
  const missingFinancialYears = requiredYears.filter((y) => !complete.has(y));
  const targetStart = `${Math.min(2006, year - 20)}-01-01`;
  return {
    ticker: row.ticker, exchange: row.exchange,
    href: row.exchange === "NGX" ? `/marches/ngx/actions/${encodeURIComponent(row.ticker)}` : `/actions/${encodeURIComponent(row.ticker)}`,
    firstDate: row.firstDate, lastDate: row.lastDate, priceCount: row.priceCount,
    historyTargetStart: targetStart,
    // Une première date ancienne ne prouve pas la continuité journalière/mensuelle.
    startsAtTarget: row.firstDate != null && row.firstDate <= targetStart,
    continuity: "NON_VERIFIEE", granularity: "NON_VERIFIEE",
    missingFinancialYears,
    criticalMissing: row.priceCount === 0 || missingFinancialYears.length > 0,
  };
}
