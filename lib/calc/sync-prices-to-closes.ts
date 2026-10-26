import type { ChartClosePoint } from "@/lib/charts/indicators";

/**
 * Aligne le cours annuel de l'année courante sur la dernière clôture datée.
 * Une série plus ancienne que `asOf` (cache chart périmé) ne recule pas le cours.
 */
export function pricesSyncedToLatestClose(
  prices: Record<number, number>,
  closes: ChartClosePoint[] | undefined,
  asOf?: string | null
): Record<number, number> {
  if (!closes?.length) return prices;
  const last = closes[closes.length - 1]!;
  if (!(last.value > 0)) return prices;
  if (asOf && last.time.slice(0, 10) < asOf.slice(0, 10)) return prices;
  const y = Number(last.time.slice(0, 4));
  if (!Number.isFinite(y)) return prices;
  return { ...prices, [y]: last.value };
}
