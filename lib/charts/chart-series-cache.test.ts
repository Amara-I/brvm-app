import { describe, expect, it } from "vitest";
import {
  cacheRangeKeyForQuery,
  fromCompactPoints,
  sliceForCacheRange,
  toCompactPoints,
  buildChartSeriesMeta,
} from "./chart-series-cache";
import type { ChartClosePoint } from "./indicators";

function pts(n: number, start = "2025-01-01"): ChartClosePoint[] {
  const d = new Date(`${start}T00:00:00.000Z`);
  const out: ChartClosePoint[] = [];
  for (let i = 0; i < n; i++) {
    const day = new Date(d);
    day.setUTCDate(d.getUTCDate() + i);
    out.push({ time: day.toISOString().slice(0, 10), value: 100 + i, volume: i === n - 1 ? 10 : null });
  }
  return out;
}

describe("chart-series-cache", () => {
  it("mappe les ranges UI vers une clé de cache compacte", () => {
    expect(cacheRangeKeyForQuery("1Y")).toBe("1A");
    expect(cacheRangeKeyForQuery("1M")).toBe("1M");
    expect(cacheRangeKeyForQuery("MAX")).toBe("MAX");
    expect(cacheRangeKeyForQuery("5A")).toBe("5A");
  });

  it("rond-trip compact JSON sans perdre clôture / volume", () => {
    const series = [
      { time: "2026-09-14", value: 100, volume: null },
      { time: "2026-09-15", value: 105, volume: 1200 },
    ];
    expect(fromCompactPoints(toCompactPoints(series))).toEqual([
      { time: "2026-09-14", value: 100, volume: null },
      { time: "2026-09-15", value: 105, volume: 1200 },
    ]);
  });

  it("1A est plus court que MAX (padding lookback inclus)", () => {
    const full = pts(800);
    const oneY = sliceForCacheRange(full, "1A");
    expect(oneY.length).toBeLessThan(full.length);
    expect(oneY.length).toBeGreaterThan(300);
    expect(sliceForCacheRange(full, "MAX")).toHaveLength(full.length);
  });

  it("SPARK reste compact", () => {
    const spark = sliceForCacheRange(pts(500), "SPARK");
    expect(spark.length).toBeLessThan(200);
    expect(spark.length).toBeGreaterThan(10);
  });

  it("meta expose lastClose et yearlyCloses", () => {
    const full = pts(10, "2026-01-01");
    const meta = buildChartSeriesMeta(full, ["BRVM_OFFICIEL"]);
    expect(meta.lastClose).toBe(109);
    expect(meta.yearlyCloses["2026"]).toBe(109);
    expect(meta.historyPoints).toBe(10);
  });
});
