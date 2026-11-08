// ATR Wilder + lectures de moyennes / momentum déjà présentes dans le projet.

import { computeMacd, computeRsi, computeSmaLast } from "@/lib/charts/technical-indicators";
import { roundPrice } from "./bars";
import type { PriceBar } from "./types";

export function computeAtr(bars: PriceBar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const cur = bars[i]!;
    const prev = bars[i - 1]!.close;
    trs.push(Math.max(cur.high - cur.low, Math.abs(cur.high - prev), Math.abs(cur.low - prev)));
  }
  if (trs.length < period) return null;
  let atr = 0;
  for (let i = 0; i < period; i++) atr += trs[i]!;
  atr /= period;
  for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]!) / period;
  return roundPrice(atr);
}

export function closesOf(bars: PriceBar[]): number[] {
  return bars.map((b) => b.close);
}

export interface IndicatorSnapshot {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  macdHistogram: number | null;
  atr14: number | null;
}

export function indicatorSnapshot(bars: PriceBar[]): IndicatorSnapshot {
  const values = closesOf(bars);
  const sma20 = computeSmaLast(values, 20);
  const sma50 = values.length >= 50 ? computeSmaLast(values, 50) : null;
  const sma200 = values.length >= 200 ? computeSmaLast(values, 200) : null;
  const macd = computeMacd(values);
  return {
    sma20: sma20 == null ? null : roundPrice(sma20),
    sma50: sma50 == null ? null : roundPrice(sma50),
    sma200: sma200 == null ? null : roundPrice(sma200),
    rsi14: computeRsi(values, 14),
    macdHistogram: macd ? macd.histogram : null,
    atr14: computeAtr(bars, 14),
  };
}
