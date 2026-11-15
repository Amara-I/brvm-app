// Données d'une fiche d'indice (BRVM ou NGX) : série, stats, risque, analyse technique
// en points, participation des composantes. Tout vient de caches serveur :
// fiche d'indice (1 h), variations BRVM (1 h), vue d'ensemble NGX (10 min).

import { detailFromBundle } from "@/lib/api/market-indices";
import { loadNgxOverview } from "@/lib/markets/ngx-browse";
import { ngxSectorGroup, sectorSlug, type NgxSectorGroup } from "@/lib/ngx/sectors";
import { analyzePriceHistoryCached } from "@/lib/technical-analysis/cache";
import type { TechnicalAnalysis } from "@/lib/technical-analysis/types";
import { CHART_CACHE_LOOKBACK_PAD_DAYS } from "@/lib/charts/chart-series-cache";
import {
  computeBreadth,
  computeIndexRisk,
  type IndexBreadth,
  type IndexRisk,
} from "@/lib/markets/index-insights";
import {
  loadBrvmConstituentMoves,
  loadIndexSheetBundle,
  type ConstituentMove,
  type IndexSeriesPoint,
} from "@/lib/markets/index-sheet";
import type { MarketIndexDetail } from "@/lib/markets/index-view";

/** Fenêtre d'analyse : 1 an + marge des moyennes longues (comme les fiches NGX). */
export const INDEX_ANALYSIS_DAYS = 365 + CHART_CACHE_LOOKBACK_PAD_DAYS;

export interface IndexPageData {
  exchange: "BRVM" | "NGX";
  detail: MarketIndexDetail;
  risk: IndexRisk;
  athValue: number | null;
  athDate: string | null;
  analysis: TechnicalAnalysis | null;
  breadth: IndexBreadth | null;
}

/** Clôtures quotidiennes de la fenêtre d'analyse (la série composée est quotidienne sur 800 jours). */
export function analysisWindow(series: readonly IndexSeriesPoint[]): IndexSeriesPoint[] {
  const last = series[series.length - 1];
  if (!last) return [];
  const from = new Date(`${last.time}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - INDEX_ANALYSIS_DAYS);
  const iso = from.toISOString().slice(0, 10);
  return series.filter((p) => p.time >= iso);
}

const NGX_SECTOR_INDEX: Record<string, NgxSectorGroup> = {
  NGXBNK: "BANKING",
  NGXINS: "INSURANCE",
  NGXOILGAS: "OIL_GAS",
  NGXCNSMRGDS: "CONSUMER_GOODS",
  NGXINDUSTR: "INDUSTRIAL_GOODS",
};

const NGX_BOARD_INDEX: Record<string, string> = {
  NGXMAINBOARD: "main-board",
  NGXPREMIUM: "premium-board",
  NGXGROWTH: "growth-board",
};

/** Périmètre NGX approché d'un indice (univers, compartiment, secteur). null = N/D. */
export function ngxBreadthScope(
  code: string,
  moves: readonly ConstituentMove[]
): { moves: ConstituentMove[]; basis: IndexBreadth["basis"] } | null {
  const c = code.toUpperCase();
  if (c === "NGX_ASI") return { moves: [...moves], basis: "universe" };
  const board = NGX_BOARD_INDEX[c];
  if (board) {
    const scoped = moves.filter((m) => m.board != null && sectorSlug(m.board).startsWith(board.replace("-board", "")));
    return scoped.length > 0 ? { moves: scoped, basis: "board" } : null;
  }
  const group = NGX_SECTOR_INDEX[c];
  if (group) {
    const scoped = moves.filter((m) => ngxSectorGroup(m.ticker, m.sector) === group);
    return scoped.length > 0 ? { moves: scoped, basis: "sector" } : null;
  }
  return null;
}

async function ngxMoves(): Promise<ConstituentMove[]> {
  const overview = await loadNgxOverview();
  return overview.shares.map((share) => ({
    ticker: share.ticker,
    name: share.name,
    sector: share.sectorSlug,
    board: share.board,
    close: share.close,
    changePercent: share.changePercent,
    sessionDate: share.sessionDate,
  }));
}

async function breadthFor(detail: MarketIndexDetail, exchange: "BRVM" | "NGX"): Promise<IndexBreadth | null> {
  try {
    if (exchange === "NGX") {
      const scope = ngxBreadthScope(detail.code, await ngxMoves());
      return scope ? computeBreadth(scope.moves, scope.basis) : null;
    }
    const comp = detail.composition;
    if (comp.constituents.length === 0) return null;
    const tickers = new Set(comp.constituents.map((c) => c.ticker.toUpperCase()));
    const moves = (await loadBrvmConstituentMoves()).filter((m) => tickers.has(m.ticker.toUpperCase()));
    const basis: IndexBreadth["basis"] =
      comp.official || comp.kind === "official" ? "official" : comp.kind === "all_listed" ? "universe" : "sector";
    return computeBreadth(moves, basis);
  } catch (err) {
    console.warn("[indices] participation N/D", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function loadIndexPage(code: string, exchange: "BRVM" | "NGX"): Promise<IndexPageData | null> {
  const bundle = await loadIndexSheetBundle(code, exchange);
  if (!bundle) return null;
  const detail = await detailFromBundle(bundle);
  const window = analysisWindow(bundle.series);
  const analysis = window.length > 0 ? analyzePriceHistoryCached(window, { currency: "PTS" }) : null;
  const [breadth] = await Promise.all([breadthFor(detail, exchange)]);
  return {
    exchange,
    detail,
    risk: computeIndexRisk(bundle.series, { athValue: bundle.athValue }),
    athValue: bundle.athValue,
    athDate: bundle.athDate,
    analysis,
    breadth,
  };
}
