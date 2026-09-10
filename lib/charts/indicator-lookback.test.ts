import { describe, expect, it } from "vitest";
import { buildIndicatorWindow, clipPointsToRange } from "./indicator-lookback";
import { computeSma, type ChartClosePoint } from "./indicators";

function daily(n: number, start = "2024-01-01", startPrice = 100): ChartClosePoint[] {
  const out: ChartClosePoint[] = [];
  const d0 = new Date(`${start}T00:00:00.000Z`);
  for (let i = 0; i < n; i++) {
    const d = new Date(d0);
    d.setUTCDate(d0.getUTCDate() + i);
    out.push({ time: d.toISOString().slice(0, 10), value: startPrice + i });
  }
  return out;
}

describe("clipPointsToRange", () => {
  it("conserve les bornes inclusives", () => {
    const pts = daily(5);
    const clipped = clipPointsToRange(pts, pts[1]!.time, pts[3]!.time);
    expect(clipped).toHaveLength(3);
    expect(clipped[0]?.time).toBe(pts[1]!.time);
    expect(clipped[2]?.time).toBe(pts[3]!.time);
  });
});

describe("buildIndicatorWindow + SMA lookback", () => {
  it("SMA 200 couvre toute la fenêtre visible si l'historique le permet", () => {
    const full = daily(400, "2024-01-01", 1000);
    const visibleFrom = full[200]!.time;
    const visibleTo = full[399]!.time;

    const { closes } = buildIndicatorWindow({
      fullPoints: full,
      visibleFrom,
      visibleTo,
      interval: "1D",
      lookbackBars: 200,
    });

    const sma = clipPointsToRange(computeSma(closes, 200), visibleFrom, visibleTo);
    expect(sma.length).toBeGreaterThan(0);
    expect(sma[0]?.time).toBe(visibleFrom);
    expect(sma[sma.length - 1]?.time).toBe(visibleTo);
  });

  it("sans lookback suffisant, la SMA démarre dès qu'elle est calculable puis va jusqu'à la fin", () => {
    const full = daily(250, "2024-01-01", 100);
    const visibleFrom = full[0]!.time;
    const visibleTo = full[249]!.time;

    const { closes } = buildIndicatorWindow({
      fullPoints: full,
      visibleFrom,
      visibleTo,
      interval: "1D",
      lookbackBars: 200,
    });

    const sma = clipPointsToRange(computeSma(closes, 200), visibleFrom, visibleTo);
    expect(sma[0]?.time).toBe(full[199]!.time);
    expect(sma[sma.length - 1]?.time).toBe(visibleTo);
  });
});
