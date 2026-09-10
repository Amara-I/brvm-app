import { describe, expect, it } from "vitest";
import {
  annualSeriesFromPrices,
  filterSeriesByHorizon,
  horizonChangePercent,
  horizonMaxDailyVariationPercent,
  horizonMaxVariationPercent,
} from "./market-horizon";
import type { ChartClosePoint } from "@/lib/charts/indicators";

const asOf = new Date("2026-08-13T12:00:00.000Z");

function pts(...pairs: Array<[string, number]>): ChartClosePoint[] {
  return pairs.map(([time, value]) => ({ time, value, volume: null }));
}

describe("filterSeriesByHorizon", () => {
  it("exclut les dates futures et garde la fenêtre 1A", () => {
    const series = pts(
      ["2024-12-31", 100],
      ["2025-12-31", 110],
      ["2026-08-10", 120]
    );
    const filtered = filterSeriesByHorizon(series, "1A", asOf);
    expect(filtered.map((p) => p.time)).toEqual(["2025-12-31", "2026-08-10"]);
    expect(horizonChangePercent(filtered)).toBeCloseTo(9.1, 1);
  });

  it("ne replie pas un historique long sur un horizon court", () => {
    const series = pts(
      ["2015-12-31", 50],
      ["2020-12-31", 80],
      ["2025-12-31", 100],
      ["2026-08-10", 105]
    );
    expect(filterSeriesByHorizon(series, "1J", asOf)).toEqual([]);
    expect(filterSeriesByHorizon(series, "1M", asOf)).toEqual([]);
  });

  it("accepte un repli 2 points pour 1A si sparse", () => {
    const series = pts(["2025-12-31", 200], ["2026-08-10", 220]);
    const filtered = filterSeriesByHorizon(series, "1A", asOf);
    expect(filtered).toHaveLength(2);
    expect(horizonChangePercent(filtered)).toBe(10);
  });

  it("calcule la variation max haut-bas", () => {
    const series = pts(["2025-01-01", 100], ["2025-06-01", 140], ["2026-08-10", 120]);
    expect(horizonMaxVariationPercent(series)).toBe(40);
  });

  it("calcule la plus forte variation session à session", () => {
    const series = pts(
      ["2026-08-01", 100],
      ["2026-08-02", 105],
      ["2026-08-03", 95],
      ["2026-08-04", 96]
    );
    // −9,52 % entre le 2 et le 3 août
    expect(horizonMaxDailyVariationPercent(series)).toBeCloseTo(-9.5, 1);
  });
});

describe("annualSeriesFromPrices", () => {
  it("date l'année courante à aujourd'hui, pas au 31/12", () => {
    const series = annualSeriesFromPrices({ 2025: 100, 2026: 130 }, [2025, 2026], asOf);
    expect(series[0]!.time).toBe("2025-12-31");
    expect(series[1]!.time).toBe("2026-08-13");
  });
});
