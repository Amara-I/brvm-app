import { describe, expect, it } from "vitest";
import { computeTechnicalSnapshot } from "@/lib/charts/technical-indicators";
import { buildChartAnalysis } from "./sheet-model";

function series(n: number, start = 10) {
  const out: { time: string; value: number; volume: number | null }[] = [];
  const d = new Date("2024-01-01T00:00:00.000Z");
  for (let i = 0; i < n; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    out.push({ time: d.toISOString().slice(0, 10), value: Math.round((start + i * 0.05 + Math.sin(i / 3)) * 100) / 100, volume: 1000 });
  }
  return out;
}

describe("buildChartAnalysis (fiche NGX — Analyse graphique)", () => {
  it("série trop courte : indicateurs et score N/D, jamais 0", () => {
    const a = buildChartAnalysis(series(12), [{ year: 2023, dps: 1 }], 8, true);
    expect(a.technical.available).toBe(false);
    expect(a.technical.rsi14).toBeNull();
    expect(a.technical.sma10).toBeNull();
    expect(a.technical.macd).toBeNull();
    expect(a.composite).toBeNull();
  });

  it("série vide : N/D", () => {
    const a = buildChartAnalysis([], [], null, true);
    expect(a.technical.available).toBe(false);
    expect(a.composite).toBeNull();
  });

  it("série suffisante : mêmes indicateurs que la fonction partagée + score et signal", () => {
    const s = series(260);
    const a = buildChartAnalysis(s, [{ year: 2024, dps: 0.5 }], 7.5, true);
    const direct = computeTechnicalSnapshot(s.map((p) => ({ time: p.time, value: p.value, volume: p.volume })));
    expect(a.technical.available).toBe(true);
    expect(a.technical.rsi14).toBe(direct.rsi14);
    expect(a.technical.sma10).toBe(direct.sma10);
    expect(a.technical.sma20).toBe(direct.sma20);
    expect(a.technical.macd).toEqual(direct.macd);
    expect(a.composite).not.toBeNull();
    expect(a.composite!.score).toBeGreaterThanOrEqual(0);
    expect(a.composite!.score).toBeLessThanOrEqual(100);
    expect(typeof a.composite!.signal.label).toBe("string");
    expect(a.composite!.horizonScores).toEqual(
      expect.objectContaining({ court: expect.any(Number), moyen: expect.any(Number), long: expect.any(Number) }),
    );
  });

  it("sans comptes publiés : indicateurs oui, score composite N/D", () => {
    const a = buildChartAnalysis(series(120), [], null, false);
    expect(a.technical.available).toBe(true);
    expect(a.composite).toBeNull();
  });

  it("ignore les points invalides (valeur ≤ 0, date mal formée)", () => {
    const s = [...series(40), { time: "bad", value: 5, volume: null }, { time: "2030-01-01", value: 0, volume: null }];
    const a = buildChartAnalysis(s, [], null, false);
    expect(a.technical.points).toBe(40);
  });
});
