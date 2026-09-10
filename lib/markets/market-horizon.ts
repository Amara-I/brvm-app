// Filtres d'horizon pour les aperçus sparkline du marché.

import type { ChartClosePoint } from "@/lib/charts/indicators";

export type MarketHorizon = "1J" | "1S" | "1M" | "3M" | "6M" | "1A" | "3A" | "MAX";

export const MARKET_HORIZON_OPTIONS: Array<{ value: MarketHorizon; label: string }> = [
  { value: "1J", label: "Jour" },
  { value: "1S", label: "Semaine" },
  { value: "1M", label: "Mois" },
  { value: "3M", label: "3 mois" },
  { value: "6M", label: "6 mois" },
  { value: "1A", label: "1 an" },
  { value: "3A", label: "3 ans" },
  { value: "MAX", label: "Tout" },
];

/** Horizons qui exigent une densité journalière / hebdo — pas de repli annuel trompeur. */
const STRICT_SHORT: ReadonlySet<MarketHorizon> = new Set(["1J", "1S", "1M", "3M", "6M"]);

function cutoffIso(horizon: Exclude<MarketHorizon, "MAX">, asOf: Date): string {
  const cutoff = new Date(asOf);
  switch (horizon) {
    case "1J":
      cutoff.setUTCDate(cutoff.getUTCDate() - 1);
      break;
    case "1S":
      cutoff.setUTCDate(cutoff.getUTCDate() - 7);
      break;
    case "1M":
      cutoff.setUTCMonth(cutoff.getUTCMonth() - 1);
      break;
    case "3M":
      cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
      break;
    case "6M":
      cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
      break;
    case "1A":
      cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
      break;
    case "3A":
      cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 3);
      break;
  }
  return cutoff.toISOString().slice(0, 10);
}

/**
 * Filtre strict sur la fenêtre demandée.
 * - Horizons courts : si < 2 points dans la fenêtre → [] (N/D), jamais un repli
 *   multi-années qui faussait la variation affichée.
 * - 1A / 3A : si la fenêtre est trop creuse (historique surtout annuel), on
 *   prend les 2 derniers points dont la date de début est au plus ~2× l'horizon,
 *   sinon [].
 */
export function filterSeriesByHorizon(
  points: ChartClosePoint[],
  horizon: MarketHorizon,
  asOf = new Date()
): ChartClosePoint[] {
  if (points.length === 0) return [];
  if (horizon === "MAX") return points;

  const isoAsOf = asOf.toISOString().slice(0, 10);
  const iso = cutoffIso(horizon, asOf);
  const filtered = points.filter((p) => p.time >= iso && p.time <= isoAsOf);
  if (filtered.length >= 2) return filtered;

  if (STRICT_SHORT.has(horizon)) return [];

  // 1A / 3A : historique annuel sparse — accepter les 2 derniers points s'ils
  // couvrent au plus le double de l'horizon (évite d'afficher 10 ans sous "1 an").
  if (points.length < 2) return [];
  const lastTwo = points.slice(-2);
  const spanDays =
    (new Date(`${lastTwo[1]!.time}T00:00:00Z`).getTime() -
      new Date(`${lastTwo[0]!.time}T00:00:00Z`).getTime()) /
    (24 * 3600 * 1000);
  const maxDays = horizon === "1A" ? 366 * 2 : 366 * 6;
  if (spanDays <= maxDays && lastTwo[1]!.time <= isoAsOf) return lastTwo;
  return [];
}

/** Repli depuis le dataset annuel si aucune série datée n'est fournie. */
export function annualSeriesFromPrices(
  prices: Record<number, number>,
  years: number[],
  asOf = new Date()
): ChartClosePoint[] {
  const yNow = asOf.getUTCFullYear();
  const today = asOf.toISOString().slice(0, 10);
  return years
    .filter((y) => (prices[y] ?? 0) > 0)
    .map((y) => ({
      // Année courante → aujourd'hui (pas le 31/12 futur, qui sortait de la fenêtre).
      time: y >= yNow ? today : `${y}-12-31`,
      value: prices[y]!,
      volume: null,
    }));
}

export function horizonChangePercent(points: ChartClosePoint[]): number | null {
  if (points.length < 2) return null;
  const first = points[0]!.value;
  const last = points[points.length - 1]!.value;
  if (!(first > 0)) return null;
  return Math.round(((last - first) / first) * 1000) / 10;
}

/**
 * Amplitude max sur la fenêtre (haut − bas) / bas — variation maximale
 * observée sur le cours, indépendante du sens début→fin.
 */
export function horizonMaxVariationPercent(points: ChartClosePoint[]): number | null {
  if (points.length < 2) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    if (p.value < min) min = p.value;
    if (p.value > max) max = p.value;
  }
  if (!(min > 0) || !Number.isFinite(min) || !Number.isFinite(max)) return null;
  return Math.round(((max - min) / min) * 1000) / 10;
}

/**
 * Plus forte variation relative entre deux points consécutifs (en %),
 * signe conservé (hausse ou baisse max).
 */
export function horizonMaxDailyVariationPercent(points: ChartClosePoint[]): number | null {
  if (points.length < 2) return null;
  let bestAbs = -1;
  let bestSigned = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!.value;
    const cur = points[i]!.value;
    if (!(prev > 0)) continue;
    const signed = ((cur - prev) / prev) * 100;
    const abs = Math.abs(signed);
    if (abs > bestAbs) {
      bestAbs = abs;
      bestSigned = signed;
    }
  }
  if (bestAbs < 0) return null;
  return Math.round(bestSigned * 10) / 10;
}
