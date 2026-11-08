/**
 * Taille de position — budget de risque ET rapport rendement/risque.
 *
 * (a) Quantité au risque, arrondie vers le bas (le budget n'est pas dépassé) :
 *     Qrisque = floor( (capital × taux%) / (entrée − stop) )
 *     Le taux vient du profil : 1 % à 2 % (ou 0,5 % à 2 % si la personne le fixe).
 *     Le stop est l'invalidation technique, sinon le stop de la ligne, sinon
 *     entrée − 2×ATR (voir `resolveTechnicalPlan`).
 *
 * (b) Poids du rapport R = (objectif − entrée) / (entrée − stop) :
 *     R inconnu → poids 1 (pas de décote inventée)
 *     R < 1     → poids 0,50
 *     R ≥ 2,5   → poids 1
 *     entre les deux, interpolation linéaire.
 *     Qrr = floor(Qrisque × poids)
 *
 * Puis le plus petit de : Qrr, plafond de liquidité (ADV × jours de sortie),
 * plafond de poids du titre. Ce sont des tailles suggérées : la ligne réelle
 * n'est pas modifiée.
 *
 * Distinct de la calculette pédagogique (`lib/calc/position-size.ts`), qui
 * arrondit au plus proche et accepte jusqu'à 20 %.
 */

export const RR_FLOOR_WEIGHT = 0.5;
export const RR_FULL_AT = 2.5;

export type SizeBinding = "risk" | "reward" | "liquidity" | "concentration" | "unavailable";

export interface PositionSizePlan {
  riskPercent: number;
  riskBudgetFcfa: number | null;
  riskPerShareFcfa: number | null;
  sharesByRisk: number | null;
  riskReward: number | null;
  rewardWeight: number;
  sharesAfterReward: number | null;
  liquidityMaxShares: number | null;
  concentrationMaxShares: number | null;
  suggestedShares: number | null;
  binding: SizeBinding;
}

export function rewardWeight(riskReward: number | null): number {
  if (riskReward == null || !Number.isFinite(riskReward)) return 1;
  if (riskReward < 1) return RR_FLOOR_WEIGHT;
  if (riskReward >= RR_FULL_AT) return 1;
  return RR_FLOOR_WEIGHT + (1 - RR_FLOOR_WEIGHT) * ((riskReward - 1) / (RR_FULL_AT - 1));
}

function floorShares(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value + 1e-9);
}

export function sizePosition(input: {
  capitalFcfa: number;
  riskPercent: number;
  entryFcfa: number;
  stopFcfa: number | null;
  targetFcfa: number | null;
  liquidityMaxShares: number | null;
  stockLimitPct: number;
}): PositionSizePlan {
  const weightFor = (riskReward: number | null): PositionSizePlan => ({
    riskPercent: input.riskPercent,
    riskBudgetFcfa: null,
    riskPerShareFcfa: null,
    sharesByRisk: null,
    riskReward,
    rewardWeight: rewardWeight(riskReward),
    sharesAfterReward: null,
    liquidityMaxShares: input.liquidityMaxShares,
    concentrationMaxShares: null,
    suggestedShares: null,
    binding: "unavailable",
  });

  if (!(input.capitalFcfa > 0) || !(input.entryFcfa > 0) || !(input.riskPercent > 0)) {
    return weightFor(null);
  }
  if (input.stopFcfa == null || !(input.stopFcfa > 0) || input.stopFcfa >= input.entryFcfa) {
    return weightFor(null);
  }

  const riskBudgetFcfa = (input.capitalFcfa * input.riskPercent) / 100;
  const riskPerShareFcfa = input.entryFcfa - input.stopFcfa;
  const sharesByRisk = floorShares(riskBudgetFcfa / riskPerShareFcfa);
  const riskReward =
    input.targetFcfa != null && input.targetFcfa > input.entryFcfa
      ? (input.targetFcfa - input.entryFcfa) / riskPerShareFcfa
      : null;
  const weight = rewardWeight(riskReward);
  const sharesAfterReward = floorShares(sharesByRisk * weight);
  const concentrationMaxShares = floorShares(((input.stockLimitPct / 100) * input.capitalFcfa) / input.entryFcfa);

  let suggested = sharesAfterReward;
  let binding: SizeBinding = weight < 1 && sharesAfterReward < sharesByRisk ? "reward" : "risk";
  if (input.liquidityMaxShares != null && input.liquidityMaxShares < suggested) {
    suggested = input.liquidityMaxShares;
    binding = "liquidity";
  }
  if (concentrationMaxShares < suggested) {
    suggested = concentrationMaxShares;
    binding = "concentration";
  }

  return {
    riskPercent: input.riskPercent,
    riskBudgetFcfa,
    riskPerShareFcfa,
    sharesByRisk,
    riskReward,
    rewardWeight: weight,
    sharesAfterReward,
    liquidityMaxShares: input.liquidityMaxShares,
    concentrationMaxShares,
    suggestedShares: Math.max(0, suggested),
    binding,
  };
}
