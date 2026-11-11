// Données de la vue d'ensemble NGX : lignes du tableau, KPI et ordre des indices.
// Module sûr pour le client : aucun accès base ni ingestion.
// Aucun chiffre inventé : une valeur manquante reste null / N/D côté UI.

import { ngxSectorLabel } from "@/components/ngx/ngx-labels";
import type { MarketIndexSnapshot } from "@/lib/api/market-summary-snapshot";
import type { TFunc } from "@/lib/i18n/create-i18n";
import type { NgxBoardRow } from "@/lib/markets/ngx-board-row";
import { resolveIndexCatalog } from "@/lib/markets/index-catalog";
import type { NgxShareRow } from "@/lib/markets/ngx-browse";
import type { NgxScreenerData } from "@/lib/markets/ngx-screener";

export const NGX_BUY_SIGNAL_LABELS = new Set(["ACHAT", "ACHAT FORT"]);

export interface NgxMarketKpis {
  listed: number;
  /** Somme des caps connues, en milliards de naira. null = aucune cap en base. */
  totalCapBn: number | null;
  /** Moyenne des rendements connus (%). null = aucun rendement en base. */
  avgYieldPercent: number | null;
  /** Nombre de signaux techniques ACHAT / ACHAT FORT. */
  buySignals: number;
}

export interface NgxOverviewBoardPayload {
  rows: NgxBoardRow[];
  sessionDate: string | null;
  kpis: NgxMarketKpis;
  indices: MarketIndexSnapshot[];
  sourceLabel: string | null;
}

export function isNgxBuySignal(label: string | null | undefined): boolean {
  return label != null && NGX_BUY_SIGNAL_LABELS.has(label);
}

export function computeNgxMarketKpis(
  rows: Array<{
    marketCapBn?: number | null;
    yieldPercent?: number | null;
    signal?: { label: string } | null;
  }>
): NgxMarketKpis {
  const caps = rows
    .map((row) => row.marketCapBn)
    .filter((value): value is number => value != null && Number.isFinite(value) && value > 0);
  const yields = rows
    .map((row) => row.yieldPercent)
    .filter((value): value is number => value != null && Number.isFinite(value));
  return {
    listed: rows.length,
    totalCapBn: caps.length > 0 ? caps.reduce((sum, value) => sum + value, 0) : null,
    avgYieldPercent: yields.length > 0 ? yields.reduce((sum, value) => sum + value, 0) / yields.length : null,
    buySignals: rows.filter((row) => isNgxBuySignal(row.signal?.label)).length,
  };
}

/** NGX ASI en tête, puis les autres indices principaux, puis le reste. */
export function orderNgxIndices(indices: MarketIndexSnapshot[]): MarketIndexSnapshot[] {
  const rank = (row: MarketIndexSnapshot) => {
    if (row.code.toUpperCase() === "NGX_ASI") return 0;
    return resolveIndexCatalog(row.code, row.name).family === "principal" ? 1 : 2;
  };
  return [...indices].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "fr"));
}

export function toNgxBoardRows(
  shares: NgxShareRow[],
  screener: NgxScreenerData | null,
  t: TFunc
): NgxBoardRow[] {
  const stats = new Map((screener?.rows ?? []).map((row) => [row.ticker, row] as const));
  return shares.map((row) => {
    const stat = stats.get(row.ticker);
    return {
      ticker: row.ticker,
      name: row.name,
      sectorSlug: row.sectorSlug,
      sectorLabel: ngxSectorLabel(row.sectorSlug, row.sectorName, t),
      close: row.close,
      changePercent: row.changePercent,
      marketCapBn: stat?.marketCapBn ?? null,
      fcfa: row.indicativeFcfa,
      return1yPercent: stat?.return1yPercent ?? null,
      yieldPercent: stat?.yieldPercent ?? null,
      spark: screener?.sparks[row.ticker] ?? null,
      score: stat?.overall ?? null,
      scoreMode: stat?.mode ?? null,
      signal: stat?.technical?.signal ?? null,
      confidence: stat?.technical?.confidence ?? null,
      illiquid: stat?.technical?.illiquid ?? false,
    };
  });
}

export function kpisFromBoardRows(rows: NgxBoardRow[]): NgxMarketKpis {
  return computeNgxMarketKpis(
    rows.map((row) => ({
      marketCapBn: row.marketCapBn,
      yieldPercent: row.yieldPercent ?? null,
      signal: row.signal,
    }))
  );
}

export function formatNgxAvgYield(avgYieldPercent: number | null, digits = 2): string {
  if (avgYieldPercent == null || !Number.isFinite(avgYieldPercent)) return "N/D";
  return `${avgYieldPercent.toFixed(digits)}%`;
}
