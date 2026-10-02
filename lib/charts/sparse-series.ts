import type { ChartClosePoint } from "./indicators";

/**
 * Série affichée : toute clôture réelle (même un seul point) prime sur le
 * repli annuel. Le repli ne sert que s'il n'existe aucun cours en base.
 * Ne fabrique aucun prix.
 */
export function seriesWithAnnualFallback(
  loaded: ChartClosePoint[],
  annual: ChartClosePoint[]
): ChartClosePoint[] {
  return loaded.length > 0 ? loaded : annual;
}

/**
 * Bornes d'échelle quand toutes les valeurs sont égales (1 clôture, ou série
 * plate). N'ajoute aucun cours : seulement une marge pour que le point
 * ne soit pas collé au bord (ou invisible).
 * Retourne null dès qu'il y a une vraie amplitude — l'échelle auto suffit.
 */
export function flatPriceBounds(
  values: number[],
  padRatio = 0.02
): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max > min) return null;
  const pad = Math.max(Math.abs(min) * padRatio, 1);
  return { min: min - pad, max: max + pad };
}
