// Clôtures → bougies. Sans OHLC réel, O = clôture précédente (même règle que le graphe).

import { closesToCandles } from "@/lib/charts/indicators";
import type { CloseInput, PriceBar } from "./types";

export const ANALYSIS_WINDOW = 900;
export const CHART_BARS = 90;
/**
 * Séances lues pour le signal (indicateurs, structure, timing) : ~13 mois.
 * L'aperçu SPARK des listes garde au moins ces séances journalières, pour que
 * la fiche, les listes et les alertes affichent le même signal.
 */
export const SIGNAL_WINDOW = 260;

export function roundPrice(n: number): number {
  return Math.round(n * 100) / 100;
}

export function barsFromCloses(points: CloseInput[]): PriceBar[] {
  return closesToCandles(
    points.map((p) => ({
      time: p.time,
      value: p.value,
      volume: p.volume ?? null,
    }))
  ).map((c) => ({
    time: c.time.slice(0, 10),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));
}

export function recentBars(bars: PriceBar[], max = ANALYSIS_WINDOW): PriceBar[] {
  if (bars.length <= max) return bars;
  return bars.slice(bars.length - max);
}
