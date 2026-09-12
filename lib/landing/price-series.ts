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

/** Moyenne des cours annuels déjà présents — jamais interpolée ni inventée. */
export function averageYearlySeries(
  companies: Array<{ prices: Record<number, number> }>,
  years: number[]
): number[] {
  return years
    .map((year) => {
      const vals = companies
        .map((company) => company.prices[year])
        .filter((value): value is number => typeof value === "number" && value > 0);
      if (vals.length === 0) return null;
      return vals.reduce((sum, value) => sum + value, 0) / vals.length;
    })
    .filter((value): value is number => value != null);
}
