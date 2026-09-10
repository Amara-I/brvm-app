// Séries d'indicateurs pour le graphique (à partir de clôtures / bougies).

import type { ChartCandle, ChartClosePoint } from "./indicators";
import { computeSma } from "./indicators";
import { computeEmaSeries, computeRsi } from "./technical-indicators";

export function computeEmaPoints(points: ChartClosePoint[], period: number): ChartClosePoint[] {
  const values = points.map((p) => p.value);
  const emas = computeEmaSeries(values, period);
  const out: ChartClosePoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const v = emas[i];
    if (v == null) continue;
    out.push({ time: points[i]!.time, value: Math.round(v * 100) / 100 });
  }
  return out;
}

export function computeBollinger(
  points: ChartClosePoint[],
  period = 20,
  mult = 2
): { mid: ChartClosePoint[]; upper: ChartClosePoint[]; lower: ChartClosePoint[] } {
  const mid = computeSma(points, period);
  const upper: ChartClosePoint[] = [];
  const lower: ChartClosePoint[] = [];
  for (let i = period - 1; i < points.length; i++) {
    const slice = points.slice(i - period + 1, i + 1).map((p) => p.value);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    const t = points[i]!.time;
    upper.push({ time: t, value: Math.round((mean + mult * sd) * 100) / 100 });
    lower.push({ time: t, value: Math.round((mean - mult * sd) * 100) / 100 });
  }
  return { mid, upper, lower };
}

/** RSI série complète (null au début). */
export function computeRsiSeries(points: ChartClosePoint[], period = 14): ChartClosePoint[] {
  const out: ChartClosePoint[] = [];
  for (let i = period; i < points.length; i++) {
    const slice = points.slice(0, i + 1).map((p) => p.value);
    const rsi = computeRsi(slice, period);
    if (rsi == null) continue;
    out.push({ time: points[i]!.time, value: rsi });
  }
  return out;
}

export function computeMacdSeries(
  points: ChartClosePoint[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): { macd: ChartClosePoint[]; signal: ChartClosePoint[]; hist: ChartClosePoint[] } {
  const values = points.map((p) => p.value);
  const emaFast = computeEmaSeries(values, fast);
  const emaSlow = computeEmaSeries(values, slow);
  const macdLine: Array<{ time: string; value: number }> = [];
  for (let i = 0; i < points.length; i++) {
    if (emaFast[i] == null || emaSlow[i] == null) continue;
    macdLine.push({ time: points[i]!.time, value: emaFast[i]! - emaSlow[i]! });
  }
  const signalEma = computeEmaSeries(
    macdLine.map((p) => p.value),
    signalPeriod
  );
  const macd: ChartClosePoint[] = [];
  const signal: ChartClosePoint[] = [];
  const hist: ChartClosePoint[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    const s = signalEma[i];
    if (s == null) continue;
    const m = macdLine[i]!;
    macd.push({ time: m.time, value: Math.round(m.value * 100) / 100 });
    signal.push({ time: m.time, value: Math.round(s * 100) / 100 });
    hist.push({ time: m.time, value: Math.round((m.value - s) * 100) / 100 });
  }
  return { macd, signal, hist };
}

/** On-Balance Volume. */
export function computeObv(candles: ChartCandle[]): ChartClosePoint[] {
  const out: ChartClosePoint[] = [];
  let obv = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]!;
    const vol = c.volume != null && c.volume > 0 ? c.volume : 0;
    if (i === 0) {
      out.push({ time: c.time, value: 0 });
      continue;
    }
    const prev = candles[i - 1]!.close;
    if (c.close > prev) obv += vol;
    else if (c.close < prev) obv -= vol;
    out.push({ time: c.time, value: obv });
  }
  return out;
}

/** Variation de volume vs moyenne mobile 20 (flux relatif). */
export function computeVolumeFlow(
  candles: ChartCandle[],
  period = 20
): ChartClosePoint[] {
  const out: ChartClosePoint[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]!;
    const vol = c.volume != null && c.volume > 0 ? c.volume : 0;
    if (i < period - 1 || vol <= 0) continue;
    const slice = candles.slice(i - period + 1, i + 1);
    const vols = slice.map((x) => (x.volume != null && x.volume > 0 ? x.volume : 0));
    const avg = vols.reduce((a, b) => a + b, 0) / period;
    if (avg <= 0) continue;
    out.push({ time: c.time, value: Math.round((vol / avg) * 100) / 100 });
  }
  return out;
}

function trueRange(high: number, low: number, prevClose: number): number {
  return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
}

/** ADX / +DI / −DI (Wilder, période 14 par défaut) — Guide indicateurs BRVM. */
export function computeAdxSeries(
  candles: ChartCandle[],
  period = 14
): { adx: ChartClosePoint[]; plusDi: ChartClosePoint[]; minusDi: ChartClosePoint[] } {
  const adx: ChartClosePoint[] = [];
  const plusDi: ChartClosePoint[] = [];
  const minusDi: ChartClosePoint[] = [];
  if (candles.length < period + 2) return { adx, plusDi, minusDi };

  const tr: number[] = [];
  const plusDm: number[] = [];
  const minusDm: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i]!;
    const prev = candles[i - 1]!;
    tr.push(trueRange(cur.high, cur.low, prev.close));
    const up = cur.high - prev.high;
    const down = prev.low - cur.low;
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
  }

  let atr = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let smPlus = plusDm.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let smMinus = minusDm.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const dxVals: number[] = [];

  for (let i = period - 1; i < tr.length; i++) {
    if (i > period - 1) {
      atr = (atr * (period - 1) + tr[i]!) / period;
      smPlus = (smPlus * (period - 1) + plusDm[i]!) / period;
      smMinus = (smMinus * (period - 1) + minusDm[i]!) / period;
    }
    const pDi = atr > 0 ? (100 * smPlus) / atr : 0;
    const mDi = atr > 0 ? (100 * smMinus) / atr : 0;
    const sum = pDi + mDi;
    const dx = sum > 0 ? (100 * Math.abs(pDi - mDi)) / sum : 0;
    dxVals.push(dx);
    const t = candles[i + 1]!.time;
    plusDi.push({ time: t, value: Math.round(pDi * 10) / 10 });
    minusDi.push({ time: t, value: Math.round(mDi * 10) / 10 });
  }

  if (dxVals.length < period) return { adx, plusDi, minusDi };
  let adxSm = dxVals.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const adxStart = period - 1;
  adx.push({
    time: plusDi[adxStart]!.time,
    value: Math.round(adxSm * 10) / 10,
  });
  for (let i = period; i < dxVals.length; i++) {
    adxSm = (adxSm * (period - 1) + dxVals[i]!) / period;
    adx.push({
      time: plusDi[i]!.time,
      value: Math.round(adxSm * 10) / 10,
    });
  }
  return { adx, plusDi, minusDi };
}

/** Stochastique %K / %D (14, 3). */
export function computeStochasticSeries(
  candles: ChartCandle[],
  kPeriod = 14,
  dPeriod = 3
): { k: ChartClosePoint[]; d: ChartClosePoint[] } {
  const k: ChartClosePoint[] = [];
  const d: ChartClosePoint[] = [];
  if (candles.length < kPeriod) return { k, d };

  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    let hh = -Infinity;
    let ll = Infinity;
    for (const c of slice) {
      if (c.high > hh) hh = c.high;
      if (c.low < ll) ll = c.low;
    }
    const range = hh - ll;
    const close = candles[i]!.close;
    const kv = range > 0 ? (100 * (close - ll)) / range : 50;
    k.push({ time: candles[i]!.time, value: Math.round(kv * 10) / 10 });
  }

  for (let i = dPeriod - 1; i < k.length; i++) {
    const slice = k.slice(i - dPeriod + 1, i + 1);
    const avg = slice.reduce((a, p) => a + p.value, 0) / dPeriod;
    d.push({ time: k[i]!.time, value: Math.round(avg * 10) / 10 });
  }
  return { k, d };
}

/** Williams %R (période 14) — échelle −100…0. */
export function computeWilliamsRSeries(
  candles: ChartCandle[],
  period = 14
): ChartClosePoint[] {
  const out: ChartClosePoint[] = [];
  if (candles.length < period) return out;
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    let hh = -Infinity;
    let ll = Infinity;
    for (const c of slice) {
      if (c.high > hh) hh = c.high;
      if (c.low < ll) ll = c.low;
    }
    const range = hh - ll;
    const wr = range > 0 ? (-100 * (hh - candles[i]!.close)) / range : -50;
    out.push({ time: candles[i]!.time, value: Math.round(wr * 10) / 10 });
  }
  return out;
}

/** CCI (période 20). */
export function computeCciSeries(candles: ChartCandle[], period = 20): ChartClosePoint[] {
  const out: ChartClosePoint[] = [];
  if (candles.length < period) return out;
  const tp = candles.map((c) => (c.high + c.low + c.close) / 3);
  for (let i = period - 1; i < candles.length; i++) {
    const slice = tp.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const md = slice.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
    const cci = md > 0 ? (tp[i]! - mean) / (0.015 * md) : 0;
    out.push({ time: candles[i]!.time, value: Math.round(cci * 10) / 10 });
  }
  return out;
}

/**
 * Volume moyen journalier sur les `window` dernières séances avec volume > 0.
 * Retourne null si aucune donnée volume fiable.
 */
export function computeAverageDailyVolume(
  points: Array<{ volume?: number | null }>,
  window = 20
): number | null {
  const vols = points
    .map((p) => p.volume)
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  if (vols.length === 0) return null;
  const slice = vols.slice(-Math.min(window, vols.length));
  return Math.round(slice.reduce((a, b) => a + b, 0) / slice.length);
}
