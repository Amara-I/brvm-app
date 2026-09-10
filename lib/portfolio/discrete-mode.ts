/** Mode discret portefeuille — masquage sélectif des montants FCFA. */

export const PORTFOLIO_DISCRETE_STORAGE_KEY = "ouestbourse:portfolio:discrete";
export const PORTFOLIO_DISCRETE_MASKS_STORAGE_KEY = "ouestbourse:portfolio:discrete-masks";

export const DISCRETE_AMOUNT_LABEL = "•••";

/**
 * Champs masquables en mode discret.
 * `true` = masqué (•••) ; les % restent toujours visibles.
 */
export type DiscreteMaskKey =
  | "quantity"
  | "pru"
  | "cost"
  | "portfolioTotal"
  | "positionTotal"
  | "unitPrice"
  | "gainAmount"
  | "gainPercent"
  | "realizedPnl"
  | "tradeAmounts"
  | "navChart"
  | "allocationAmounts";

export type DiscreteMaskConfig = Record<DiscreteMaskKey, boolean>;

/**
 * Défaut : ancien mode discret, avec les 3 valeurs séparées :
 * - Total portefeuille → masqué
 * - Total ligne (marché) → masqué
 * - Cours unitaire → visible
 * PRU reste visible.
 */
export const DEFAULT_DISCRETE_MASKS: DiscreteMaskConfig = {
  quantity: true,
  pru: false,
  cost: true,
  portfolioTotal: true,
  positionTotal: true,
  unitPrice: false,
  gainAmount: true,
  gainPercent: false,
  realizedPnl: true,
  tradeAmounts: true,
  navChart: true,
  allocationAmounts: true,
};

export const DISCRETE_MASK_LABELS: Record<DiscreteMaskKey, string> = {
  quantity: "Quantité",
  pru: "PRU",
  cost: "Coût d'acquisition",
  portfolioTotal: "Total du portefeuille",
  positionTotal: "Total marché (ligne)",
  unitPrice: "Cours unitaire actuel",
  gainAmount: "Plus/moins-value en FCFA",
  gainPercent: "Plus/moins-value en %",
  realizedPnl: "P&L réalisé (FCFA)",
  tradeAmounts: "Montants de l'historique",
  navChart: "Montants du graphique d'évolution",
  allocationAmounts: "Montants de la répartition",
};

export const DISCRETE_MASK_KEYS = Object.keys(DEFAULT_DISCRETE_MASKS) as DiscreteMaskKey[];

export function mergeDiscreteMasks(raw: unknown): DiscreteMaskConfig {
  const base = { ...DEFAULT_DISCRETE_MASKS };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;

  // Migration ancienne clé `marketValue` → total portefeuille + total ligne
  if (typeof o.marketValue === "boolean") {
    base.portfolioTotal = o.marketValue as boolean;
    base.positionTotal = o.marketValue as boolean;
  }

  for (const key of DISCRETE_MASK_KEYS) {
    if (typeof o[key] === "boolean") base[key] = o[key] as boolean;
  }
  return base;
}

/** Actif seulement si le mode discret est ON et le champ est coché. */
export function isMasked(
  discrete: boolean,
  masks: DiscreteMaskConfig,
  key: DiscreteMaskKey
): boolean {
  return discrete && masks[key];
}

export function fmtFcfaOrMasked(n: number, masked: boolean): string {
  if (masked) return DISCRETE_AMOUNT_LABEL;
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

export function fmtAmtOrMasked(n: number, masked: boolean): string {
  if (masked) return DISCRETE_AMOUNT_LABEL;
  return Math.round(n).toLocaleString("fr-FR");
}

/** @deprecated préférer fmtFcfaOrMasked + isMasked */
export function fmtFcfaOrDiscrete(n: number, discrete: boolean): string {
  return fmtFcfaOrMasked(n, discrete);
}

/** @deprecated préférer fmtAmtOrMasked + isMasked */
export function fmtAmtOrDiscrete(n: number, discrete: boolean): string {
  return fmtAmtOrMasked(n, discrete);
}
