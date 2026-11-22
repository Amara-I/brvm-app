// Orchestration pure : clôtures → zones, FVG, structure, scénarios, signal.

import { barsFromCloses, CHART_BARS, recentBars, SIGNAL_WINDOW } from "./bars";
import { detectFairValueGaps } from "./fvg";
import { indicatorSnapshot } from "./indicators";
import { assessLiquidity } from "./liquidity";
import { buildScenarios } from "./scenarios";
import { decideSignal } from "./signal";
import { detectSupportResistance } from "./support-resistance";
import { readStructure } from "./structure";
import { assessTiming, DEFAULT_TIMING_PARAMS, type TimingParams } from "./timing";
import { DEFAULT_ENTRY_PARAMS, detectEntry, type EntryParams } from "./entry-triggers";
import type { CloseInput, PriceCurrency, TechnicalAnalysis } from "./types";

export interface AnalyzeOptions {
  /** Devise des libellés de prix. Défaut : FCFA (BRVM). */
  currency?: PriceCurrency;
  /** Réglages du timing (backtest uniquement). */
  timingParams?: TimingParams;
  /** Réglages des déclencheurs d'entrée (backtest uniquement). */
  entryParams?: EntryParams;
}

export function analyzePriceHistory(points: CloseInput[], options: AnalyzeOptions = {}): TechnicalAnalysis {
  const currency: PriceCurrency = options.currency ?? "XOF";
  const bars = recentBars(barsFromCloses(points));
  // Signal : mêmes ~13 mois de séances partout (fiche, listes, alertes), quelle que
  // soit la profondeur de la série reçue. Zones et gaps gardent la fenêtre longue.
  const signalBars = recentBars(bars, SIGNAL_WINDOW);
  const indicators = indicatorSnapshot(signalBars);
  const structure = readStructure(signalBars, indicators);
  const liquidity = assessLiquidity(signalBars);
  const zones = detectSupportResistance(bars, indicators.atr14);
  const gaps = detectFairValueGaps(bars, indicators.atr14);
  const timing = assessTiming(signalBars, structure, options.timingParams ?? DEFAULT_TIMING_PARAMS);
  const entry = detectEntry(signalBars, options.entryParams ?? DEFAULT_ENTRY_PARAMS);
  const signal = decideSignal(timing, structure, signalBars.length, liquidity.illiquid, entry);
  const scenarios = buildScenarios(structure, zones, timing.score, liquidity, currency);
  return {
    currency,
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
