/** Quatre types pédagogiques — cadrage d’analyse, pas un conseil d’investissement. */

export const PORTFOLIO_TYPE_IDS = ["CROISSANCE", "RENTE", "TRADING", "CROISSANCE_MAX"] as const;

export type PortfolioTypeId = (typeof PORTFOLIO_TYPE_IDS)[number];

export const DEFAULT_PORTFOLIO_TYPE: PortfolioTypeId = "CROISSANCE";

/** Dernier type choisi sur une fiche / simulation (navigateur). */
export const PORTFOLIO_TYPE_STORAGE_KEY = "ouestbourse:portfolio-type";

export function isPortfolioTypeId(value: unknown): value is PortfolioTypeId {
  return typeof value === "string" && (PORTFOLIO_TYPE_IDS as readonly string[]).includes(value);
}

export function parsePortfolioType(value: unknown): PortfolioTypeId | null {
  return isPortfolioTypeId(value) ? value : null;
}

export function coercePortfolioType(value: unknown): PortfolioTypeId {
  return parsePortfolioType(value) ?? DEFAULT_PORTFOLIO_TYPE;
}

export function readStoredPortfolioType(): PortfolioTypeId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PORTFOLIO_TYPE_STORAGE_KEY);
    if (!raw) return null;
    try {
      return parsePortfolioType(JSON.parse(raw));
    } catch {
      return parsePortfolioType(raw);
    }
  } catch {
    return null;
  }
}

export function writeStoredPortfolioType(type: PortfolioTypeId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PORTFOLIO_TYPE_STORAGE_KEY, JSON.stringify(type));
  } catch {
    // quota / mode privé
  }
}
