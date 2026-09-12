import { describe, expect, it } from "vitest";
import { fillDailySeries, parseAnalyticsDays, rankCounts, sinceDate } from "./aggregate";

describe("parseAnalyticsDays", () => {
  it("n'accepte que 7 ou 30", () => {
    expect(parseAnalyticsDays("30")).toBe(30);
    expect(parseAnalyticsDays("7")).toBe(7);
    expect(parseAnalyticsDays("99")).toBe(7);
    expect(parseAnalyticsDays(undefined)).toBe(7);
  });
});

describe("fillDailySeries", () => {
  it("remplit les jours manquants à 0", () => {
    const now = new Date("2026-09-12T12:00:00.000Z");
    const series = fillDailySeries({ "2026-09-12": 4, "2026-09-10": 1 }, 7, now);
    expect(series).toHaveLength(7);
    expect(series[0]?.date).toBe("2026-09-06");
    expect(series[0]?.count).toBe(0);
    expect(series[4]?.date).toBe("2026-09-10");
    expect(series[4]?.count).toBe(1);
    expect(series[6]).toEqual({ date: "2026-09-12", count: 4 });
  });
});

describe("rankCounts", () => {
  it("trie par volume puis clé", () => {
    expect(rankCounts([{ key: "b", count: 2 }, { key: "a", count: 2 }, { key: "c", count: 5 }], 2)).toEqual([
      { key: "c", count: 5 },
      { key: "a", count: 2 },
    ]);
  });
});

describe("sinceDate", () => {
  it("remonte de 7 ou 30 jours", () => {
    const now = new Date("2026-09-12T00:00:00.000Z");
    expect(sinceDate(7, now).toISOString()).toBe("2026-09-05T00:00:00.000Z");
    expect(sinceDate(30, now).toISOString()).toBe("2026-08-13T00:00:00.000Z");
  });
});
