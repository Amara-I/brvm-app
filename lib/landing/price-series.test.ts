import { describe, expect, it } from "vitest";
import { downsampleSeries, seriesFromYearlyPrices } from "./price-series";

describe("seriesFromYearlyPrices", () => {
  it("ordonne les années et ignore les zéros", () => {
    expect(
      seriesFromYearlyPrices({
        2024: 12,
        2022: 0,
        2023: 10,
        2025: 15,
      })
    ).toEqual([10, 12, 15]);
  });

  it("retourne une liste vide si aucun cours positif", () => {
    expect(seriesFromYearlyPrices({ 2026: 0 })).toEqual([]);
  });
});

describe("downsampleSeries", () => {
  it("conserve les séries courtes", () => {
    expect(downsampleSeries([1, 2, 3], 8)).toEqual([1, 2, 3]);
  });

  it("garde le premier et le dernier point", () => {
    const sampled = downsampleSeries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4);
    expect(sampled[0]).toBe(1);
    expect(sampled[sampled.length - 1]).toBe(10);
    expect(sampled).toHaveLength(4);
  });
});
