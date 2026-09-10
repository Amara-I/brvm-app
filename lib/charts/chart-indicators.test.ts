import { describe, expect, it } from "vitest";
import type { ChartCandle } from "./indicators";
import {
  computeAdxSeries,
  computeAverageDailyVolume,
  computeCciSeries,
  computeStochasticSeries,
  computeWilliamsRSeries,
} from "./chart-indicators";

function risingCandles(n: number): ChartCandle[] {
  return Array.from({ length: n }, (_, i) => {
    const close = 100 + i;
    return {
      time: `2024-01-${String((i % 28) + 1).padStart(2, "0")}`,
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000 + i * 10,
    };
  });
}

describe("computeAdxSeries", () => {
  it("produit ADX après warm-up Wilder", () => {
    const { adx, plusDi, minusDi } = computeAdxSeries(risingCandles(60), 14);
    expect(adx.length).toBeGreaterThan(0);
    expect(plusDi.length).toBeGreaterThan(0);
    expect(minusDi.length).toBeGreaterThan(0);
    const last = adx[adx.length - 1]!;
    expect(last.value).toBeGreaterThanOrEqual(0);
    expect(last.value).toBeLessThanOrEqual(100);
  });

  it("série trop courte → vide", () => {
    expect(computeAdxSeries(risingCandles(10)).adx).toEqual([]);
  });
});

describe("computeStochasticSeries", () => {
  it("borne %K entre 0 et 100", () => {
    const { k, d } = computeStochasticSeries(risingCandles(40));
    expect(k.length).toBeGreaterThan(0);
    expect(d.length).toBeGreaterThan(0);
    for (const p of k) {
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(100);
    }
  });
});

describe("computeWilliamsRSeries", () => {
  it("borne %R entre -100 et 0", () => {
    const wr = computeWilliamsRSeries(risingCandles(40));
    expect(wr.length).toBeGreaterThan(0);
    for (const p of wr) {
      expect(p.value).toBeGreaterThanOrEqual(-100);
      expect(p.value).toBeLessThanOrEqual(0);
    }
  });
});

describe("computeCciSeries", () => {
  it("calcule CCI sur tendance", () => {
    const cci = computeCciSeries(risingCandles(40));
    expect(cci.length).toBeGreaterThan(0);
    expect(Number.isFinite(cci[cci.length - 1]!.value)).toBe(true);
  });
});

describe("computeAverageDailyVolume", () => {
  it("N/D si aucun volume", () => {
    expect(computeAverageDailyVolume([{ volume: null }, { volume: 0 }])).toBeNull();
  });

  it("moyenne des derniers volumes > 0", () => {
    expect(computeAverageDailyVolume([{ volume: 100 }, { volume: 200 }, { volume: 300 }], 2)).toBe(
      250
    );
  });
});
