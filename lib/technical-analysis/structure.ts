// Structure de marché (plus hauts / plus bas) et score de timing −100…100.

import { detectSwings, type SwingPoint } from "./support-resistance";
import type { PriceBar, StructureBias, StructureSnapshot } from "./types";
import type { IndicatorSnapshot } from "./indicators";

export function structureFromSwings(swings: SwingPoint[]): { bias: StructureBias; swingLabels: string[] } {
  const labels: string[] = [];
  let prevHigh: number | null = null;
  let prevLow: number | null = null;
  let lastHigh: string | null = null;
  let lastLow: string | null = null;
  for (const swing of swings) {
    if (swing.kind === "high") {
      if (prevHigh != null) {
        const label = swing.price > prevHigh ? "HH" : "LH";
        labels.push(label);
        lastHigh = label;
      }
      prevHigh = swing.price;
    } else {
      if (prevLow != null) {
        const label = swing.price > prevLow ? "HL" : "LL";
        labels.push(label);
        lastLow = label;
      }
      prevLow = swing.price;
    }
  }
  let bias: StructureBias = "neutral";
  if (lastHigh === "HH" && lastLow === "HL") bias = "bullish";
  else if (lastHigh === "LH" && lastLow === "LL") bias = "bearish";
  return { bias, swingLabels: labels.slice(-6) };
}

export function readStructure(bars: PriceBar[], indicators: IndicatorSnapshot): StructureSnapshot {
  const swings = detectSwings(bars);
  const shaped = structureFromSwings(swings);
  const last = bars[bars.length - 1];
  return {
    bias: shaped.bias,
    swingLabels: shaped.swingLabels,
    sma20: indicators.sma20,
    sma50: indicators.sma50,
    sma200: indicators.sma200,
    rsi14: indicators.rsi14,
    macdHistogram: indicators.macdHistogram,
    atr14: indicators.atr14,
    lastClose: last ? last.close : null,
    asOf: last ? last.time : null,
  };
}

/** Score de timing court terme. Positif = pression haussière. */
export function timingScore(structure: StructureSnapshot, bars: PriceBar[]): number {
  const last = structure.lastClose;
  if (last == null || bars.length < 8) return 0;
  let score = 0;
  if (structure.bias === "bullish") score += 28;
  else if (structure.bias === "bearish") score -= 28;

  const { sma20, sma50, sma200, rsi14, macdHistogram } = structure;
  if (sma20 != null && sma50 != null) {
    if (last > sma20 && last > sma50) score += 16;
    else if (last < sma20 && last < sma50) score -= 16;
    if (sma20 > sma50) score += 10;
    else score -= 10;
  } else if (sma20 != null) {
    score += last > sma20 ? 8 : -8;
  }
  if (sma200 != null) score += last > sma200 ? 8 : -8;

  if (rsi14 != null) {
    if (rsi14 < 32) score += structure.bias === "bearish" ? -4 : 10;
    else if (rsi14 > 70) score += structure.bias === "bullish" ? -6 : -14;
    else if (rsi14 >= 50) score += 6;
    else score -= 4;
  }
  if (macdHistogram != null) score += macdHistogram > 0 ? 12 : macdHistogram < 0 ? -12 : 0;

  return Math.max(-100, Math.min(100, Math.round(score)));
}
