import { describe, expect, it } from "vitest";
import { loadTechnicalSetups } from "./load-technical-setups";
import {
  ATR_STOP_MULTIPLE,
  ATR_TARGET_MULTIPLE,
  averageTrueRange,
  resolveTechnicalPlan,
  type PriceBar,
} from "./technical-plan";

function daily(closes: number[], withRange = false): PriceBar[] {
  const start = new Date("2026-01-01T00:00:00.000Z");
  return closes.map((close, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return {
      date: date.toISOString().slice(0, 10),
      close,
      high: withRange ? close + 2 : null,
      low: withRange ? close - 2 : null,
    };
  });
}

describe("resolveTechnicalPlan", () => {
  it("retient l'invalidation et l'objectif du module technique", () => {
    const plan = resolveTechnicalPlan({
      ticker: "snts",
      entry: 1000,
      setup: {
        ticker: "SNTS",
        referencePrice: 980,
        invalidation: 900,
        target: 1300,
        riskReward: 99,
        source: "technical",
      },
    });
    expect(plan.source).toBe("technical");
    expect(plan.stop).toBe(900);
    expect(plan.target).toBe(1300);
    expect(plan.riskReward).toBeCloseTo(3);
  });

  it("conserve une invalidation déjà dépassée par le cours", () => {
    const plan = resolveTechnicalPlan({
      ticker: "SGBC",
      entry: 500,
      setup: {
        ticker: "SGBC",
        referencePrice: 500,
        invalidation: 540,
        target: 600,
        riskReward: null,
        source: "technical",
      },
      holdingStop: 470,
    });
    expect(plan.source).toBe("technical");
    expect(plan.stop).toBe(540);
    expect(plan.riskReward).toBeNull();
  });

  it("reprend le stop de la ligne s'il n'y a pas de plan technique", () => {
    const plan = resolveTechnicalPlan({
      ticker: "SGBC",
      entry: 500,
      holdingStop: 470,
      holdingTarget: 560,
    });
    expect(plan.source).toBe("holding");
    expect(plan.stop).toBe(470);
    expect(plan.target).toBe(560);
    expect(plan.riskReward).toBeCloseTo(2);
  });

  it("calcule un stop et un objectif à partir de l'ATR quand les hauts et bas existent", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + (i % 2 === 0 ? 1 : -1));
    const bars = daily(closes, true);
    const atr = averageTrueRange(bars);
    expect(atr).not.toBeNull();
    const plan = resolveTechnicalPlan({ ticker: "ABJC", entry: 100, bars });
    expect(plan.source).toBe("atr");
    expect(plan.stop).toBeCloseTo(100 - ATR_STOP_MULTIPLE * (atr as number));
    expect(plan.target).toBeCloseTo(100 + ATR_TARGET_MULTIPLE * (atr as number));
  });

  it("retombe sur la volatilité des clôtures sans OHLC", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 80 + (i % 3));
    const plan = resolveTechnicalPlan({ ticker: "BOAC", entry: 82, bars: daily(closes, false) });
    expect(plan.source).toBe("volatility");
    expect(plan.stop).toBeLessThan(82);
    expect(plan.target).toBeGreaterThan(82);
    expect(plan.atr).toBeGreaterThan(0);
  });

  it("n'invente pas de niveau si l'historique est trop court", () => {
    const plan = resolveTechnicalPlan({
      ticker: "ETIT",
      entry: 20,
      bars: daily([20, 21, 19]),
    });
    expect(plan.source).toBe("unavailable");
    expect(plan.stop).toBeNull();
    expect(plan.target).toBeNull();
  });

  it("ne contacte pas la base pour une liste de titres vide", async () => {
    await expect(loadTechnicalSetups([])).resolves.toEqual([]);
  });
});
