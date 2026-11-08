import { describe, expect, it } from "vitest";
import { rewardWeight, sizePosition } from "./position-size";

const base = {
  capitalFcfa: 1_000_000,
  riskPercent: 1,
  entryFcfa: 1000,
  stopFcfa: 900,
  targetFcfa: 1300,
  liquidityMaxShares: null,
  stockLimitPct: 15,
};

describe("sizePosition", () => {
  it("dimensionne au budget de risque, arrondi vers le bas", () => {
    const plan = sizePosition({ ...base, stopFcfa: 700, targetFcfa: null });
    expect(plan.riskBudgetFcfa).toBe(10_000);
    expect(plan.riskPerShareFcfa).toBe(300);
    expect(plan.sharesByRisk).toBe(33);
    expect(plan.rewardWeight).toBe(1);
    expect(plan.suggestedShares).toBe(33);
    expect(plan.binding).toBe("risk");
  });

  it("réduit la taille quand le rapport rendement/risque est inférieur à 1", () => {
    const plan = sizePosition({ ...base, targetFcfa: 1050 });
    expect(plan.riskReward).toBeCloseTo(0.5);
    expect(plan.rewardWeight).toBe(0.5);
    expect(plan.sharesByRisk).toBe(100);
    expect(plan.sharesAfterReward).toBe(50);
    expect(plan.suggestedShares).toBe(50);
    expect(plan.binding).toBe("reward");
  });

  it("retrouve le plein budget quand le rapport atteint 2,5", () => {
    expect(rewardWeight(1)).toBe(0.5);
    expect(rewardWeight(1.75)).toBeCloseTo(0.75);
    expect(rewardWeight(2.5)).toBe(1);
    expect(rewardWeight(null)).toBe(1);
    const plan = sizePosition({ ...base, targetFcfa: 1150 });
    expect(plan.riskReward).toBeCloseTo(1.5);
    expect(plan.suggestedShares).toBe(plan.sharesAfterReward);
    expect(plan.suggestedShares).toBeLessThan(plan.sharesByRisk as number);
  });

  it("plafonne par la liquidité puis par le poids du titre", () => {
    const illiquid = sizePosition({ ...base, liquidityMaxShares: 20 });
    expect(illiquid.suggestedShares).toBe(20);
    expect(illiquid.binding).toBe("liquidity");

    const concentrated = sizePosition({ ...base, stockLimitPct: 4 });
    expect(concentrated.concentrationMaxShares).toBe(40);
    expect(concentrated.suggestedShares).toBe(40);
    expect(concentrated.binding).toBe("concentration");
  });

  it("ne propose rien sans stop valide", () => {
    expect(sizePosition({ ...base, stopFcfa: null }).binding).toBe("unavailable");
    expect(sizePosition({ ...base, stopFcfa: 1000 }).suggestedShares).toBeNull();
    expect(sizePosition({ ...base, capitalFcfa: 0 }).binding).toBe("unavailable");
  });
});
