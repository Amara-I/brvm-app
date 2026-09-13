/**
 * Dimensionnement de position (méthode risque / stop).
 * Q = (capital × taux%) / (entrée − stop)
 *
 * Outil pédagogique — pas un conseil d’investissement.
 * N’invente jamais un cours : le prix d’entrée vient de la saisie
 * utilisateur ou d’un cours chargé depuis la base.
 */

export interface PositionSizeInput {
  /** Capital total (FCFA). */
  capital: number;
  /** Taux de perte acceptable, en % du capital (ex. 5 = 5 %). */
  riskPercent: number;
  /** Prix d’entrée (FCFA). */
  entryPrice: number;
  /** Prix de stop (FCFA). Doit être < entrée pour un achat (long). */
  stopPrice: number;
}

export type PositionSizeErrorCode =
  | "capital_invalide"
  | "taux_invalide"
  | "prix_entree_invalide"
  | "prix_stop_invalide"
  | "stop_non_inferieur"
  | "quantite_nulle";

export interface PositionSizeOk {
  ok: true;
  /** Budget de risque = capital × taux%. */
  riskBudget: number;
  /** Risque par titre = entrée − stop. */
  riskPerShare: number;
  /** Quantité brute (non arrondie). */
  sharesRaw: number;
  /** Quantité recommandée (arrondi à l’entier le plus proche, min 1). */
  shares: number;
  /** Montant investi = quantité × entrée. */
  invested: number;
  /** Perte max si le stop est touché = quantité × (entrée − stop). */
  maxLossAtStop: number;
  /** Perte max / capital, en %. */
  maxLossPercentOfCapital: number;
  /** true si l’arrondi fait légèrement dépasser le budget. */
  roundingExceedsBudget: boolean;
}

export interface PositionSizeErr {
  ok: false;
  code: PositionSizeErrorCode;
  message: string;
}

export type PositionSizeResult = PositionSizeOk | PositionSizeErr;

/** Exemple pédagogique type SOGB / SOGC (chiffres du tutoriel, pas un cours live). */
export const SOGB_STYLE_EXAMPLE = {
  ticker: "SOGC",
  name: "SOGB CI",
  capital: 1_000_000,
  riskPercent: 5,
  entryPrice: 8_400,
  stopPrice: 7_560,
} as const;

export const POSITION_SIZE_ERROR_MESSAGES: Record<PositionSizeErrorCode, string> = {
  capital_invalide: "Indiquez un capital total strictement positif (FCFA).",
  taux_invalide: "Le taux de perte acceptable doit être compris entre 0,1 % et 20 %.",
  prix_entree_invalide: "Indiquez un prix d’entrée strictement positif (FCFA).",
  prix_stop_invalide: "Indiquez un prix de stop strictement positif (FCFA).",
  stop_non_inferieur: "Pour un achat, le stop doit être strictement inférieur au prix d’entrée.",
  quantite_nulle: "Le risque par titre est trop élevé pour ce capital : la quantité recommandée serait inférieure à 1 action.",
};

export function latestPositivePrice(prices: Record<number, number> | undefined | null): number | null {
  if (!prices) return null;
  const years = Object.keys(prices)
    .map((y) => Number(y))
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => b - a);
  for (const year of years) {
    const value = prices[year];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function isPositiveFinite(n: number): boolean {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Calcule la taille de position long.
 * Arrondi : Math.round (exemple tutoriel : 50 000 / 840 ≈ 59,52 → 60 titres).
 */
export function computePositionSize(input: PositionSizeInput): PositionSizeResult {
  const { capital, riskPercent, entryPrice, stopPrice } = input;

  if (!isPositiveFinite(capital)) {
    return { ok: false, code: "capital_invalide", message: POSITION_SIZE_ERROR_MESSAGES.capital_invalide };
  }
  if (!Number.isFinite(riskPercent) || riskPercent < 0.1 || riskPercent > 20) {
    return { ok: false, code: "taux_invalide", message: POSITION_SIZE_ERROR_MESSAGES.taux_invalide };
  }
  if (!isPositiveFinite(entryPrice)) {
    return { ok: false, code: "prix_entree_invalide", message: POSITION_SIZE_ERROR_MESSAGES.prix_entree_invalide };
  }
  if (!isPositiveFinite(stopPrice)) {
    return { ok: false, code: "prix_stop_invalide", message: POSITION_SIZE_ERROR_MESSAGES.prix_stop_invalide };
  }
  if (stopPrice >= entryPrice) {
    return { ok: false, code: "stop_non_inferieur", message: POSITION_SIZE_ERROR_MESSAGES.stop_non_inferieur };
  }

  const riskBudget = (capital * riskPercent) / 100;
  const riskPerShare = entryPrice - stopPrice;
  const sharesRaw = riskBudget / riskPerShare;
  const shares = Math.round(sharesRaw);

  if (shares < 1) {
    return { ok: false, code: "quantite_nulle", message: POSITION_SIZE_ERROR_MESSAGES.quantite_nulle };
  }

  const invested = shares * entryPrice;
  const maxLossAtStop = shares * riskPerShare;
  const maxLossPercentOfCapital = (maxLossAtStop / capital) * 100;

  return {
    ok: true,
    riskBudget,
    riskPerShare,
    sharesRaw,
    shares,
    invested,
    maxLossAtStop,
    maxLossPercentOfCapital,
    roundingExceedsBudget: maxLossAtStop > riskBudget + 1e-9,
  };
}
