/**
 * Niveaux Fibonacci pour tracés graphiques.
 * Convention : 0 = point max (haut), 1 = point min (bas).
 * Labels d'axe = valeur numérique seule (pas de préfixe « Fibo » / « Ext »).
 * L'échelle du graphique n'est jamais élargie par ces lignes.
 */

/** Retracements inclus les extrémités (0 = max, 1 = min). */
export const FIB_INTERVAL_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;

/** 2 extensions au-dessus du point max. */
export const FIB_ABOVE_MAX_LEVELS = [-0.272, -0.618] as const;

/** 2 extensions en dessous du point min. */
export const FIB_BELOW_MIN_LEVELS = [1.272, 1.618] as const;

export const FIB_DISPLAY_LEVELS = [
  ...FIB_ABOVE_MAX_LEVELS,
  ...FIB_INTERVAL_LEVELS,
  ...FIB_BELOW_MIN_LEVELS,
] as const;

export function fibPriceAtLevel(low: number, high: number, level: number): number {
  return low + (high - low) * (1 - level);
}

export function isFibExtensionLevel(level: number): boolean {
  return level < 0 || level > 1;
}

/** Libellé d'axe : uniquement le ratio (ex. « 0.618 », « -0.272 »). */
export function formatFibLevel(level: number): string {
  if (level === 0 || level === 1) return String(level);
  const rounded = Math.round(level * 1000) / 1000;
  return String(rounded);
}
