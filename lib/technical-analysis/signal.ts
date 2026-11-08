// Signal ACHAT FORT … VENDRE issu uniquement du timing technique.
// Le score qualité (calcMetrics) n'entre pas dans le libellé.

import type { SignalReason, TradeSignal } from "@/lib/calc/calc-metrics";
import { signalOf } from "@/lib/calc/calc-metrics";
import type { SignalReasonCode } from "@/lib/calc/signal-reason-codes";
import type { ConfidenceLevel, StructureSnapshot, TechnicalAnalysis, TechnicalSignal } from "./types";

const SIGNAL_RANK: Record<TradeSignal["label"], number> = {
  "ACHAT FORT": 2,
  ACHAT: 1,
  CONSERVER: 0,
  ALLÉGER: -1,
  VENDRE: -2,
};

function downgrade(label: TradeSignal["label"]): TradeSignal["label"] {
  if (label === "ACHAT FORT") return "ACHAT";
  if (label === "VENDRE") return "ALLÉGER";
  return label;
}

function confidenceFor(bars: number, label: TradeSignal["label"], structure: StructureSnapshot, illiquid: boolean): ConfidenceLevel {
  if (illiquid || bars < 40) return "Faible";
  const aligned =
    (label === "ACHAT FORT" || label === "ACHAT") && structure.bias === "bullish"
      ? true
      : (label === "VENDRE" || label === "ALLÉGER") && structure.bias === "bearish"
        ? true
        : label === "CONSERVER";
  if (bars >= 120 && aligned && structure.atr14 != null) return "Élevée";
  if (bars >= 60) return "Moyenne";
  return "Faible";
}

export function decideSignal(timing: number, structure: StructureSnapshot, bars: number, illiquid: boolean): TechnicalSignal {
  const rsi = structure.rsi14;
  let label: TradeSignal["label"] = "CONSERVER";
  if (timing >= 58 && structure.bias === "bullish" && (rsi == null || rsi < 72)) label = "ACHAT FORT";
  else if (timing >= 26) label = "ACHAT";
  else if (timing <= -58 && structure.bias === "bearish" && (rsi == null || rsi > 28)) label = "VENDRE";
  else if (timing <= -26) label = "ALLÉGER";

  let confidence = confidenceFor(bars, label, structure, illiquid);
  if (illiquid) {
    confidence = "Faible";
    if (Math.abs(timing) < 20) label = "CONSERVER";
    else if (SIGNAL_RANK[label] > 0) label = "ACHAT";
    else if (SIGNAL_RANK[label] < 0) label = "ALLÉGER";
    if (label === "ACHAT FORT" || label === "VENDRE") label = "CONSERVER";
  } else if (confidence !== "Élevée") {
    label = downgrade(label);
    if (confidence === "Faible" && (label === "ACHAT FORT" || label === "VENDRE")) label = downgrade(label);
  }
  if (confidence === "Faible" && !illiquid && (label === "ACHAT FORT" || label === "VENDRE")) {
    label = downgrade(label);
  }
  return { label, timingScore: timing, confidence };
}

function reason(
  kind: SignalReason["kind"],
  code: SignalReasonCode,
  text: string,
  params?: Record<string, string | number>
): SignalReason {
  return params ? { kind, code, text, params } : { kind, code, text };
}

export function signalReasons(analysis: TechnicalAnalysis): SignalReason[] {
  const { structure, liquidity, signal } = analysis;
  const reasons: SignalReason[] = [];
  if (structure.bias === "bullish") {
    reasons.push(reason("positif", "ta.structureBull", "Structure haussière : plus hauts et plus bas ascendants."));
  } else if (structure.bias === "bearish") {
    reasons.push(reason("negatif", "ta.structureBear", "Structure baissière : plus hauts et plus bas descendants."));
  } else {
    reasons.push(reason("neutre", "ta.structureRange", "Structure mixte : pas de séquence claire de plus hauts et plus bas."));
  }

  const rsi = structure.rsi14 == null ? "N/D" : String(structure.rsi14);
  const hist = structure.macdHistogram == null ? "N/D" : String(structure.macdHistogram);
  reasons.push(
    reason(
      structure.macdHistogram == null ? "neutre" : structure.macdHistogram > 0 ? "positif" : "negatif",
      "ta.momentum",
      `Momentum : RSI(14) ${rsi}, histogramme MACD ${hist}.`,
      { rsi, hist }
    )
  );

  const support = [...analysis.zones].filter((z) => z.kind === "support").sort((a, b) => b.strength - a.strength)[0];
  const resistance = [...analysis.zones].filter((z) => z.kind === "resistance").sort((a, b) => b.strength - a.strength)[0];
  const zone = signal.label === "ALLÉGER" || signal.label === "VENDRE" ? resistance ?? support : support ?? resistance;
  if (zone) {
    const code = zone.kind === "resistance" ? "ta.resistanceReaction" : "ta.supportReaction";
    const text =
      zone.kind === "resistance"
        ? `Résistance vers ${Math.round(zone.mid).toLocaleString("fr-FR")} FCFA : ${zone.touches} tests, ${zone.bounces} rejets, ${zone.breaks} dépassements.`
        : `Support vers ${Math.round(zone.mid).toLocaleString("fr-FR")} FCFA : ${zone.touches} tests, ${zone.bounces} rebonds, ${zone.breaks} cassures.`;
    reasons.push(
      reason(zone.bounces > zone.breaks ? "positif" : zone.breaks > zone.bounces ? "negatif" : "neutre", code, text, {
        price: Math.round(zone.mid),
        touches: zone.touches,
        bounces: zone.bounces,
        breaks: zone.breaks,
      })
    );
  }

  if (liquidity.warningFr && liquidity.warningEn) {
    reasons.push(reason("negatif", "ta.liquidity", liquidity.warningFr, { warning: liquidity.warningEn }));
  } else if (liquidity.bars < 40) {
    reasons.push(
      reason(
        "neutre",
        "ta.history",
        `Seulement ${liquidity.bars} clôtures journalières : la confiance reste basse.`,
        { bars: liquidity.bars }
      )
    );
  }
  return reasons;
}

export function technicalSummary(label: TradeSignal["label"], qualityScore: number, confidence: ConfidenceLevel, warningFr: string | null): string {
  const base = `Signal technique : ${label} (score qualité ${qualityScore}/100, confiance ${confidence}). Le score mesure la qualité de la société ; ce signal décrit le timing de court terme du cours.`;
  return warningFr ? `${base} ${warningFr}` : base;
}

export function toTradeSignal(label: TradeSignal["label"]): TradeSignal {
  return signalOf(label);
}
