import { describe, expect, it } from "vitest";
import { buildNavSeriesFromCloses } from "./portfolio-nav-series";

describe("buildNavSeriesFromCloses", () => {
  it("calcule NAV = Σ qty × close et la variation vs veille", () => {
    const qty = new Map([
      ["c1", 10],
      ["c2", 5],
    ]);
    const series = buildNavSeriesFromCloses(qty, [
      { companyId: "c1", date: "2026-08-01", closePrice: 100 },
      { companyId: "c2", date: "2026-08-01", closePrice: 200 },
      { companyId: "c1", date: "2026-08-02", closePrice: 110 },
      { companyId: "c2", date: "2026-08-02", closePrice: 200 },
    ]);

    expect(series).toHaveLength(2);
    expect(series[0]).toMatchObject({
      date: "2026-08-01",
      value: 10 * 100 + 5 * 200,
      changePercent: null,
    });
    expect(series[1]!.value).toBe(10 * 110 + 5 * 200); // 2100
    // (2100 - 2000) / 2000 = 5 %
    expect(series[1]!.changePercent).toBe(5);
  });

  it("reporte le dernier cours connu si un titre saute un jour", () => {
    const qty = new Map([["c1", 2]]);
    const series = buildNavSeriesFromCloses(qty, [
      { companyId: "c1", date: "2026-08-01", closePrice: 50 },
      { companyId: "c1", date: "2026-08-03", closePrice: 60 },
    ]);
    expect(series.map((p) => p.date)).toEqual(["2026-08-01", "2026-08-03"]);
    expect(series[0]!.value).toBe(100);
    expect(series[1]!.value).toBe(120);
  });
});
