import { describe, expect, it } from "vitest";
import {
  closesToCandles,
  computeSma,
  dedupeChartPointsByDay,
  normalizeTo100,
  rangeFilter,
  type ChartClosePoint,
} from "./indicators";

const sample: ChartClosePoint[] = [
  { time: "2020-12-31", value: 100 },
  { time: "2021-12-31", value: 110 },
  { time: "2022-12-31", value: 120 },
  { time: "2023-12-31", value: 130 },
  { time: "2024-12-31", value: 140 },
  { time: "2025-12-31", value: 150 },
  { time: "2026-08-10", value: 160 },
];

describe("computeSma", () => {
  it("calcule une SMA 3", () => {
    const sma = computeSma(sample, 3);
    expect(sma).toHaveLength(5);
    expect(sma[0]).toEqual({ time: "2022-12-31", value: 110 });
  });
});

describe("normalizeTo100", () => {
  it("ancre le premier point à 100", () => {
    const n = normalizeTo100(sample);
    expect(n[0]?.value).toBe(100);
    expect(n[n.length - 1]?.value).toBe(160);
  });
});

describe("rangeFilter", () => {
  it("filtre 1A à partir d'une date de référence", () => {
    const filtered = rangeFilter(sample, "1A", new Date("2026-08-10T00:00:00.000Z"));
    expect(filtered.map((p) => p.time)).toEqual(["2025-12-31", "2026-08-10"]);
  });
});

describe("dedupeChartPointsByDay", () => {
  it("conserve un seul point par jour (dernier gagne)", () => {
    const pts: ChartClosePoint[] = [
      { time: "2026-08-21", value: 100 },
      { time: "2026-08-21T15:00:00.000Z", value: 110 },
      { time: "2026-08-22", value: 120 },
    ];
    expect(dedupeChartPointsByDay(pts)).toEqual([
      { time: "2026-08-21", value: 110, volume: null },
      { time: "2026-08-22", value: 120, volume: null },
    ]);
  });

  it("closesToCandles refuse les dates dupliquées", () => {
    const candles = closesToCandles([
      { time: "2026-08-20", value: 100 },
      { time: "2026-08-21", value: 105 },
      { time: "2026-08-21", value: 110 },
    ]);
    expect(candles.map((c) => c.time)).toEqual(["2026-08-20", "2026-08-21"]);
    expect(candles[1]?.close).toBe(110);
  });
});
