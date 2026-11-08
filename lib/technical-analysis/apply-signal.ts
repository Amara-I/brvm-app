// Remplace le signal composite BRVM par le signal technique.
// Le score (qualité de la société) n'est pas modifié.

import type { SignalReason, TradeSignal } from "@/lib/calc/calc-metrics";
import { analyzePriceHistoryCached } from "./cache";
import { signalReasons, technicalSummary, toTradeSignal } from "./signal";
import type { CloseInput, ConfidenceLevel, TechnicalAnalysis } from "./types";

export interface TechnicalSignalPatch {
  signal: TradeSignal;
  confidence: ConfidenceLevel;
  signalSummary: string;
  signalReasons: SignalReason[];
  liquidityWarningFr: string | null;
  liquidityWarningEn: string | null;
}

type SignalCarrier = {
  score: number;
  signal: TradeSignal;
  confidence: ConfidenceLevel;
  signalSummary: string;
  signalReasons: SignalReason[];
};

export function patchFromAnalysis(analysis: TechnicalAnalysis, qualityScore: number): TechnicalSignalPatch {
  return {
    signal: toTradeSignal(analysis.signal.label),
    confidence: analysis.signal.confidence,
    signalSummary: technicalSummary(
      analysis.signal.label,
      qualityScore,
      analysis.signal.confidence,
      analysis.liquidity.warningFr
    ),
    signalReasons: signalReasons(analysis),
    liquidityWarningFr: analysis.liquidity.warningFr,
    liquidityWarningEn: analysis.liquidity.warningEn,
  };
}

export function technicalSignalPatch(qualityScore: number, closes: CloseInput[] | null | undefined): TechnicalSignalPatch {
  return patchFromAnalysis(analyzePriceHistoryCached(closes ?? []), qualityScore);
}

export function applyTechnicalSignal<T extends SignalCarrier>(metrics: T, closes: CloseInput[] | null | undefined): T {
  const patch = technicalSignalPatch(metrics.score, closes);
  return {
    ...metrics,
    signal: patch.signal,
    confidence: patch.confidence,
    signalSummary: patch.signalSummary,
    signalReasons: patch.signalReasons,
  };
}
