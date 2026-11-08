// Niveaux réutilisables (entrée, invalidation, cibles, risque/rendement).
// Le sizing de position importe `technicalLevels` sans connaître le graphe.

import type { ScenarioBias, ScenarioPlan, TechnicalAnalysis, TechnicalLevels } from "./types";

function planFor(analysis: TechnicalAnalysis): ScenarioPlan | null {
  const label = analysis.signal.label;
  const bias: ScenarioBias =
    label === "ACHAT FORT" || label === "ACHAT" ? "bullish" : label === "ALLÉGER" || label === "VENDRE" ? "bearish" : "neutral";
  return analysis.scenarios.find((scenario) => scenario.bias === bias) ?? analysis.scenarios[0] ?? null;
}

export function technicalLevels(analysis: TechnicalAnalysis): TechnicalLevels {
  const plan = planFor(analysis);
  const invalidation = plan?.invalidation ?? null;
  return {
    asOf: analysis.structure.asOf,
    lastClose: analysis.structure.lastClose,
    atr14: analysis.structure.atr14,
    bias: plan?.bias ?? "neutral",
    signal: analysis.signal.label,
    confidence: analysis.signal.confidence,
    entryLow: plan?.entryLow ?? null,
    entryHigh: plan?.entryHigh ?? null,
    invalidation,
    stop: invalidation,
    targets: plan?.targets ?? [],
    riskReward: plan?.riskReward ?? null,
  };
}
