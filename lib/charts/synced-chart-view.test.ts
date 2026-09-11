import { describe, expect, it } from "vitest";
import { computeSma, type ChartClosePoint } from "./indicators";
import { clipPointsToRange } from "./indicator-lookback";
import { alignSeriesToInterval, buildSyncedChartView } from "./synced-chart-view";
import { sliceContiguousLookback } from "./contiguous-lookback";

function tradingDays(n: number, start = "2021-01-04", startPrice = 100): ChartClosePoint[] {
  const out: ChartClosePoint[] = [];
  const d = new Date(`${start}T00:00:00.000Z`);
  let i = 0;
  while (out.length < n) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      out.push({
        time: d.toISOString().slice(0, 10),
        value: startPrice + i,
        volume: 100 + i,
      });
      i += 1;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

describe("buildSyncedChartView", () => {
  const full = tradingDays(1300, "2021-09-13", 1000);
  const last = full[full.length - 1]!;
  const from5y = "2021-09-13";

  it("1j / 1S / 1M changent le nombre de bougies sur 5 ans denses", () => {
    const daily = buildSyncedChartView({
      fullPoints: full,
      visibleFrom: from5y,
      visibleTo: last.time,
      interval: "1D",
      lookbackBars: 20,
    });
    const weekly = buildSyncedChartView({
      fullPoints: full,
      visibleFrom: from5y,
      visibleTo: last.time,
      interval: "1W",
      lookbackBars: 20,
    });
    const monthly = buildSyncedChartView({
      fullPoints: full,
      visibleFrom: from5y,
      visibleTo: last.time,
      interval: "1M",
      lookbackBars: 20,
    });

    expect(daily.candles.length).toBe(full.length);
    expect(weekly.candles.length).toBeGreaterThan(200);
    expect(weekly.candles.length).toBeLessThan(daily.candles.length / 3);
    expect(monthly.candles.length).toBeGreaterThan(50);
    expect(monthly.candles.length).toBeLessThan(70);
    expect(monthly.candles.length).toBeLessThan(weekly.candles.length / 2);
  });

  it("SMA 20 et volume partagent les timestamps des bougies (pas de décalage)", () => {
    const continuous = tradingDays(800, "2020-12-01", 800);
    const view = buildSyncedChartView({
      fullPoints: continuous,
      visibleFrom: continuous[200]!.time,
      visibleTo: continuous[continuous.length - 1]!.time,
      interval: "1W",
      lookbackBars: 20,
    });
    const candleTimes = new Set(view.candles.map((c) => c.time));
    const sma = clipPointsToRange(
      computeSma(view.indicatorCloses, 20),
      view.candles[0]!.time,
      view.candles[view.candles.length - 1]!.time
    );
    expect(sma[0]?.time).toBe(view.candles[0]!.time);
    for (const p of sma) {
      expect(candleTimes.has(p.time)).toBe(true);
    }
    for (const c of view.candles) {
      expect(c.volume == null || c.volume >= 0).toBe(true);
    }
    expect(view.candles.every((c) => view.indicatorCloses.some((p) => p.time === c.time))).toBe(
      true
    );
  });

  it("5A + mensuel : une bougie par mois, pas les jours bruts", () => {
    const view = buildSyncedChartView({
      fullPoints: full,
      visibleFrom: from5y,
      visibleTo: last.time,
      interval: "1M",
      lookbackBars: 20,
    });
    const months = view.candles.map((c) => c.time.slice(0, 7));
    expect(new Set(months).size).toBe(months.length);
    expect(view.candles[0]!.time.endsWith("-01")).toBe(true);
  });

  it("ne greffe pas un lookback 2008 sur une fenêtre 2021 (trou)", () => {
    const sparse: ChartClosePoint[] = [
      ...tradingDays(20, "2008-03-03", 18000),
      { time: "2018-12-31", value: 16000, volume: 10 },
      { time: "2020-12-31", value: 13500, volume: 10 },
      { time: "2021-09-13", value: 13500, volume: 10 },
      { time: "2021-10-01", value: 14100, volume: 10 },
      { time: "2021-11-01", value: 13980, volume: 10 },
    ];
    const view = buildSyncedChartView({
      fullPoints: sparse,
      visibleFrom: "2021-09-13",
      visibleTo: "2021-11-01",
      interval: "1D",
      lookbackBars: 20,
    });
    expect(view.candles.map((c) => c.time)).toEqual([
      "2021-09-13",
      "2021-10-01",
      "2021-11-01",
    ]);
    expect(view.indicatorCloses.every((p) => p.time >= "2021-09-13")).toBe(true);
    expect(view.indicatorCloses.some((p) => p.time.startsWith("2008"))).toBe(false);
  });
});

describe("alignSeriesToInterval", () => {
  it("agrège la comparaison sur le même intervalle", () => {
    const pts = tradingDays(60, "2024-01-02", 50);
    const weekly = alignSeriesToInterval(pts, "1W", pts[0]!.time, pts[pts.length - 1]!.time);
    expect(weekly.length).toBeLessThan(pts.length);
    expect(weekly.length).toBeGreaterThan(8);
  });
});

describe("sliceContiguousLookback", () => {
  it("coupe un trou annuel (SNTS-like)", () => {
    const points: ChartClosePoint[] = [
      { time: "2008-06-02", value: 18000 },
      { time: "2020-12-31", value: 13500 },
      { time: "2021-09-13", value: 13500 },
      { time: "2021-10-01", value: 14100 },
    ];
    const sliced = sliceContiguousLookback(points, "2021-09-13", { maxDays: 420 });
    expect(sliced.points).toEqual([]);
    expect(sliced.exhausted).toBe(true);
  });

  it("garde les séances denses juste avant la fenêtre", () => {
    const points = tradingDays(40, "2021-07-01", 100);
    const windowStart = points[30]!.time;
    const sliced = sliceContiguousLookback(points, windowStart, { maxDays: 420, maxPoints: 800 });
    expect(sliced.points.length).toBe(30);
    expect(sliced.points[sliced.points.length - 1]!.time < windowStart).toBe(true);
  });
});
