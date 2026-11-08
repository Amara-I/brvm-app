import { describe, expect, it } from "vitest";
import { setupsFromCloses } from "./load-technical-setups";
import { resolveTechnicalPlan } from "./technical-plan";

function day(index: number): string {
  const date = new Date(Date.UTC(2022, 0, 3));
  date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString().slice(0, 10);
}

function trend(count: number, start: number, step: number) {
  const points = [];
  let price = start;
  for (let i = 0; i < count; i++) {
    const phase = i % 12;
    price += phase < 8 ? step : step * -0.65;
    points.push({ time: day(i), value: Math.round(price), volume: 12000 });
  }
  return points;
}

describe("setupsFromCloses", () => {
  it("alimente le dimensionnement avec l'invalidation et l'objectif techniques", () => {
    const [setup] = setupsFromCloses({ snts: trend(180, 1000, 8) });
    expect(setup).toBeTruthy();
    expect(setup!.ticker).toBe("SNTS");
    expect(setup!.source).toBe("technical");
    expect(setup!.referencePrice).toBeGreaterThan(0);
    expect(setup!.invalidation).not.toBeNull();
    expect(setup!.target).not.toBeNull();

    const plan = resolveTechnicalPlan({
      ticker: "snts",
      entry: setup!.referencePrice,
      setup,
      holdingStop: 1,
      holdingTarget: setup!.referencePrice * 3,
    });
    expect(plan.source).toBe("technical");
    expect(plan.stop).toBe(setup!.invalidation);
    if (setup!.target != null && setup!.target > setup!.referencePrice) {
      expect(plan.target).toBe(setup!.target);
    }
  });

  it("omet un titre sans historique exploitable", () => {
    expect(setupsFromCloses({ ABJC: [{ time: "2024-01-02", value: 1000, volume: 10 }] })).toEqual([]);
  });
});
