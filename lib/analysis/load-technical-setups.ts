import type { TechnicalSetup } from "./technical-plan";

/**
 * Branchement du module d'analyse technique.
 *
 * Le module concurrent doit remplacer le corps de cette fonction et retourner
 * un `TechnicalSetup` (`source: "technical"`) par ticker couvert : invalidation,
 * objectif, et si déjà calculé le rapport rendement/risque.
 * Ne pas changer l'interface `TechnicalSetup` (`lib/analysis/technical-plan.ts`,
 * version `TECHNICAL_PLAN_CONTRACT_VERSION`).
 *
 * Tableau vide = pas encore de plan technique : le dimensionnement retombe
 * sur le stop de la ligne, puis sur l'ATR ou la volatilité des clôtures.
 */
export async function loadTechnicalSetups(tickers: readonly string[]): Promise<TechnicalSetup[]> {
  void tickers;
  return [];
}
