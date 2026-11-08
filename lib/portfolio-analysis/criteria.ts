import type { PortfolioTypeId } from "@/lib/portfolio-types";

export const INVESTOR_HORIZONS = ["MOINS_1_AN", "UN_A_3_ANS", "TROIS_A_7_ANS", "PLUS_7_ANS"] as const;
export type InvestorHorizon = (typeof INVESTOR_HORIZONS)[number];

export const INVESTOR_CAPACITIES = ["MODESTE", "INTERMEDIAIRE", "ELEVEE"] as const;
export type InvestorCapacity = (typeof INVESTOR_CAPACITIES)[number];

export const INVESTOR_LOSS_TOLERANCES = ["FAIBLE", "MODEREE", "ELEVEE"] as const;
export type InvestorLossTolerance = (typeof INVESTOR_LOSS_TOLERANCES)[number];

export const INVESTOR_OBJECTIVES = ["PRESERVATION", "REVENU", "CROISSANCE", "CROISSANCE_AGRESSIVE"] as const;
export type InvestorObjective = (typeof INVESTOR_OBJECTIVES)[number];

/** Critères déclarés + type de portefeuille déjà stocké sur l'utilisateur. */
export interface InvestorCriteria {
  age: number | null;
  horizon: InvestorHorizon | null;
  capacity: InvestorCapacity | null;
  lossTolerance: InvestorLossTolerance | null;
  objective: InvestorObjective | null;
  portfolioType: PortfolioTypeId | null;
  /** Capital déclaré, en FCFA. Null = utiliser la valeur de marché. */
  investableCapitalFcfa: number | null;
  /** Taux explicite, en % du capital. Null = dérivé des autres critères. */
  riskPerPositionPct: number | null;
}

export const EMPTY_INVESTOR_CRITERIA: InvestorCriteria = {
  age: null,
  horizon: null,
  capacity: null,
  lossTolerance: null,
  objective: null,
  portfolioType: null,
  investableCapitalFcfa: null,
  riskPerPositionPct: null,
};

export function isInvestorProfileComplete(profile: InvestorCriteria): boolean {
  return (
    profile.age != null &&
    profile.horizon != null &&
    profile.capacity != null &&
    profile.lossTolerance != null &&
    profile.objective != null
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Risque par position, en % du capital.
 * Explicite : borné à [0,5 ; 2].
 * Dérivé : 1 % (tolérance faible ou non renseignée), 1,5 % (modérée), 2 % (élevée),
 * puis ramené à 1 % si le profil est prudent (rente, trading, préservation,
 * capacité modeste, horizon < 1 an, âge ≥ 70).
 */
export function riskPercentForProfile(profile: InvestorCriteria): {
  percent: number;
  source: "explicit" | "derived";
} {
  if (profile.riskPerPositionPct != null && Number.isFinite(profile.riskPerPositionPct)) {
    return { percent: clamp(profile.riskPerPositionPct, 0.5, 2), source: "explicit" };
  }

  let percent = 1;
  if (profile.lossTolerance === "MODEREE") percent = 1.5;
  if (profile.lossTolerance === "ELEVEE") percent = 2;

  const prudent =
    profile.lossTolerance === "FAIBLE" ||
    profile.portfolioType === "RENTE" ||
    profile.portfolioType === "TRADING" ||
    profile.objective === "PRESERVATION" ||
    profile.capacity === "MODESTE" ||
    profile.horizon === "MOINS_1_AN" ||
    (profile.age != null && profile.age >= 70);

  if (prudent) percent = Math.min(percent, 1);
  return { percent: clamp(percent, 1, 2), source: "derived" };
}
