/**
 * Variation début → fin sur la série réellement affichée (horizon / intervalle).
 * Jamais de chiffre inventé : < 2 points valides → null (N/D à l'UI).
 */

import type { ChartCandle, ChartClosePoint, ChartRange } from "./indicators";

export interface WindowChange {
  /** (dernier − premier) / premier × 100 */
  percent: number;
  /** Dernier − premier, même unité que la série (FCFA si cours bruts). */
  abs: number;
  first: number;
  last: number;
}

function changeFromEnds(first: number, last: number): WindowChange | null {
  if (!(first > 0) || !Number.isFinite(first) || !Number.isFinite(last)) return null;
  const percent = ((last - first) / first) * 100;
  if (!Number.isFinite(percent)) return null;
  return { percent, abs: last - first, first, last };
}

/**
 * Variation clôture → clôture sur les points visibles.
 * Premier et dernier doivent être dans la fenêtre (MAX = toute la série).
 */
export function computeWindowChange(points: ReadonlyArray<ChartClosePoint>): WindowChange | null {
  if (points.length < 2) return null;
  return changeFromEnds(points[0]!.value, points[points.length - 1]!.value);
}

/**
 * Même calcul après agrégation (1S / 1M) : première ouverture → dernière clôture
 * si ≥ 2 bougies ; sinon N/D (une seule barre ne suffit pas).
 */
export function computeWindowChangeFromCandles(
  candles: ReadonlyArray<ChartCandle>
): WindowChange | null {
  if (candles.length < 2) return null;
  const start = candles[0]!.open > 0 ? candles[0]!.open : candles[0]!.close;
  return changeFromEnds(start, candles[candles.length - 1]!.close);
}

/** Libellé FR du KPI, aligné sur les pastilles d'horizon du workbench. */
export function chartRangeChangeLabel(range: ChartRange): string {
  if (range === "MAX") return "Variation Tout";
  return `Variation ${range}`;
}

/**
 * Format FR demandé pour les graphes : +2,35 % / −1,10 % / N/D.
 * Signe moins typographique (U+2212) pour rester lisible à côté du « + ».
 */
export function formatWindowChangePercent(
  value: number | null | undefined,
  digits = 2
): string {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return "N/D";
  const abs = Math.abs(value).toFixed(digits).replace(".", ",");
  if (value > 0) return `+${abs} %`;
  if (value < 0) return `−${abs} %`;
  return `${abs} %`;
}

export function formatWindowChangeAbs(value: number | null | undefined, suffix = " FCFA"): string {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return "N/D";
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString("fr-FR")}${suffix}`;
}
