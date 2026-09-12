import { describe, expect, it } from "vitest";
import { aggregateCandles } from "./ohlc-aggregate";
import { rangeFilter, type ChartClosePoint } from "./indicators";
import {
  chartRangeChangeLabel,
  computeWindowChange,
  computeWindowChangeFromCandles,
  formatWindowChangeAbs,
  formatWindowChangePercent,
} from "./window-change";

function pts(...pairs: Array<[string, number]>): ChartClosePoint[] {
  return pairs.map(([time, value]) => ({ time, value, volume: null }));
}

describe("computeWindowChange", () => {
  it("calcule (dernier − premier) / premier", () => {
    const series = pts(["2026-01-01", 100], ["2026-06-01", 102.35]);
    const chg = computeWindowChange(series);
    expect(chg).not.toBeNull();
    expect(chg!.percent).toBeCloseTo(2.35, 6);
    expect(chg!.abs).toBeCloseTo(2.35, 6);
  });

  it("renvoie null si moins de 2 points (MAX / série creuse)", () => {
    expect(computeWindowChange([])).toBeNull();
    expect(computeWindowChange(pts(["2026-08-10", 160]))).toBeNull();
  });

  it("ne fabrique pas de % si le premier cours est invalide", () => {
    expect(computeWindowChange(pts(["2026-01-01", 0], ["2026-08-10", 120]))).toBeNull();
    expect(computeWindowChange(pts(["2026-01-01", -10], ["2026-08-10", 120]))).toBeNull();
  });

  it("suit la série déjà fenêtrée (1A)", () => {
    const sample = pts(
      ["2020-12-31", 100],
      ["2025-12-31", 150],
      ["2026-08-10", 160]
    );
    const windowed = rangeFilter(sample, "1A", new Date("2026-08-10T00:00:00.000Z"));
    const chg = computeWindowChange(windowed);
    expect(windowed).toHaveLength(2);
    expect(chg!.percent).toBeCloseTo((160 - 150) / 150 * 100, 6);
  });
});

describe("computeWindowChangeFromCandles", () => {
  it("utilise l'ouverture de la 1re bougie → clôture de la dernière", () => {
    const daily = pts(
      ["2026-01-05", 100],
      ["2026-01-06", 110],
      ["2026-02-02", 121]
    );
    const { candles } = aggregateCandles(daily, "1M");
    expect(candles.length).toBeGreaterThanOrEqual(2);
    const chg = computeWindowChangeFromCandles(candles);
    expect(chg).not.toBeNull();
    expect(chg!.first).toBe(candles[0]!.open);
    expect(chg!.last).toBe(candles[candles.length - 1]!.close);
  });

  it("N/D s'il n'y a qu'une bougie", () => {
    const { candles } = aggregateCandles(pts(["2026-01-05", 100]), "1D");
    expect(computeWindowChangeFromCandles(candles)).toBeNull();
  });
});

describe("formatWindowChangePercent", () => {
  it("formate en français avec 2 décimales", () => {
    expect(formatWindowChangePercent(2.35)).toBe("+2,35 %");
    expect(formatWindowChangePercent(-1.1)).toBe("−1,10 %");
    expect(formatWindowChangePercent(0)).toBe("0,00 %");
    expect(formatWindowChangePercent(null)).toBe("N/D");
    expect(formatWindowChangePercent(Number.NaN)).toBe("N/D");
  });
});

describe("formatWindowChangeAbs / labels", () => {
  it("formate la variation absolue", () => {
    expect(formatWindowChangeAbs(670)).toBe("+670 FCFA");
    expect(formatWindowChangeAbs(-1200).replace(/\s/g, " ")).toBe("-1 200 FCFA");
  });

  it("libellé d'horizon", () => {
    expect(chartRangeChangeLabel("1J")).toBe("Variation 1J");
    expect(chartRangeChangeLabel("1A")).toBe("Variation 1A");
    expect(chartRangeChangeLabel("MAX")).toBe("Variation Tout");
    expect(chartRangeChangeLabel("MAX", "Max")).toBe("Variation Max");
  });
});
