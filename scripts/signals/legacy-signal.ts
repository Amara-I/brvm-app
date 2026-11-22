// Copie figée du signal technique AVANT la PR « timing des signaux »
// (structure + timing + decideSignal), pour comparer dans le backtest.
// Ne pas importer depuis l'application.

import { computeMacd, computeRsi, computeSmaLast } from "@/lib/charts/technical-indicators";
import { barsFromCloses, recentBars, roundPrice } from "@/lib/technical-analysis/bars";
import { computeAtr } from "@/lib/technical-analysis/indicators";
import { assessLiquidity } from "@/lib/technical-analysis/liquidity";
import { detectSwings } from "@/lib/technical-analysis/support-resistance";
import type { CloseInput, PriceBar } from "@/lib/technical-analysis/types";

type Label = "ACHAT FORT" | "ACHAT" | "CONSERVER" | "ALLÉGER" | "VENDRE";
type Bias = "bullish" | "bearish" | "neutral";

function biasOf(bars: PriceBar[]): Bias {
  let prevHigh: number | null = null;
  let prevLow: number | null = null;
  let lastHigh: string | null = null;
  let lastLow: string | null = null;
  for (const s of detectSwings(bars)) {
    if (s.kind === "high") {
      if (prevHigh != null) lastHigh = s.price > prevHigh ? "HH" : "LH";
      prevHigh = s.price;
    } else {
      if (prevLow != null) lastLow = s.price > prevLow ? "HL" : "LL";
      prevLow = s.price;
    }
  }
  if (lastHigh === "HH" && lastLow === "HL") return "bullish";
  if (lastHigh === "LH" && lastLow === "LL") return "bearish";
  return "neutral";
}

export function legacySignalLabel(points: CloseInput[]): Label {
  const bars = recentBars(barsFromCloses(points));
  const values = bars.map((b) => b.close);
  const r = (x: number | null) => (x == null ? null : roundPrice(x));
  const sma20 = r(computeSmaLast(values, 20));
  const sma50 = values.length >= 50 ? r(computeSmaLast(values, 50)) : null;
  const sma200 = values.length >= 200 ? r(computeSmaLast(values, 200)) : null;
  const rsi14 = computeRsi(values, 14);
  const macd = computeMacd(values);
  const atr14 = computeAtr(bars, 14);
  const bias = biasOf(bars);
  const illiquid = assessLiquidity(bars).illiquid;
  const last = values[values.length - 1];

  let timing = 0;
  if (last != null && bars.length >= 8) {
    if (bias === "bullish") timing += 28;
    else if (bias === "bearish") timing -= 28;
    if (sma20 != null && sma50 != null) {
      if (last > sma20 && last > sma50) timing += 16;
      else if (last < sma20 && last < sma50) timing -= 16;
      timing += sma20 > sma50 ? 10 : -10;
    } else if (sma20 != null) timing += last > sma20 ? 8 : -8;
    if (sma200 != null) timing += last > sma200 ? 8 : -8;
    if (rsi14 != null) {
      if (rsi14 < 32) timing += bias === "bearish" ? -4 : 10;
      else if (rsi14 > 70) timing += bias === "bullish" ? -6 : -14;
      else if (rsi14 >= 50) timing += 6;
      else timing -= 4;
    }
    const h = macd?.histogram ?? null;
    if (h != null) timing += h > 0 ? 12 : h < 0 ? -12 : 0;
    timing = Math.max(-100, Math.min(100, Math.round(timing)));
  }

  let label: Label = "CONSERVER";
  if (timing >= 58 && bias === "bullish" && (rsi14 == null || rsi14 < 72)) label = "ACHAT FORT";
  else if (timing >= 26) label = "ACHAT";
  else if (timing <= -58 && bias === "bearish" && (rsi14 == null || rsi14 > 28)) label = "VENDRE";
  else if (timing <= -26) label = "ALLÉGER";

  const n = bars.length;
  const aligned =
    (label === "ACHAT FORT" || label === "ACHAT") && bias === "bullish"
      ? true
      : (label === "VENDRE" || label === "ALLÉGER") && bias === "bearish"
        ? true
        : label === "CONSERVER";
  const confidence =
    illiquid || n < 40 ? "Faible" : n >= 120 && aligned && atr14 != null ? "Élevée" : n >= 60 ? "Moyenne" : "Faible";
  const down = (l: Label): Label => (l === "ACHAT FORT" ? "ACHAT" : l === "VENDRE" ? "ALLÉGER" : l);
  if (illiquid) {
    if (Math.abs(timing) < 20) label = "CONSERVER";
    else if (label === "ACHAT FORT") label = "ACHAT";
    else if (label === "VENDRE") label = "ALLÉGER";
  } else if (confidence !== "Élevée") {
    label = down(label);
    if (confidence === "Faible") label = down(label);
  }
  return label;
}
