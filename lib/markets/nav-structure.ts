// Groupement IA de la sidebar : pages BRVM vs. entrées globales
// (Portefeuille, Simulation) vs. autres places « bientôt ».
// Les routes restent plates ; seul le menu les range sous BRVM.

import { AFRICAN_EXCHANGES, type AfricanExchange } from "./african-exchanges";

/** Liens actuellement sous le groupe « Marché », désormais enfants de BRVM. */
export const BRVM_NAV_HREFS = [
  "/marche",
  "/indices",
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

/** Pages placeholder hors /marche, pour ne pas polluer la vue d'ensemble BRVM. */
export const COMING_SOON_MARKET_PREFIX = "/marches";

export function comingSoonMarketHref(code: AfricanExchange["code"]): string {
  return `${COMING_SOON_MARKET_PREFIX}/${code.toLowerCase()}`;
}

/** Slot Indices : BRVM live à `/indices`, autres places sous `/marches/{code}/indices`. */
export function marketIndicesHref(code: AfricanExchange["code"]): string {
  if (code === "BRVM") return "/indices";
  return `${comingSoonMarketHref(code)}/indices`;
}

export function parseComingSoonMarketSlug(slug: string | undefined): AfricanExchange | null {
  if (!slug) return null;
  const exchange = AFRICAN_EXCHANGES.find((item) => item.code === slug.trim().toUpperCase());
  if (!exchange || exchange.live) return null;
  return exchange;
}

/** Accepte `/marches/ngx` et `/marches/ngx/indices`. */
export function parseComingSoonMarketPath(pathname: string | null | undefined): AfricanExchange | null {
  if (!pathname) return null;
  if (!pathname.startsWith(`${COMING_SOON_MARKET_PREFIX}/`)) return null;
  const slug = pathname.slice(COMING_SOON_MARKET_PREFIX.length + 1).split("/").filter(Boolean)[0];
  return parseComingSoonMarketSlug(slug);
}

export function isComingSoonMarketPath(pathname: string | null | undefined): boolean {
  return parseComingSoonMarketPath(pathname) !== null;
}

/** True si la route courante appartient à cette place « bientôt ». */
export function isComingSoonMarketNavPath(
  pathname: string | null | undefined,
  code: AfricanExchange["code"],
): boolean {
  return parseComingSoonMarketPath(pathname)?.code === code;
}

/**
 * Accordion des places non-BRVM : fermé par défaut pour désengorger
 * la sidebar ; ouvert si l’utilisateur l’a basculé, ou si la route
 * active est sous cette place (pour voir où l’on se trouve).
 */
export function isComingSoonMarketSectionOpen(
  pathname: string | null | undefined,
  code: AfricanExchange["code"],
  userOpen: boolean | undefined,
): boolean {
  if (userOpen !== undefined) return userOpen;
  return isComingSoonMarketNavPath(pathname, code);
}
