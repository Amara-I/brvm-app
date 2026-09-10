import { describe, expect, it } from "vitest";
import { reconcileChartSeries } from "./reconcile-chart-series";

describe("reconcileChartSeries", () => {
  it("ne remplace jamais un point canonique (base)", () => {
    const { series, discrepancies } = reconcileChartSeries({
      canonical: [{ time: "2026-08-12", value: 32000, volume: 100 }],
      sikafinance: [{ time: "2026-08-12", value: 32100 }],
      richbourse: [{ time: "2026-08-12", value: 31900 }],
      thresholdPercent: 2,
    });
    expect(series).toEqual([{ time: "2026-08-12", value: 32000, volume: 100 }]);
    expect(discrepancies.length).toBe(0); // écart < 2 %
  });

  it("signale un écart > 2 % sans écraser la base", () => {
    const { series, discrepancies } = reconcileChartSeries({
      canonical: [{ time: "2026-08-12", value: 30000 }],
      richbourse: [{ time: "2026-08-12", value: 36000 }],
      thresholdPercent: 2,
    });
    expect(series[0]!.value).toBe(30000);
    expect(discrepancies).toHaveLength(1);
    expect(discrepancies[0]!.deltaPercent).toBeGreaterThan(2);
    expect(discrepancies[0]!.retainedSource).toBe("DB_CANONICAL");
  });

  it("comble un trou avec Sika plutôt que Rich si les deux existent", () => {
    const { series, sourcesUsed } = reconcileChartSeries({
      canonical: [
        { time: "2022-12-30", value: 1000 },
        { time: "2026-08-12", value: 2000 },
      ],
      sikafinance: [{ time: "2024-06-15", value: 1500 }],
      richbourse: [{ time: "2024-06-15", value: 1510 }],
      thresholdPercent: 2,
    });
    expect(series.map((p) => p.time)).toEqual(["2022-12-30", "2024-06-15", "2026-08-12"]);
    expect(series.find((p) => p.time === "2024-06-15")!.value).toBe(1500);
    expect(sourcesUsed).toContain("SIKAFINANCE");
  });

  it("préfère Sika à Rich sur un trou même si écart > seuil", () => {
    const { series, discrepancies } = reconcileChartSeries({
      canonical: [],
      sikafinance: [{ time: "2024-01-01", value: 1000 }],
      richbourse: [{ time: "2024-01-01", value: 1200 }],
      thresholdPercent: 2,
    });
    expect(series[0]!.value).toBe(1000);
    expect(discrepancies.length).toBe(1);
    expect(discrepancies[0]!.retainedSource).toBe("SIKAFINANCE");
  });
});
