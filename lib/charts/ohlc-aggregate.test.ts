import { describe, expect, it } from "vitest";
import { aggregateCandles } from "./ohlc-aggregate";
import type { ChartClosePoint } from "./indicators";

const daily: ChartClosePoint[] = [
  { time: "2024-01-01", value: 100, volume: 10 },
  { time: "2024-01-02", value: 110, volume: 20 },
  { time: "2024-01-03", value: 105, volume: 15 },
  { time: "2024-01-08", value: 120, volume: 25 },
  { time: "2024-02-01", value: 130, volume: 30 },
];

describe("aggregateCandles", () => {
  it("signale horaire N/D sans intraday", () => {
    const r = aggregateCandles(daily, "1H");
    expect(r.hourlyUnavailable).toBe(true);
    expect(r.candles.length).toBe(daily.length);
  });

  it("agrège en mensuel", () => {
    const r = aggregateCandles(daily, "1M");
    expect(r.hourlyUnavailable).toBe(false);
    expect(r.candles.length).toBe(2);
    expect(r.candles[0]!.open).toBe(100);
    expect(r.candles[0]!.close).toBe(120);
    expect(r.candles[1]!.close).toBe(130);
  });

  it("agrège une série journalière dense en hebdo (lundi ISO)", () => {
    const pts: ChartClosePoint[] = [];
    const d = new Date("2024-01-01T00:00:00.000Z");
    for (let i = 0; i < 20; i++) {
      pts.push({ time: d.toISOString().slice(0, 10), value: 100 + i, volume: 1 });
      d.setUTCDate(d.getUTCDate() + 1);
    }
    const r = aggregateCandles(pts, "1W");
    expect(r.candles.length).toBeGreaterThanOrEqual(3);
    expect(r.candles.length).toBeLessThan(pts.length);
    expect(r.candles[0]!.time).toBe("2024-01-01");
    const mondays = r.candles.map((c) => new Date(`${c.time}T00:00:00.000Z`).getUTCDay());
    expect(mondays.every((dow) => dow === 1)).toBe(true);
  });
});
