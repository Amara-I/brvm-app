import { describe, expect, it } from "vitest";
import { linearRegression } from "./linear-regression";

describe("linearRegression", () => {
  it("retrouve exactement une droite parfaite y = 2x + 1", () => {
    const { slope, intercept } = linearRegression([1, 3, 5, 7, 9]);
    expect(slope).toBeCloseTo(2, 10);
    expect(intercept).toBeCloseTo(1, 10);
  });

  it("gère une série constante (pente nulle)", () => {
    const { slope, intercept } = linearRegression([10, 10, 10, 10]);
    expect(slope).toBeCloseTo(0, 10);
    expect(intercept).toBeCloseTo(10, 10);
  });

  it("calcule la régression pour une série bruitée", () => {
    // Valeurs réelles de Sonatel (SNTS) 2015-2026, cf. golden fixture.
    const prices = [14000, 16000, 18500, 19000, 20500, 22000, 24000, 25500, 27000, 27500, 28000, 28450];
    const { slope, intercept } = linearRegression(prices);
    expect(Math.round(intercept + slope * 12)).toBe(31332); // année 2027 dans la fixture
  });
});
