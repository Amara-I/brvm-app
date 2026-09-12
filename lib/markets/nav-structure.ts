// Groupement IA de la sidebar : pages BRVM vs. entrées globales
// (Portefeuille, Simulation) vs. autres places « bientôt ».
// Les routes restent plates ; seul le menu les range sous BRVM.

import { AFRICAN_EXCHANGES, type AfricanExchange } from "./african-exchanges";

/** Liens actuellement sous le groupe « Marché », désormais enfants de BRVM. */
export const BRVM_NAV_HREFS = [
  "/marche",
  "/screener",
  "/graphes",
  "/societes-cotees",
  "/calendrier-dividendes",
] as const;

/** Préfixes considérés comme « dans » le marché BRVM (ouvre la section). */
export const BRVM_NAV_PREFIXES = [...BRVM_NAV_HREFS, "/actions"] as const;

/** Entrées transverses — restent au premier niveau, hors BRVM. */
export const GLOBAL_NAV_HREFS = ["/portefeuille", "/simulation"] as const;

export function isBrvmNavPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return BRVM_NAV_PREFIXES.some((href) => pathname === href || pathname.startsWith(`${href}/`));
}

export function isGlobalNavPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return GLOBAL_NAV_HREFS.some((href) => pathname === href || pathname.startsWith(`${href}/`));
}

/** Places du sélecteur /marche qui n'ont pas encore de données live. */
export function comingSoonExchanges(): AfricanExchange[] {
  return AFRICAN_EXCHANGES.filter((exchange) => !exchange.live);
}
