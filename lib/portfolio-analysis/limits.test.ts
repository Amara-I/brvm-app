import { describe, expect, it } from "vitest";
import { EMPTY_INVESTOR_CRITERIA, type InvestorCriteria } from "./criteria";
import { concentrationLimits, LIMIT_PRESETS, weightBuckets } from "./limits";

function profile(patch: Partial<InvestorCriteria>): InvestorCriteria {
  return { ...EMPTY_INVESTOR_CRITERIA, ...patch };
}

describe("concentrationLimits", () => {
  it("reste strict dès qu'un critère prudent est présent", () => {
    expect(concentrationLimits(profile({ lossTolerance: "FAIBLE" }))).toEqual(LIMIT_PRESETS.strict);
    expect(concentrationLimits(profile({ portfolioType: "RENTE", lossTolerance: "ELEVEE" }))).toEqual(
      LIMIT_PRESETS.strict
    );
    expect(concentrationLimits(profile({ objective: "PRESERVATION", portfolioType: "TRADING" }))).toEqual(
      LIMIT_PRESETS.strict
    );
  });

  it("élargit pour un profil offensif, et reste modéré sans critère", () => {
    expect(concentrationLimits(profile({ lossTolerance: "ELEVEE" }))).toEqual(LIMIT_PRESETS.loose);
    expect(concentrationLimits(profile({ portfolioType: "CROISSANCE_MAX" }))).toEqual(LIMIT_PRESETS.loose);
    expect(concentrationLimits(EMPTY_INVESTOR_CRITERIA)).toEqual(LIMIT_PRESETS.moderate);
  });

  it("signale un dépassement sans changer les montants détenus", () => {
    const buckets = weightBuckets({
      limits: LIMIT_PRESETS.moderate,
      holdings: [
        { ticker: "SNTS", name: "Sonatel", sector: "Télécoms", country: "Sénégal", market: "BRVM", valueFcfa: 60 },
        { ticker: "SGBC", name: "SGB", sector: "Banques", country: "Côte d'Ivoire", market: "BRVM", valueFcfa: 40 },
      ],
    });
    const snts = buckets.find((bucket) => bucket.kind === "stock" && bucket.key === "SNTS");
    expect(snts?.weightPct).toBe(60);
    expect(snts?.above).toBe(true);
    expect(buckets.find((bucket) => bucket.kind === "market")?.weightPct).toBe(100);
    expect(buckets.find((bucket) => bucket.kind === "market")?.above).toBe(true);
  });
});
