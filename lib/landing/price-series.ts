/** Série numérique issue des cours annuels déjà chargés — jamais inventée. */

export function seriesFromYearlyPrices(prices: Record<number, number>): number[] {
  return Object.keys(prices)
    .map(Number)
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => a - b)
    .map((year) => prices[year])
    .filter((value): value is number => typeof value === "number" && value > 0);
}

export function downsampleSeries(values: number[], maxPoints = 28): number[] {
  if (values.length <= maxPoints) return values;
  const last = values.length - 1;
  const out: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(values[Math.round((i / (maxPoints - 1)) * last)]!);
  }
  return out;
}
