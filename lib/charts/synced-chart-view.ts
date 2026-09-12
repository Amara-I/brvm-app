// Une seule pipeline : agrégation intervalle → fenêtre visible → indicateurs.
// Évite le décalage bougies (série déjà coupée) vs SMA (historique agrégé ailleurs).

import type { ChartCandle, ChartClosePoint } from "./indicators";
import { contiguousLookbackStart } from "./contiguous-lookback";
import {
  aggregateCandles,
  barPeriodEnd,
  candlesToCloses,
  type CandleInterval,
  type AggregateResult,
} from "./ohlc-aggregate";

export function visibleBarRange(
  candles: ChartCandle[],
  visibleFrom: string,
  visibleTo: string,
  interval: CandleInterval
): { first: number; last: number } | null {
  if (candles.length === 0 || !visibleFrom || !visibleTo) return null;
  let first = -1;
  let last = -1;
  for (let i = 0; i < candles.length; i++) {
    const start = candles[i]!.time;
    const end = barPeriodEnd(start, interval);
    if (end >= visibleFrom && start <= visibleTo) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return null;
  return { first, last };
}

function applyPercentToCandles(candles: ChartCandle[], base: number): ChartCandle[] {
  if (!(base > 0)) return candles;
  return candles.map((c) => ({
    time: c.time,
    open: Math.round((c.open / base) * 10000) / 100,
    high: Math.round((c.high / base) * 10000) / 100,
    low: Math.round((c.low / base) * 10000) / 100,
    close: Math.round((c.close / base) * 10000) / 100,
    volume: c.volume,
  }));
}

export interface SyncedChartView {
  candles: ChartCandle[];
  indicatorCloses: ChartClosePoint[];
  indicatorCandles: ChartCandle[];
  hourlyUnavailable: boolean;
  note: string | null;
}

/**
 * Agrège tout l'historique sur l'intervalle, puis découpe la fenêtre visible.
 * SMA/volume utilisent les mêmes timestamps que les bougies.
 */
export function buildSyncedChartView(opts: {
  fullPoints: ChartClosePoint[];
  visibleFrom: string;
  visibleTo: string;
  interval: CandleInterval;
  lookbackBars: number;
  percentScale?: boolean;
}): SyncedChartView {
  const { fullPoints, visibleFrom, visibleTo, interval, lookbackBars, percentScale } = opts;
  const empty: SyncedChartView = {
    candles: [],
    indicatorCloses: [],
    indicatorCandles: [],
    hourlyUnavailable: interval === "1H",
    note: "Aucune donnée (N/D).",
  };
  if (fullPoints.length === 0 || !visibleFrom || !visibleTo) return empty;

  const agg: AggregateResult = aggregateCandles(fullPoints, interval);
  if (agg.candles.length === 0) {
    return { ...empty, hourlyUnavailable: agg.hourlyUnavailable, note: agg.note };
  }

  const span = visibleBarRange(agg.candles, visibleFrom, visibleTo, interval);
  if (!span) {
    return { ...empty, hourlyUnavailable: agg.hourlyUnavailable, note: agg.note };
  }

  const candles = agg.candles.slice(span.first, span.last + 1);
  const start = contiguousLookbackStart(
    agg.candles.map((c) => c.time),
    span.first,
    lookbackBars,
    interval
  );
  let indicatorCandles = agg.candles.slice(start, span.last + 1);

  if (percentScale) {
    const base = candles[0]?.close;
    if (base != null && base > 0) {
      const scaledVisible = applyPercentToCandles(candles, base);
      const scaledInd = applyPercentToCandles(indicatorCandles, base);
      return {
        candles: scaledVisible,
        indicatorCandles: scaledInd,
        indicatorCloses: candlesToCloses(scaledInd),
        hourlyUnavailable: agg.hourlyUnavailable,
        note: agg.note,
      };
    }
  }

  return {
    candles,
    indicatorCandles,
    indicatorCloses: candlesToCloses(indicatorCandles),
    hourlyUnavailable: agg.hourlyUnavailable,
    note: agg.note,
  };
}

/** Série de comparaison : même intervalle et même axe temporel que les bougies. */
export function alignSeriesToInterval(
  points: ChartClosePoint[],
  interval: CandleInterval,
  visibleFrom: string,
  visibleTo: string,
  percentScale = false
): ChartClosePoint[] {
  if (points.length === 0) return [];
  const { candles } = aggregateCandles(points, interval);
  const span = visibleBarRange(candles, visibleFrom, visibleTo, interval);
  if (!span) return [];
  let closes = candlesToCloses(candles.slice(span.first, span.last + 1));
  if (percentScale) {
    const base = closes[0]?.value;
    if (base != null && base > 0) {
      closes = closes.map((p) => ({
        time: p.time,
        value: Math.round((p.value / base) * 10000) / 100,
        volume: p.volume,
      }));
    }
  }
  return closes;
}
