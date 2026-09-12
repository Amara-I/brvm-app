import { describe, expect, it } from "vitest";
import { computeIndexStats, windowIndexSeries } from "./index-stats";

const SERIES = [
  { time: "2025-01-02", value: 500, changePercent: 0.1 },
  { time: "2025-06-02", value: 520, changePercent: 0.2 },
  { time: "2025-12-31", value: 540, changePercent: -0.1 },
  { time: "2026-01-15", value: 550, changePercent: 1.85 },
  { time: "2026-08-10", value: 552.75, changePercent: 0.18 },
  { time: "2026-09-10", value: 560, changePercent: 1.31 },
];

describe("computeIndexStats", () => {
  it("utilise la variation de séance ingérée et calcule les horizons", () => {
    const stats = computeIndexStats(SERIES);
    expect(stats.lastValue).toBe(560);
    expect(stats.lastDate).toBe("2026-09-10");
    expect(stats.sessionChangePercent).toBe(1.31);
    expect(stats.historyPoints).toBe(6);
    expect(stats.firstDate).toBe("2025-01-02");
    expect(stats.changeYtdPercent).toBeCloseTo(((560 - 540) / 540) * 100, 1);
    expect(stats.change1YPercent).toBeCloseTo(((560 - 520) / 520) * 100, 1);
    expect(stats.high52w).toBe(560);
    expect(stats.low52w).toBe(540);
  });

  it("retombe sur N/D si la série est vide", () => {
    const stats = computeIndexStats([]);
    expect(stats.lastValue).toBeNull();
    expect(stats.sessionChangePercent).toBeNull();
    expect(stats.historyPoints).toBe(0);
  });

  it("calcule la variation séance si le champ source est absent", () => {
    const stats = computeIndexStats([
      { time: "2026-09-09", value: 100 },
      { time: "2026-09-10", value: 110 },
    ]);
    expect(stats.sessionChangePercent).toBe(10);
  });
});

describe("windowIndexSeries", () => {
  it("conserve tout l'historique en MAX", () => {
    expect(windowIndexSeries(SERIES, "MAX")).toHaveLength(SERIES.length);
  });
});
