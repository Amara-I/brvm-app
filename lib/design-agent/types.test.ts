import { describe, expect, it } from "vitest";
import { canAutoPropose, isProtectedPath, rankDesignIdea } from "./types";

describe("rankDesignIdea", () => {
  it("favorise impact élevé et effort faible", () => {
    const high = rankDesignIdea({ impact: 5, confidence: 4, reach: 4, reversibility: 5, effort: 1, risk: 1 });
    const low = rankDesignIdea({ impact: 2, confidence: 2, reach: 2, reversibility: 2, effort: 5, risk: 4 });
    expect(high).toBeGreaterThan(low);
  });
});

describe("canAutoPropose", () => {
  it("refuse inspiration seule", () => {
    expect(canAutoPropose("inspiration", 20)).toBe(false);
  });
  it("accepte repeated_pattern avec ranking suffisant", () => {
    expect(canAutoPropose("repeated_pattern", 8)).toBe(true);
  });
});

describe("isProtectedPath", () => {
  it("bloque calc et auth", () => {
    expect(isProtectedPath("lib/calc/calc-metrics.ts")).toBe(true);
    expect(isProtectedPath("lib/auth/auth-options.ts")).toBe(true);
    expect(isProtectedPath("components/landing/LandingPage.tsx")).toBe(false);
  });
});
