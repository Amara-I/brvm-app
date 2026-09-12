// Lookback contigu : ne pas greffer 2008 sur une fenêtre 2021 quand un trou
// de plusieurs mois sépare les deux (sinon SMA/EMA « décalées » vs les bougies).

import type { ChartClosePoint } from "./indicators";
import type { CandleInterval } from "./ohlc-aggregate";

export function parseIsoDay(iso: string): Date {
  const day = iso.slice(0, 10);
  return new Date(`${day}T00:00:00.000Z`);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = parseIsoDay(toIso).getTime() - parseIsoDay(fromIso).getTime();
  return Math.round(ms / 86_400_000);
}

export function subtractUtcDays(iso: string, days: number): string {
  const d = parseIsoDay(iso);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Jours max entre deux points encore considérés comme la même série. */
export function maxGapDaysForInterval(interval: CandleInterval): number {
  switch (interval) {
    case "1H":
      return 3;
    case "1D":
      // Enchaîne des clôtures mensuelles (~30 j) ; coupe un trou annuel.
      return 45;
    case "1W":
      return 21;
    case "1M":
      return 62;
  }
}

/** Jours d'historique à demander avant la fenêtre visible (SMA 20 mensuelle, SMA 200 journalière). */
export function lookbackDaysForInterval(interval: CandleInterval): number {
  switch (interval) {
    case "1M":
      return 1300;
    case "1W":
      return 900;
    case "1H":
    case "1D":
      return 420;
  }
}

export interface ContiguousLookbackResult {
  points: ChartClosePoint[];
  /** true : pas davantage de séances contiguës (trou ou début de série). */
  exhausted: boolean;
}

/**
 * Points strictement avant `windowStart`, en remontant tant que l'écart
 * au point plus récent reste ≤ `maxGapDays`.
 */
export function sliceContiguousLookback(
  points: ChartClosePoint[],
  windowStart: string,
  opts: { maxPoints?: number; maxDays?: number; maxGapDays?: number } = {}
): ContiguousLookbackResult {
  const maxPoints = opts.maxPoints ?? 800;
  const maxDays = opts.maxDays ?? 420;
  const maxGapDays = opts.maxGapDays ?? maxGapDaysForInterval("1D");
  if (points.length === 0 || !windowStart) {
    return { points: [], exhausted: true };
  }

  let idx = points.findIndex((p) => p.time >= windowStart);
  if (idx < 0) idx = points.length;
  if (idx === 0) return { points: [], exhausted: true };

  const minTime = subtractUtcDays(windowStart, maxDays);
  const out: ChartClosePoint[] = [];
  let exhausted = true;

  for (let i = idx - 1; i >= 0; i--) {
    const p = points[i]!;
    const newer = i === idx - 1 ? windowStart : points[i + 1]!.time;
    if (daysBetween(p.time, newer) > maxGapDays) {
      exhausted = true;
      break;
    }
    if (p.time < minTime || out.length >= maxPoints) {
      exhausted = false;
      break;
    }
    out.push(p);
    if (i === 0) exhausted = true;
  }

  return { points: out.reverse(), exhausted };
}

/** Indice de départ (inclus) pour N barres agrégées avant la 1ʳᵉ visible. */
export function contiguousLookbackStart(
  times: string[],
  firstVisibleIdx: number,
  lookbackBars: number,
  interval: CandleInterval
): number {
  if (firstVisibleIdx <= 0 || lookbackBars <= 1) return Math.max(0, firstVisibleIdx);
  const maxGap = maxGapDaysForInterval(interval);
  const limit = Math.max(0, firstVisibleIdx - (lookbackBars - 1));
  let start = firstVisibleIdx;
  for (let i = firstVisibleIdx - 1; i >= limit; i--) {
    if (daysBetween(times[i]!, times[i + 1]!) > maxGap) break;
    start = i;
  }
  return start;
}
