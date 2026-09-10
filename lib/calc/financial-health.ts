// Santé financière dérivée des métriques disponibles (pas de PNB/bilan inventés).

import type { CalcMetricsResult } from "./calc-metrics";

export interface FinancialHealthPillar {
  key: "rentabilite" | "croissance" | "solvabilite" | "liquidite";
  label: string;
  score: number; // 0–10
}

export interface FinancialHealth {
  overall: number; // 0–10
  label: "Solide" | "Correcte" | "Fragile" | "N/D";
  pillars: FinancialHealthPillar[];
  note: string;
}

function clamp10(n: number): number {
  return Math.round(Math.min(10, Math.max(0, n)) * 10) / 10;
}

export function computeFinancialHealth(
  metrics: CalcMetricsResult,
  per: number
): FinancialHealth {
  const yieldNum =
    typeof metrics.dividendYieldPercent === "number"
      ? metrics.dividendYieldPercent
      : parseFloat(String(metrics.dividendYieldPercent));
  const perf5 = metrics.perf5Percent === "N/D" ? null : parseFloat(metrics.perf5Percent);
  const vol = metrics.volatilityPercent === "N/D" ? null : parseFloat(metrics.volatilityPercent);

  // Rentabilité : rendement + PER attractif
  let rentabilite = 5;
  if (Number.isFinite(yieldNum)) {
    if (yieldNum >= 6) rentabilite = 9;
    else if (yieldNum >= 4) rentabilite = 8;
    else if (yieldNum >= 2) rentabilite = 6.5;
    else if (yieldNum > 0) rentabilite = 5;
    else rentabilite = 3;
  }
  if (per > 0 && per < 8) rentabilite = Math.min(10, rentabilite + 1);
  else if (per > 25) rentabilite = Math.max(0, rentabilite - 1.5);

  // Croissance : perf 5 ans
  let croissance = 5;
  if (perf5 == null) croissance = 4;
  else if (perf5 >= 80) croissance = 9;
  else if (perf5 >= 40) croissance = 8;
  else if (perf5 >= 15) croissance = 7;
  else if (perf5 >= 0) croissance = 5.5;
  else if (perf5 >= -20) croissance = 3.5;
  else croissance = 2;

  // Solvabilité / risque — privilégie riskAnalysis (LeyInvest) si présent
  let solvabilite = 5;
  const riskScore = metrics.riskAnalysis?.riskScore;
  if (typeof riskScore === "number") {
    // riskScore haut = plus risqué → solvabilité basse (échelle 0–10)
    solvabilite = Math.max(0, Math.min(10, (100 - riskScore) / 10));
  } else if (metrics.riskLevel === "Faible") solvabilite = 8.5;
  else if (metrics.riskLevel === "Moyen") solvabilite = 6.5;
  else if (metrics.riskLevel === "Élevé") solvabilite = 3.5;
  else if (vol != null) {
    if (vol < 10) solvabilite = 8;
    else if (vol < 20) solvabilite = 6.5;
    else solvabilite = 4;
  } else solvabilite = 5;

  // Liquidité / confiance historique
  let liquidite = 5;
  if (metrics.confidence === "Élevée") liquidite = 9;
  else if (metrics.confidence === "Moyenne") liquidite = 7;
  else liquidite = 4.5;
  if (metrics.historyDepth >= 15) liquidite = Math.min(10, liquidite + 1);

  const pillars: FinancialHealthPillar[] = [
    { key: "rentabilite", label: "Rentabilité", score: clamp10(rentabilite) },
    { key: "croissance", label: "Croissance", score: clamp10(croissance) },
    { key: "solvabilite", label: "Solvabilité", score: clamp10(solvabilite) },
    { key: "liquidite", label: "Liquidité", score: clamp10(liquidite) },
  ];

  const overall = clamp10(pillars.reduce((a, p) => a + p.score, 0) / pillars.length);
  const label: FinancialHealth["label"] =
    overall >= 7.5 ? "Solide" : overall >= 5.5 ? "Correcte" : overall > 0 ? "Fragile" : "N/D";

  return {
    overall,
    label,
    pillars,
    note: `Moyenne de ${pillars.length} piliers sur ${pillars.length}, calibrée sur les données BRVM disponibles (score ${metrics.score}/100, confiance ${metrics.confidence}).`,
  };
}
