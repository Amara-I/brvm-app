// Opérations sur titres (fractionnement, regroupement, attribution).
// Les cours bruts de `price_history` ne sont jamais réécrits : le facteur
// s'applique à la lecture et au rebuild de `chart_series`.

export type CorporateActionKind = "SPLIT" | "REVERSE_SPLIT" | "BONUS";

/**
 * Facteur de prix = titres nouveaux / titres anciens.
 * Split 10 pour 1 → 10 (cours avant la date / 10, volumes × 10).
 * Regroupement 1 pour 10 → 0.1. Attribution 1 pour 1 → 2.
 * Les séances à partir de `effectiveDate` (incluse) sont déjà sur la nouvelle base.
 */
export interface AdjustmentAction {
  ticker: string;
  companyId?: string;
  kind: CorporateActionKind;
  effectiveDate: string;
  factor: number;
  oldShares: number;
  newShares: number;
  /** false = l'historique stocké est déjà sur la nouvelle base. */
  adjustPrices: boolean;
  label: string;
  /** Nombre de titres AVANT l'opération, si connu (pour ne pas doubler un chiffre déjà restaté). */
  sharesOutstandingBefore?: number | null;
  sourceUrl?: string | null;
  note?: string | null;
}

export interface SplitMarker {
  effectiveDate: string;
  label: string;
}
