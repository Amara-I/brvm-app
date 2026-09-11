import { describe, expect, it } from "vitest";
import {
  applyChartSeriesWindow,
  parseChartRangeParam,
  parseIsoDateParam,
  seriesCoversChartRange,
  seriesCoversIntervalLookback,
} from "./chart-window";
import type { ChartClosePoint } from "./indicators";

function daily(from: string, days: number, startValue = 100): ChartClosePoint[] {
  const out: ChartClosePoint[] = [];
  const d = new Date(`${from}T00:00:00.000Z`);
  for (let i = 0; i < days; i++) {
    const iso = d.toISOString().slice(0, 10);
    out.push({ time: iso, value: startValue + i, volume: 10 });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const dense = daily("2024-09-11", 732); // ~2 ans jusqu'au 2026-09-11

describe("parseChartRangeParam", () => {
  it("mappe les alias anglais / français", () => {
    expect(parseChartRangeParam("1Y")).toBe("1A");
    expect(parseChartRangeParam("1y")).toBe("1A");
    expect(parseChartRangeParam("5Y")).toBe("5A");
    expect(parseChartRangeParam("MAX")).toBe("MAX");
    expect(parseChartRangeParam("tout")).toBe("MAX");
    expect(parseChartRangeParam("1A")).toBe("1A");
    expect(parseChartRangeParam("bogus")).toBeUndefined();
    expect(parseChartRangeParam(null)).toBeUndefined();
  });
});

describe("parseIsoDateParam", () => {
  it("accepte une date calendaire", () => {
    expect(parseIsoDateParam("2006-01-01")).toBe("2006-01-01");
    expect(parseIsoDateParam("2006-01-01T12:00:00Z")).toBe("2006-01-01");
    expect(parseIsoDateParam("not-a-date")).toBeUndefined();
  });
});

describe("applyChartSeriesWindow", () => {
  it("défaut = 1A (pas tout l'historique)", () => {
    const win = applyChartSeriesWindow(dense, {});
    const last = dense[dense.length - 1]!.time;
    expect(win.range).toBe("1A");
    expect(win.series[win.series.length - 1]?.time).toBe(last);
    expect(win.series[0]?.time.startsWith("2025-")).toBe(true);
    expect(win.series.length).toBeLessThan(dense.length);
    expect(win.series.length).toBeGreaterThan(300);
  });

  it("honore range=1Y comme 1A", () => {
    const a = applyChartSeriesWindow(dense, { range: "1Y" });
    const b = applyChartSeriesWindow(dense, { range: "1A" });
    expect(a.series.map((p) => p.time)).toEqual(b.series.map((p) => p.time));
  });

  it("range=MAX renvoie toute la série", () => {
    const win = applyChartSeriesWindow(dense, { range: "MAX" });
    expect(win.range).toBe("MAX");
    expect(win.series).toHaveLength(dense.length);
  });

  it("from= borne le début (to implicite = dernier point)", () => {
    const win = applyChartSeriesWindow(dense, { from: "2006-01-01" });
    expect(win.range).toBe("CUSTOM");
    expect(win.from).toBe("2006-01-01");
    expect(win.series[0]?.time).toBe("2024-09-11");
    expect(win.series).toHaveLength(dense.length);
  });

  it("from récent ≠ fenêtre 1A", () => {
    const from2006 = applyChartSeriesWindow(dense, { from: "2006-01-01" });
    const oneY = applyChartSeriesWindow(dense, { range: "1Y" });
    expect(from2006.series.length).toBeGreaterThan(oneY.series.length);
  });

  it("1M / 3M / 5A changent réellement la fenêtre", () => {
    const m1 = applyChartSeriesWindow(dense, { range: "1M" });
    const m3 = applyChartSeriesWindow(dense, { range: "3M" });
    const y1 = applyChartSeriesWindow(dense, { range: "1A" });
    const y5 = applyChartSeriesWindow(dense, { range: "5A" });
    expect(m1.series.length).toBeLessThan(m3.series.length);
    expect(m3.series.length).toBeLessThan(y1.series.length);
    expect(y1.series.length).toBeLessThan(y5.series.length);
    expect(y5.series).toHaveLength(dense.length);
  });
});

describe("seriesCoversChartRange", () => {
  it("une série 1A couvre 1M mais pas 5A ni MAX", () => {
    const oneY = applyChartSeriesWindow(dense, { range: "1A" }).series;
    expect(seriesCoversChartRange(oneY, "1M", false)).toBe(true);
    expect(seriesCoversChartRange(oneY, "1A", false)).toBe(true);
    expect(seriesCoversChartRange(oneY, "5A", false)).toBe(false);
    expect(seriesCoversChartRange(oneY, "MAX", false)).toBe(false);
    expect(seriesCoversChartRange(dense, "MAX", true)).toBe(true);
  });
});

describe("seriesCoversIntervalLookback", () => {
  it("ne relance pas si le lookback contigu est épuisé", () => {
    const oneY = applyChartSeriesWindow(dense, { range: "1A" }).series;
    expect(
      seriesCoversIntervalLookback({
        points: oneY,
        range: "1A",
        interval: "1M",
        historyComplete: false,
        lookbackExhausted: true,
      })
    ).toBe(true);
  });
});
