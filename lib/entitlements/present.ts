import { applyChartSeriesWindow } from "@/lib/charts/chart-window";
import type { CompaniesFullDataset, CompanyFullDataset } from "@/lib/api/companies-full-dataset";
import type { CompanySheetPayload } from "@/lib/api/company-sheet-dataset";
import type { EnrichedDividendRow } from "@/lib/api/dividend-enrichment";
import type { CalcMetricsResult } from "@/lib/calc/calc-metrics";
import type { FinancialHealth } from "@/lib/calc/financial-health";
import type { NgxBoardRow } from "@/lib/markets/ngx-board-row";
import { kpisFromBoardRows, type NgxOverviewBoardPayload } from "@/lib/markets/ngx-overview-board";
import type { TechnicalAnalysis } from "@/lib/technical-analysis/types";
import type { DividendCalendarDataset, DividendCalendarEvent } from "@/lib/api/dividend-calendar-build";
import type { BrvmFundamentalAnalysis } from "@/lib/fundamental/brvm-analysis";
import type { IndexPageData } from "@/lib/markets/index-page";
import type { NgxDividendsData, NgxDividendRow } from "@/lib/markets/ngx-dividends";
import type { NgxSheetData } from "@/lib/markets/ngx-sheet";
import { capSeriesToAnonWindow } from "./chart-cap";
import { ANON_MAX_CHART_RANGE } from "./plans";
import type { Viewer } from "./viewer";

/** Dernier millésime de cours strictement positif. */
export function lastPositiveYear(series: Record<number, number>): number | null {
  const years = Object.keys(series)
    .map(Number)
    .filter((y) => Number.isFinite(y) && (series[y] ?? 0) > 0)
    .sort((a, b) => a - b);
  return years.length ? years[years.length - 1]! : null;
}

/**
 * Dernier millésime enregistré, y compris un montant à 0
 * (absence de dividende confirmée). Distinct de l'absence de ligne.
 */
export function lastRecordedYear(series: Record<number, number>): number | null {
  const years = Object.keys(series)
    .map(Number)
    .filter((y) => Number.isFinite(y) && series[y] != null && Number.isFinite(series[y]))
    .sort((a, b) => a - b);
  return years.length ? years[years.length - 1]! : null;
}

export function slimCompanyForVisitor(company: CompanyFullDataset): CompanyFullDataset {
  const lastPriceYear = lastPositiveYear(company.prices);
  // Le visiteur ne voit que le dernier dividende, même s'il est à 0 (« Pas de dividende »).
  const lastDivYear = lastRecordedYear(company.dividends);
  return {
    ...company,
    per: 0,
    roe: null,
    netMargin: null,
    debtRatio: null,
    pbRatio: null,
    revenueGrowth: null,
    fcf: null,
    prevPer: null,
    prevMktcap: null,
    prevRoe: null,
    prevNetMargin: null,
    prevDebtRatio: null,
    prevPbRatio: null,
    prevRevenueGrowth: null,
    prevFcf: null,
    prices: lastPriceYear != null ? { [lastPriceYear]: company.prices[lastPriceYear]! } : {},
    dividends: lastDivYear != null ? { [lastDivYear]: company.dividends[lastDivYear]! } : {},
  };
}

export function presentCompaniesFullDataset(
  dataset: CompaniesFullDataset,
  viewer: Viewer
): CompaniesFullDataset {
  if (!viewer.gated) return dataset;
  return {
    ...dataset,
    companies: dataset.companies.map(slimCompanyForVisitor),
  };
}

const REDACTED_HEALTH: FinancialHealth = {
  overall: 0,
  label: "N/D",
  pillars: [],
  note: "",
};

export function redactMetrics(metrics: CalcMetricsResult): CalcMetricsResult {
  return {
    ...metrics,
    perf5Percent: "N/D",
    perf10Percent: "N/D",
    avgDividend: 0,
    volatilityPercent: "N/D",
    riskLevel: "N/D",
    score: 0,
    signal: { label: "CONSERVER", color: "transparent" },
    historyDepth: 1,
    confidence: "Faible",
    signalSummary: "",
    signalReasons: [],
    horizonScores: { court: 0, moyen: 0, long: 0 },
    technicalScore: 0,
    fundamentalScore: 0,
    compositeScore: 0,
    riskAnalysis: {
      riskScore: 0,
      riskTier: "Modéré",
      pillars: [],
      summary: "",
      maxDrawdownPercent: null,
      var95Percent: null,
      var99Percent: null,
      cvar95Percent: null,
    },
    technical: {
      available: false,
      points: 0,
      rsi14: null,
      sma10: null,
      sma20: null,
      sma50: null,
      sma200: null,
      macd: null,
      maCross: "N/D",
      shortTermScore: null,
      notes: [],
    },
    sectorScore: 0,
  };
}

export function redactTechnical(analysis: TechnicalAnalysis): TechnicalAnalysis {
  return {
    ...analysis,
    barsUsed: 0,
    chartBars: [],
    zones: [],
    gaps: [],
    scenarios: [],
    signal: { label: "CONSERVER", timingScore: 0, confidence: "Faible" },
  };
}

function lastDividendOnly(rows: EnrichedDividendRow[]): EnrichedDividendRow[] {
  if (rows.length <= 1) return rows;
  const sorted = [...rows].sort((a, b) => {
    const da = a.exDate ?? `${a.year}-12-31`;
    const db = b.exDate ?? `${b.year}-12-31`;
    if (da !== db) return da < db ? -1 : 1;
    return a.year - b.year;
  });
  return [sorted[sorted.length - 1]!];
}

export function presentCompanySheetPayload(
  payload: CompanySheetPayload,
  viewer: Viewer
): CompanySheetPayload {
  if (!viewer.gated) return payload;
  const series = applyChartSeriesWindow(payload.series, { range: ANON_MAX_CHART_RANGE }).series;
  return {
    ...payload,
    company: slimCompanyForVisitor(payload.company),
    peers: [],
    years: payload.years.slice(-1),
    metrics: redactMetrics(payload.metrics),
    qualityConfidence: "Faible",
    technicalAnalysis: redactTechnical(payload.technicalAnalysis),
    signalPatches: {},
    health: REDACTED_HEALTH,
    series,
    performance: {
      oneMonth: payload.performance.oneMonth,
      threeMonths: payload.performance.threeMonths,
      ytd: payload.performance.ytd,
      oneYear: payload.performance.oneYear,
      fiveYears: payload.performance.fiveYears,
    },
    keyRows: payload.keyRows.slice(0, 3).map((row) => ({ ...row, previous: "—", variation: "—" })),
    outlook: null,
    dividendSchedule: lastDividendOnly(payload.dividendSchedule),
    incomeStatement: payload.incomeStatement.slice(-1),
    ratioHistory: [],
  };
}

export function presentNgxBoardRows(rows: NgxBoardRow[], viewer: Viewer): NgxBoardRow[] {
  if (!viewer.gated) return rows;
  return rows.map((row) => ({
    ...row,
    score: null,
    scoreMode: null,
    signal: null,
    confidence: null,
  }));
}

export function redactChartAnalysisPayload<T extends Record<string, unknown> | undefined>(
  analysis: T,
  viewer: Viewer
): T | undefined {
  if (!viewer.gated) return analysis;
  return undefined;
}

export function presentNgxOverviewBoard(board: NgxOverviewBoardPayload, viewer: Viewer): NgxOverviewBoardPayload {
  if (!viewer.gated) return board;
  const rows = presentNgxBoardRows(board.rows, viewer);
  return { ...board, rows, kpis: kpisFromBoardRows(rows) };
}

export function presentScoredCompanies<T extends { co: CompanyFullDataset; metrics: CalcMetricsResult }>(
  rows: T[],
  viewer: Viewer
): T[] {
  if (!viewer.gated) return rows;
  return rows.map((row) => ({ ...row, co: slimCompanyForVisitor(row.co), metrics: redactMetrics(row.metrics) }));
}


function latestByTicker<T extends { ticker: string; year: number; exDate?: string | null; paymentDate?: string | null; displayDate?: string }>(
  rows: T[]
): T[] {
  const best = new Map<string, T>();
  const stamp = (row: T) => row.exDate ?? row.paymentDate ?? row.displayDate ?? `${row.year}-12-31`;
  for (const row of rows) {
    const prev = best.get(row.ticker);
    if (!prev) {
      best.set(row.ticker, row);
      continue;
    }
    if (row.year > prev.year || (row.year === prev.year && stamp(row) >= stamp(prev))) {
      best.set(row.ticker, row);
    }
  }
  return [...best.values()];
}

function recountDividendCalendar(events: DividendCalendarEvent[], priceDate: string | null): DividendCalendarDataset {
  const years = [...new Set(events.map((e) => e.year))].sort((a, b) => b - a);
  const calendarYears = [
    ...new Set(
      events
        .map((e) => (e.exDate ?? e.paymentDate ?? "").slice(0, 4))
        .map(Number)
        .filter((y) => Number.isFinite(y) && y > 0)
    ),
  ].sort((a, b) => b - a);
  const today = new Date().toISOString().slice(0, 10);
  return {
    events,
    years,
    calendarYears,
    sectors: [...new Set(events.map((e) => e.sector))].sort(),
    datedCount: events.filter((e) => e.precision !== "exercice").length,
    exerciceOnlyCount: events.filter((e) => e.precision === "exercice").length,
    upcomingCount: events.filter((e) => (e.exDate ?? e.paymentDate ?? "") >= today).length,
    companies: new Set(events.map((e) => e.ticker)).size,
    priceDate,
  };
}

export function presentDividendCalendar(data: DividendCalendarDataset, viewer: Viewer): DividendCalendarDataset {
  if (!viewer.gated) return data;
  return recountDividendCalendar(latestByTicker(data.events), data.priceDate);
}

export function presentNgxDividends(data: NgxDividendsData, viewer: Viewer): NgxDividendsData {
  if (!viewer.gated) return data;
  const rows: NgxDividendRow[] = latestByTicker(data.rows);
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a);
  const sectors = [...new Map(rows.map((r) => [r.sectorSlug, { slug: r.sectorSlug, name: r.sectorName }])).values()];
  return {
    rows,
    years,
    sectors,
    companies: new Set(rows.map((r) => r.ticker)).size,
    datedCount: rows.filter((r) => r.exDate || r.paymentDate).length,
    priceDate: data.priceDate,
  };
}

export function presentIndexPageData(data: IndexPageData, viewer: Viewer): IndexPageData {
  if (!viewer.gated) return data;
  const series = capSeriesToAnonWindow(data.detail.series);
  return {
    ...data,
    analysis: null,
    detail: {
      ...data.detail,
      series,
      stats: {
        ...data.detail.stats,
        historyPoints: series.length,
      },
    },
  };
}

export function teaserFundamentalAnalysis(analysis: BrvmFundamentalAnalysis): BrvmFundamentalAnalysis {
  return {
    ...analysis,
    steps: analysis.steps.slice(0, 1),
    performance: {
      ...analysis.performance,
      years: analysis.performance.years.slice(-1),
      revenueCagr: { cagr: null, fromYear: null, toYear: null, span: 0 },
      netIncomeCagr: { cagr: null, fromYear: null, toYear: null, span: 0 },
    },
    outlook: {
      ...analysis.outlook,
      synthesis: null,
      peerCount: 0,
    },
    valuation: {
      ...analysis.valuation,
      estimates: [],
      skipped: [],
      historicalPer: null,
    },
    sector: {
      ...analysis.sector,
      rows: [],
      peersWithData: 0,
      peerCount: 0,
    },
    dividends: {
      ...analysis.dividends,
      lines: analysis.dividends.lines.slice(-1),
      missingYears: [],
      growthPercent: null,
      growthCagrPercent: null,
    },
    policies: [],
    adapted: [],
    partial: [],
    unfavorable: [],
    insufficient: [],
  };
}

export function presentNgxSheetData(data: NgxSheetData, viewer: Viewer): NgxSheetData {
  if (!viewer.gated) return data;
  const lastYear = lastPositiveYear(data.yearPrices);
  return {
    page: { ...data.page, series: capSeriesToAnonWindow(data.page.series) },
    model: {
      ...data.model,
      score: {
        ...data.model.score,
        overall: null,
        band: null,
        policies: data.model.score.policies.map((policy) => ({ ...policy, score: null })),
      },
    },
    fundamental: teaserFundamentalAnalysis(data.fundamental),
    technical: redactTechnical(data.technical),
    yearPrices: lastYear != null ? { [lastYear]: data.yearPrices[lastYear]! } : {},
  };
}
