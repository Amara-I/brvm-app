// Signal et confiance de la vue d'ensemble NGX, construits comme sur la BRVM :
//  - même matrice de décision (`signalFromComposite` : score composite × niveau de risque),
//  - mêmes plafonds selon la confiance (Faible : pas d'ACHAT FORT ni de VENDRE ; Moyenne : pas d'ACHAT FORT).
// Entrées : la note globale NGX (/100, la même que le screener et la fiche), le pilier « risque » de cette note
// et la confiance de la note. Sans note, aucun signal (N/D) : on n'invente rien.

import { signalFromComposite, signalOf, type CalcMetricsResult } from "@/lib/calc/calc-metrics";
import type { NgxScoreConfidence } from "./score";

export type NgxSignal = CalcMetricsResult["signal"];
export type NgxOverviewConfidence = CalcMetricsResult["confidence"];

const CONFIDENCE_LABEL: Record<NgxScoreConfidence, NgxOverviewConfidence> = {
  HIGH: "Élevée",
  MEDIUM: "Moyenne",
  LOW: "Faible",
};

export function ngxConfidenceLabel(confidence: NgxScoreConfidence): NgxOverviewConfidence {
  return CONFIDENCE_LABEL[confidence];
}

/**
 * Niveau de risque 0–100 (plus haut = plus risqué) tiré du pilier « risque » de la note NGX
 * (où un score élevé veut dire un risque faible). Pilier indisponible → 50 (neutre).
 */
export function ngxRiskLevel(riskPillarScore: number | null): number {
  if (riskPillarScore == null || !Number.isFinite(riskPillarScore)) return 50;
  return Math.min(100, Math.max(0, Math.round(100 - riskPillarScore)));
}

export function ngxSignal(
  overall: number | null,
  riskPillarScore: number | null,
  confidence: NgxScoreConfidence,
): NgxSignal | null {
  if (overall == null || !Number.isFinite(overall)) return null;
  let signal = signalFromComposite(overall, ngxRiskLevel(riskPillarScore));
  if (confidence === "LOW") {
    if (signal.label === "ACHAT FORT") signal = signalOf("ACHAT");
    else if (signal.label === "VENDRE") signal = signalOf("ALLÉGER");
  } else if (confidence === "MEDIUM" && signal.label === "ACHAT FORT") {
    signal = signalOf("ACHAT");
  }
  return signal;
}
