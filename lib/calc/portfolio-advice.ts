// Conseils portefeuille : Renforcer / Conserver / Sortir
// Combine le signal calcMetrics et le score d'horizon déclaré par l'utilisateur.

import type { TradeSignal, HorizonScores, SignalReason } from "@/lib/calc/calc-metrics";

export type BuyHorizonCode = "COURT" | "MOYEN" | "LONG";

export type PortfolioAdviceAction = "RENFORCER" | "CONSERVER" | "SORTIR";

export interface PortfolioAdvice {
  action: PortfolioAdviceAction;
  label: string;
  color: string;
  /** Signal brut de l'analyse (ACHAT FORT / … / VENDRE). */
  signalLabel: TradeSignal["label"] | "N/D";
  /** Score 0–100 de l'horizon choisi, ou null si indisponible. */
  horizonScore: number | null;
  summary: string;
  reasons: string[];
}

const ACTION_META: Record<PortfolioAdviceAction, { label: string; color: string }> = {
  RENFORCER: { label: "Renforcer", color: "#22C55E" },
  CONSERVER: { label: "Conserver", color: "#D4A843" },
  SORTIR: { label: "Sortir / Alléger", color: "#EF4444" },
};

export function horizonScoreFor(
  horizon: BuyHorizonCode,
  scores: HorizonScores | null | undefined
): number | null {
  if (!scores) return null;
  if (horizon === "COURT") return scores.court;
  if (horizon === "LONG") return scores.long;
  return scores.moyen;
}

/**
 * Mappe signal d'analyse + score d'horizon → action portefeuille.
 * Règles (pures, testables) :
 * - Signal ACHAT FORT / ACHAT et score horizon ≥ 40 → Renforcer
 * - Signal VENDRE / ALLÉGER → Sortir / Alléger
 * - CONSERVER + score < 40 → Sortir ; CONSERVER + score ≥ 70 → Renforcer
 * - Score d'horizon < 35 prime sur un Renforcer
 */
export function adviseHolding(input: {
  buyHorizon: BuyHorizonCode;
  signal: TradeSignal | null;
  horizonScores: HorizonScores | null;
  signalSummary?: string | null;
  signalReasons?: SignalReason[] | null;
}): PortfolioAdvice {
  const horizonScore = horizonScoreFor(input.buyHorizon, input.horizonScores);
  const signalLabel = input.signal?.label ?? "N/D";

  let action: PortfolioAdviceAction = "CONSERVER";

  if (signalLabel === "VENDRE" || signalLabel === "ALLÉGER") {
    action = "SORTIR";
  } else if (signalLabel === "ACHAT FORT" || signalLabel === "ACHAT") {
    action = horizonScore != null && horizonScore < 40 ? "CONSERVER" : "RENFORCER";
  } else if (signalLabel === "CONSERVER") {
    if (horizonScore != null && horizonScore < 40) action = "SORTIR";
    else if (horizonScore != null && horizonScore >= 70) action = "RENFORCER";
    else action = "CONSERVER";
  } else if (horizonScore != null) {
    if (horizonScore >= 70) action = "RENFORCER";
    else if (horizonScore < 40) action = "SORTIR";
  }

  if (horizonScore != null && horizonScore < 35 && action === "RENFORCER") {
    action = "CONSERVER";
  }

  const meta = ACTION_META[action];
  const reasonTexts = (input.signalReasons ?? [])
    .slice(0, 2)
    .map((r) => r.text)
    .filter(Boolean);

  const horizonHint =
    horizonScore != null
      ? `score ${input.buyHorizon.toLowerCase()} ${Math.round(horizonScore)}/100`
      : `horizon ${input.buyHorizon.toLowerCase()}`;

  const summary =
    input.signalSummary?.trim() ||
    (signalLabel !== "N/D"
      ? `Signal ${signalLabel} · ${horizonHint}`
      : `Analyse indisponible · ${horizonHint}`);

  return {
    action,
    label: meta.label,
    color: meta.color,
    signalLabel,
    horizonScore,
    summary,
    reasons: reasonTexts,
  };
}

export function adviceRecap(advices: PortfolioAdvice[]): {
  reinforce: number;
  hold: number;
  exit: number;
} {
  return {
    reinforce: advices.filter((a) => a.action === "RENFORCER").length,
    hold: advices.filter((a) => a.action === "CONSERVER").length,
    exit: advices.filter((a) => a.action === "SORTIR").length,
  };
}
