import { DEFAULT_PORTFOLIO_TYPE, parsePortfolioType, type PortfolioTypeId } from "./constants";

/**
 * Type de portefeuille lu par la fiche société après le retrait du sélecteur.
 *
 * 1. Préférence enregistrée sur le profil, si elle est valide.
 * 2. Sinon le défaut produit Croissance — même repli que lorsqu'aucun choix
 *    n'était mémorisé. Ce n'est pas une lecture « vide » : les blocs qui
 *    dépendaient du type (scorecard, termes clés, cadrage) restent calculés.
 *
 * Ne lit ni n'écrit `localStorage` (`ouestbourse:portfolio-type`). Ce choix
 * navigateur et la colonne profil restent en place pour la conclusion de
 * l'analyse fondamentale.
 */
export function portfolioTypeForCompanySheet(preferredFromProfile: unknown): PortfolioTypeId {
  return parsePortfolioType(preferredFromProfile) ?? DEFAULT_PORTFOLIO_TYPE;
}
