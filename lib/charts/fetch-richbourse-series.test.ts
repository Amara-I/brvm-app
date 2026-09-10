import { describe, expect, it } from "vitest";
import {
  maxSeriesGapDays,
  mergeChartSeries,
  seriesNeedsDensification,
} from "./fetch-richbourse-series";

describe("mergeChartSeries", () => {
  it("préfère la valeur de la base locale à date égale", () => {
    const merged = mergeChartSeries(
      [{ time: "2026-08-12", value: 3150, volume: 801 }],
      [
        { time: "2026-08-11", value: 3100 },
        { time: "2026-08-12", value: 3140 },
      ]
    );
    expect(merged).toEqual([
      { time: "2026-08-11", value: 3100, volume: null },
      { time: "2026-08-12", value: 3150, volume: 801 },
    ]);
  });
});

describe("seriesNeedsDensification", () => {
  it("détecte une série trop courte", () => {
    expect(seriesNeedsDensification([{ time: "2026-01-01" }])).toBe(true);
  });

  it("détecte un trou calendaire même si n ≥ 60", () => {
    const points = Array.from({ length: 60 }, (_, i) => ({
      time: `2026-01-${String(i + 1).padStart(2, "0")}`,
    }));
    // Point isolé 3 ans plus tôt → trou >> seuil densification
    points.unshift({ time: "2022-12-01" });
    expect(maxSeriesGapDays(points)).toBeGreaterThan(14);
    expect(seriesNeedsDensification(points)).toBe(true);
  });

  it("détecte un historique mensuel (trou ~30 j) comme lacunaire", () => {
    const points = Array.from({ length: 60 }, (_, i) => {
      const d = new Date(Date.UTC(2020, i, 28));
      return { time: d.toISOString().slice(0, 10) };
    });
    expect(maxSeriesGapDays(points)).toBeGreaterThan(14);
    expect(seriesNeedsDensification(points)).toBe(true);
  });

  it("accepte une série journalière dense", () => {
    const points = Array.from({ length: 80 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 1 + i));
      return { time: d.toISOString().slice(0, 10) };
    });
    expect(seriesNeedsDensification(points)).toBe(false);
  });
});
