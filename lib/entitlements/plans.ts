/**
 * Paliers d'offre et drapeau d'application des restrictions visiteur.
 *
 * Quatre plans sont prévus en base (FREE / LIGHT / PREMIUM + ANON côté app).
 * Étape 1 : seul le visiteur (pas de session) est restreint, si
 * `ENFORCE_ANON_GATES` n'est pas désactivé. Tout compte connecté a un accès
 * complet (historique MAX compris), quel que soit `User.plan`.
 */

export type UserPlan = "FREE" | "LIGHT" | "PREMIUM";
export type ViewerPlan = "ANON" | UserPlan;

export const PLAN_RANK: Record<ViewerPlan, number> = {
  ANON: 0,
  FREE: 1,
  LIGHT: 2,
  PREMIUM: 3,
};

/** Plafond d'historique visiteur (années calendaires). */
export const ANON_MAX_CHART_YEARS = 5;

export const ANON_MAX_CHART_RANGE = "5A" as const;

export const ANON_ALLOWED_CHART_RANGES = new Set<string>([
  "1J",
  "5J",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1A",
  "1Y",
  "3A",
  "3Y",
  "5A",
  "5Y",
]);

/**
 * Restrictions visiteur actives ? Défaut : oui.
 * Désactiver avec ENFORCE_ANON_GATES=0|false|off|no (recharge le process).
 */
export function enforceAnonGates(env: string | undefined = process.env.ENFORCE_ANON_GATES): boolean {
  if (env == null || env.trim() === "") return true;
  return !["0", "false", "off", "no"].includes(env.trim().toLowerCase());
}

export function isAnonChartRangeAllowed(range: string | null | undefined): boolean {
  if (!range) return true;
  const key = range.trim().toUpperCase();
  return ANON_ALLOWED_CHART_RANGES.has(key);
}
