import { describe, expect, it } from "vitest";
import {
  computeEmpiricalVar95,
  computeMaxDrawdownPercent,
  computeRiskAnalysis,
  riskTierFromScore,
  type RiskClosePoint,
} from "./risk-analysis";

function closesFrom(values: number[]): RiskClosePoint[] {
  return values.map((value, i) => ({
    time: `2024-01-${String(i + 1).padStart(2, "0")}`,
    value,
  }));
}

describe("riskTierFromScore", () => {
  it("mappe les seuils du cahier", () => {
    expect(riskTierFromScore(10)).toBe("Très faible");
    expect(riskTierFromScore(25)).toBe("Faible");
    expect(riskTierFromScore(50)).toBe("Modéré");
    expect(riskTierFromScore(70)).toBe("Élevé");
    expect(riskTierFromScore(90)).toBe("Très élevé");
  });
});

describe("computeMaxDrawdownPercent", () => {
  it("mesure le drawdown depuis le pic", () => {
    const dd = computeMaxDrawdownPercent(closesFrom([100, 120, 90, 95]));
    expect(dd).toBe(25);
  });

  it("retourne null si série trop courte", () => {
    expect(computeMaxDrawdownPercent(closesFrom([100, 110]))).toBeNull();
  });
});

describe("computeEmpiricalVar95", () => {
  it("retourne null sous 30 rendements", () => {
    expect(computeEmpiricalVar95(closesFrom(Array.from({ length: 20 }, (_, i) => 100 + i)))).toBeNull();
  });

  it("calcule une VaR positive sur série volatile", () => {
    const vals: number[] = [100];
    for (let i = 0; i < 40; i++) {
      vals.push(vals[i]! * (i % 3 === 0 ? 0.92 : 1.01));
    }
    const var95 = computeEmpiricalVar95(closesFrom(vals));
    expect(var95).not.toBeNull();
    expect(var95!).toBeGreaterThan(0);
  });
});

describe("computeRiskAnalysis", () => {
  const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  const prices = Object.fromEntries(years.map((y, i) => [y, 1000 + i * 50]));
  const dividends = Object.fromEntries(years.map((y) => [y, 40]));

  it("produit un score, un tier et 4 piliers", () => {
    const r = computeRiskAnalysis({
      years,
      prices,
      dividends,
      per: 9,
      mktcap: 200,
      sector: "Télécoms",
      volatilityPercent: "8.5",
      historyDepth: 8,
    });
    expect(r.riskScore).toBeGreaterThanOrEqual(0);
    expect(r.riskScore).toBeLessThanOrEqual(100);
    expect(r.pillars).toHaveLength(4);
    expect(r.riskTier).toMatch(/faible|Modéré|Élevé/i);
    expect(r.summary.length).toBeGreaterThan(20);
  });

  it("redistribue les poids si un pilier est N/D", () => {
    const r = computeRiskAnalysis({
      years,
      prices,
      dividends,
      per: 10,
      // pas de mktcap ni closes → liquidité N/D
      volatilityPercent: "12",
      historyDepth: 8,
      sector: "Banques",
    });
    const liq = r.pillars.find((p) => p.key === "liquidite")!;
    expect(liq.score).toBeNull();
    expect(liq.weight).toBe(0);
    const sumW = r.pillars.reduce((a, p) => a + p.weight, 0);
    expect(sumW).toBeGreaterThan(0.99);
    expect(sumW).toBeLessThan(1.01);
  });

  it("pénalise un PER extrême et un secteur cyclique", () => {
    const low = computeRiskAnalysis({
      years,
      prices,
      dividends,
      per: 9,
      mktcap: 400,
      sector: "Télécoms",
      volatilityPercent: "7",
      historyDepth: 10,
    });
    const high = computeRiskAnalysis({
      years,
      prices,
      dividends: Object.fromEntries(years.map((y) => [y, 0])),
      per: 55,
      mktcap: 5,
      sector: "Énergie",
      volatilityPercent: "35",
      historyDepth: 3,
    });
    expect(high.riskScore).toBeGreaterThan(low.riskScore);
  });
});
