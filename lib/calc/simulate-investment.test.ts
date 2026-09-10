import { describe, expect, it } from "vitest";
import { simulateInvestment, simulateInvestmentScenarios } from "./simulate-investment";

describe("simulateInvestment", () => {
  it("sans versement : capitalise le départ", () => {
    const r = simulateInvestment({
      initialCapital: 1_000_000,
      contribution: 0,
      frequency: "annuel",
      years: 2,
      annualReturnPercent: 10,
    });
    expect(r.totalContributed).toBe(1_000_000);
    expect(r.finalValue).toBe(Math.round(1_000_000 * 1.1 * 1.1));
    expect(r.points).toHaveLength(3); // 0, 1, 2
  });

  it("versements mensuels augmentent le cumul versé", () => {
    const r = simulateInvestment({
      initialCapital: 0,
      contribution: 10_000,
      frequency: "mensuel",
      years: 1,
      annualReturnPercent: 0,
    });
    expect(r.totalContributed).toBe(120_000);
    expect(r.finalValue).toBe(120_000);
    expect(r.totalGain).toBe(0);
  });

  it("scénarios divergent avec le spread", () => {
    const base = {
      initialCapital: 500_000,
      contribution: 20_000,
      frequency: "mensuel" as const,
      years: 5,
      annualReturnPercent: 8,
    };
    const s = simulateInvestmentScenarios(base, 3);
    expect(s.optimistic.finalValue).toBeGreaterThan(s.central.finalValue);
    expect(s.pessimistic.finalValue).toBeLessThan(s.central.finalValue);
  });
});
