import { describe, expect, it } from "vitest";
import { analyzePriceHistory } from "@/lib/technical-analysis/analyze";
import { formatPrice, formatPriceRange } from "@/lib/technical-analysis/level-label";
import { chartLevelLines } from "@/lib/technical-analysis/chart-lines";
import {
  buildIndexReading,
  computeBreadth,
  computeIndexRisk,
  indexReadingLabel,
} from "@/lib/markets/index-insights";
import type { ConstituentMove, IndexSeriesPoint } from "@/lib/markets/index-sheet";

function daily(n: number, start = "2025-01-01", f: (i: number) => number = (i) => 100 + i * 0.2 + Math.sin(i / 5) * 3) {
  const out: IndexSeriesPoint[] = [];
  const d = new Date(`${start}T00:00:00.000Z`);
  for (let i = 0; i < n; i++) {
    out.push({ time: d.toISOString().slice(0, 10), value: Math.round(f(i) * 100) / 100 });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

describe("points d'indice", () => {
  it("formate en pts avec 2 décimales", () => {
    expect(formatPrice(515.94, "PTS")).toBe("515,94 pts");
    expect(formatPrice(252269.16, "PTS")).toBe("252 269,16 pts");
    expect(formatPriceRange(498.1, 503.25, "PTS")).toBe("498,10 – 503,25 pts");
    expect(formatPrice(515.94, "PTS", "en")).toBe("515.94 pts");
  });

  it("formule les scénarios pour un indice, sans « cours »", () => {
    const analysis = analyzePriceHistory(daily(400), { currency: "PTS" });
    expect(analysis.currency).toBe("PTS");
    for (const sc of analysis.scenarios) {
      expect(sc.headlineFr).not.toMatch(/le cours/i);
      expect(sc.explanationFr).not.toMatch(/le cours/i);
    }
    expect(analysis.scenarios.find((s) => s.bias === "bullish")!.headlineFr).toContain("l'indice");
    const lines = chartLevelLines(analysis, "fr");
    expect(lines.find((l) => l.id === "last")?.title).toMatch(/^Niveau {2}\d/);
    expect(lines.some((l) => l.title.startsWith("Entrée"))).toBe(false);
  });

  it("garde la formulation des actions en FCFA", () => {
    const analysis = analyzePriceHistory(daily(400));
    expect(analysis.scenarios.find((s) => s.bias === "bullish")!.headlineFr).toContain("le cours");
    expect(chartLevelLines(analysis, "fr").find((l) => l.id === "last")?.title).toMatch(/^Cours/);
  });
});

describe("computeIndexRisk", () => {
  it("calcule volatilité, repli max et écarts 52 semaines", () => {
    const series = daily(400);
    const risk = computeIndexRisk(series, { athValue: 200 });
    expect(risk.volatility1YPercent).toBeGreaterThan(0);
    expect(risk.maxDrawdown1YPercent).toBeLessThanOrEqual(0);
    expect(risk.fromHigh52wPercent).toBeLessThanOrEqual(0);
    expect(risk.fromLow52wPercent).toBeGreaterThanOrEqual(0);
    expect(risk.fromAthPercent).toBeLessThan(0);
  });

  it("repli max exact sur une série simple", () => {
    const series = [
      { time: "2026-01-01", value: 100 },
      { time: "2026-01-02", value: 120 },
      { time: "2026-01-03", value: 90 },
      { time: "2026-01-04", value: 110 },
    ];
    expect(computeIndexRisk(series).maxDrawdown1YPercent).toBe(-25);
    expect(computeIndexRisk(series).volatility1YPercent).toBeNull();
  });

  it("N/D sans données", () => {
    const risk = computeIndexRisk([]);
    expect(risk).toEqual({
      volatility1YPercent: null,
      maxDrawdown1YPercent: null,
      fromHigh52wPercent: null,
      fromLow52wPercent: null,
      fromAthPercent: null,
    });
  });
});

describe("computeBreadth", () => {
  const move = (ticker: string, changePercent: number | null, sessionDate = "2026-11-13"): ConstituentMove => ({
    ticker,
    name: ticker,
    sector: "x",
    board: null,
    close: 100,
    changePercent,
    sessionDate,
  });

  it("compte hausses, baisses, stables sur la dernière séance commune", () => {
    const b = computeBreadth(
      [move("A", 2), move("B", -1), move("C", 0), move("D", 5), move("E", -3), move("OLD", 9, "2026-10-01"), move("ND", null)],
      "official"
    )!;
    expect(b).toMatchObject({ sessionDate: "2026-11-13", up: 2, down: 2, flat: 1, total: 5, basis: "official" });
    expect(b.topGainers.map((r) => r.ticker)).toEqual(["D", "A"]);
    expect(b.topLosers.map((r) => r.ticker)).toEqual(["E", "B"]);
  });

  it("null si trop peu de valeurs", () => {
    expect(computeBreadth([move("A", 1)], "universe")).toBeNull();
    expect(computeBreadth([], "universe")).toBeNull();
  });
});

describe("buildIndexReading", () => {
  it("produit une lecture avec chiffres mis en avant et sans vocabulaire d'achat", () => {
    const series = daily(400);
    const analysis = analyzePriceHistory(series, { currency: "PTS" });
    const last = series[series.length - 1]!;
    const lines = buildIndexReading({
      name: "BRVM Composite",
      lastValue: last.value,
      lastDate: last.time,
      sessionChangePercent: -0.92,
      changeYtdPercent: 12.3,
      change1YPercent: 20.1,
      high52w: Math.max(...series.slice(-365).map((p) => p.value)),
      low52w: Math.min(...series.slice(-365).map((p) => p.value)),
      risk: computeIndexRisk(series),
      analysis,
      breadth: { sessionDate: last.time, up: 18, down: 12, flat: 5, total: 35, topGainers: [], topLosers: [], basis: "universe" },
    });
    const ids = lines.map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining(["level", "range", "trend", "momentum", "risk", "scenario", "breadth"]));
    const text = lines.map((l) => l.segments.map((s) => s.text).join("")).join("\n");
    expect(text).toContain("BRVM Composite termine la séance du");
    expect(text).toContain("−0,92 %");
    expect(text).toContain("+12,3 %");
    expect(text).toContain("18 hausses");
    expect(text).not.toMatch(/achat|entrée|acheter/i);
    const level = lines.find((l) => l.id === "level")!;
    expect(level.segments.find((s) => s.text === "−0,92 %")).toMatchObject({ strong: true, tone: "neg" });
  });

  it("omet les phrases sans données", () => {
    const lines = buildIndexReading({
      name: "X",
      lastValue: null,
      lastDate: null,
      sessionChangePercent: null,
      changeYtdPercent: null,
      change1YPercent: null,
      high52w: null,
      low52w: null,
      risk: computeIndexRisk([]),
      analysis: null,
      breadth: null,
    });
    expect(lines).toEqual([]);
  });

  it("libellés de lecture d'indice", () => {
    expect(indexReadingLabel("ACHAT FORT")).toBe("Haussier fort");
    expect(indexReadingLabel("CONSERVER")).toBe("Neutre");
    expect(indexReadingLabel("VENDRE", "en")).toBe("Strong bearish");
  });
});
