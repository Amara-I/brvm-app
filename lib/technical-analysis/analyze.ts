// Orchestration pure : clôtures → zones, FVG, structure, scénarios, signal.

import { barsFromCloses, CHART_BARS, recentBars } from "./bars";
import { detectFairValueGaps } from "./fvg";
import { indicatorSnapshot } from "./indicators";
import { assessLiquidity } from "./liquidity";
import { buildScenarios } from "./scenarios";
import { decideSignal } from "./signal";
import { detectSupportResistance } from "./support-resistance";
import { readStructure, timingScore } from "./structure";
import type { CloseInput, TechnicalAnalysis } from "./types";

export function analyzePriceHistory(points: CloseInput[]): TechnicalAnalysis {
  const bars = recentBars(barsFromCloses(points));
  const indicators = indicatorSnapshot(bars);
  const structure = readStructure(bars, indicators);
  const liquidity = assessLiquidity(bars);
  const zones = detectSupportResistance(bars, indicators.atr14);
  const gaps = detectFairValueGaps(bars, indicators.atr14);
  const timing = timingScore(structure, bars);
  const signal = decideSignal(timing, structure, bars.length, liquidity.illiquid);
  const scenarios = buildScenarios(structure, zones, timing, liquidity);
  return {
    barsUsed: bars.length,
    chartBars: bars.slice(-CHART_BARS),
    zones,
    gaps,
    structure,
    liquidity,
    scenarios,
    signal,
  };
}
