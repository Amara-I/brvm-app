// Lookback indicateurs : calculer SMA/EMA/… sur l'historique hors fenêtre visible,
// puis ne tracer que la période demandée (comportement type TradingView).

import type { ChartCandle, ChartClosePoint } from "./indicators";
import { aggregateCandles, candlesToCloses, type CandleInterval } from "./ohlc-aggregate";

export function clipPointsToRange(
  points: ChartClosePoint[],
  fromTime: string,
  toTime: string
): ChartClosePoint[] {
  if (!fromTime || !toTime) return points;
  return points.filter((p) => p.time >= fromTime && p.time <= toTime);
}

export function clipCandlesToRange(
  candles: ChartCandle[],
  fromTime: string,
  toTime: string
): ChartCandle[] {
  if (!fromTime || !toTime) return candles;
  return candles.filter((c) => c.time >= fromTime && c.time <= toTime);
}

/**
 * Fenêtre de clôtures (agrégées) incluant `lookbackBars - 1` barres avant
 * le début visible, pour que SMA N soit défini dès la 1ʳᵉ bougie affichée
 * dès que l'historique le permet.
 */
export function buildIndicatorWindow(opts: {
  fullPoints: ChartClosePoint[];
  visibleFrom: string;
  visibleTo: string;
  interval: CandleInterval;
  lookbackBars: number;
  percentScale?: boolean;
}): { closes: ChartClosePoint[]; candles: ChartCandle[] } {
  const { fullPoints, visibleFrom, visibleTo, interval, lookbackBars, percentScale } = opts;
  if (fullPoints.length === 0 || !visibleFrom || !visibleTo) {
    return { closes: [], candles: [] };
  }

  const { candles: all } = aggregateCandles(fullPoints, interval);
  if (all.length === 0) return { closes: [], candles: [] };

  let idxFirst = all.findIndex((c) => c.time >= visibleFrom);
  if (idxFirst < 0) idxFirst = 0;

  let idxLast = all.length - 1;
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i]!.time <= visibleTo) {
      idxLast = i;
      break;
    }
  }
  if (idxLast < idxFirst) idxLast = idxFirst;

  const start = Math.max(0, idxFirst - Math.max(0, lookbackBars - 1));
  const windowCandles = all.slice(start, idxLast + 1);
  let closes = candlesToCloses(windowCandles);

  if (percentScale) {
    const base = all[idxFirst]?.close;
    if (base != null && base > 0) {
      closes = closes.map((p) => ({
        time: p.time,
        value: Math.round((p.value / base) * 10000) / 100,
        volume: p.volume,
      }));
    }
  }

  return { closes, candles: windowCandles };
}
