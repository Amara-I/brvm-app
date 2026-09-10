import { describe, expect, it } from "vitest";
import { computeFinancialHealth } from "./financial-health";
import type { CalcMetricsResult } from "./calc-metrics";

const base: CalcMetricsResult = {
  perf5Percent: "33.3",
  perf10Percent: "128.6",
  avgDividend: "1500",
  dividendYieldPercent: "5.17",
  volatilityPercent: "7.9",
  riskLevel: "Faible",
  score: 72,
  signal: { label: "ACHAT", color: "#22c55e" },
  currentPrice: 32000,
  currentDividend: 1650,
  historyDepth: 12,
  confidence: "Élevée",
  signalSummary: "test",
  signalReasons: [],
  horizonScores: { court: 60, moyen: 70, long: 75 },
  technicalScore: 68,
  fundamentalScore: 72,
  compositeScore: 72,
  riskAnalysis: {
    riskScore: 32,
    riskTier: "Faible",
    pillars: [],
    summary: "Risque faible",
    maxDrawdownPercent: null,
    var95Percent: null,
    var99Percent: null,
    cvar95Percent: null,
  },
  technical: {
    available: false,
    points: 0,
    rsi14: null,
    sma10: null,
    sma20: null,
    sma50: null,
    sma200: null,
    macd: null,
    maCross: "N/D",
    shortTermScore: null,
    notes: [],
  },
  sectorScore: 60,
};

describe("computeFinancialHealth", () => {
  it("produit un score 0–10 et 4 piliers", () => {
    const h = computeFinancialHealth(base, 7.74);
    expect(h.pillars).toHaveLength(4);
    expect(h.overall).toBeGreaterThanOrEqual(0);
    expect(h.overall).toBeLessThanOrEqual(10);
    expect(["Solide", "Correcte", "Fragile", "N/D"]).toContain(h.label);
  });
});
