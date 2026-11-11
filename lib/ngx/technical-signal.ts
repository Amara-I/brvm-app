// Signal NGX = signal technique, comme sur la BRVM (lib/technical-analysis).
// La note NGX /100 (lib/ngx/score.ts) est inchangée : elle mesure la qualité de la société,
// le signal décrit le timing du cours. Prix et libellés en naira (₦).
//
// La vue d'ensemble, l'écran de tri, les alertes et la fiche lisent la même fenêtre de clôtures
// (≈ 1 an + 420 jours, comme le cache `chart_series` 1A) pour afficher le même signal partout.

import { CHART_CACHE_LOOKBACK_PAD_DAYS } from "@/lib/charts/chart-series-cache";
import type { TradeSignal } from "@/lib/calc/calc-metrics";
import { analyzePriceHistoryCached } from "@/lib/technical-analysis/cache";
import type { CloseInput, ConfidenceLevel, TechnicalAnalysis } from "@/lib/technical-analysis/types";
import { signalOf } from "@/lib/calc/calc-metrics";

export const NGX_SIGNAL_WINDOW_DAYS = 365 + CHART_CACHE_LOOKBACK_PAD_DAYS;

export interface NgxTechnicalSignal {
  signal: TradeSignal;
  confidence: ConfidenceLevel;
  /** Titre peu liquide : confiance basse, pas de signal fort. */
  illiquid: boolean;
  liquidityWarningFr: string | null;
  liquidityWarningEn: string | null;
  /** Clôtures lues. */
  bars: number;
}

/** Clôtures valides, triées, limitées à la fenêtre partagée. */
export function ngxSignalWindow(points: readonly CloseInput[]): CloseInput[] {
  const sorted = points
    .filter((p) => Number.isFinite(p.value) && p.value > 0 && /^\d{4}-\d{2}-\d{2}/.test(p.time))
    .map((p) => ({ time: p.time.slice(0, 10), value: p.value, volume: p.volume ?? null }))
    .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  const last = sorted[sorted.length - 1];
  if (!last) return [];
  const from = new Date(`${last.time}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - NGX_SIGNAL_WINDOW_DAYS);
  const iso = from.toISOString().slice(0, 10);
  return sorted.filter((p) => p.time >= iso);
}

/** Analyse technique NGX (₦) sur la fenêtre partagée. */
export function ngxTechnicalAnalysis(points: readonly CloseInput[]): TechnicalAnalysis {
  return analyzePriceHistoryCached(ngxSignalWindow(points), { currency: "NGN" });
}

/** Signal technique NGX. null si aucune clôture : N/D, rien n'est inventé. */
export function ngxTechnicalSignal(points: readonly CloseInput[] | null | undefined): NgxTechnicalSignal | null {
  const window = ngxSignalWindow(points ?? []);
  if (window.length === 0) return null;
  const analysis = analyzePriceHistoryCached(window, { currency: "NGN" });
  return {
    signal: signalOf(analysis.signal.label),
    confidence: analysis.signal.confidence,
    illiquid: analysis.liquidity.illiquid,
    liquidityWarningFr: analysis.liquidity.warningFr,
    liquidityWarningEn: analysis.liquidity.warningEn,
    bars: analysis.barsUsed,
  };
}
