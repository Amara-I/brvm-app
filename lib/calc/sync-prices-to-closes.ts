import type { ChartClosePoint } from "@/lib/charts/indicators";

/** Aligne le cours annuel de l'année courante sur la dernière clôture datée. */
export function pricesSyncedToLatestClose(
  prices: Record<number, number>,
  closes: ChartClosePoint[] | undefined
): Record<number, number> {
  if (!closes?.length) return prices;
  const last = closes[closes.length - 1]!;
  if (!(last.value > 0)) return prices;
  const y = Number(last.time.slice(0, 4));
  if (!Number.isFinite(y)) return prices;
  return { ...prices, [y]: last.value };
}
