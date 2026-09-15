import { describe, expect, it } from "vitest";
import type { ReconciledPrice } from "./reconciliation";
import { filterCanonicalByCollar, BRVM_SESSION_COLLAR_PERCENT } from "./price-collar";

function row(date: string, closePrice: number, ticker = "SNTS"): ReconciledPrice {
  return {
    ticker,
    date,
    closePrice,
    resolvedSource: "SIKAFINANCE",
    candidates: [],
  };
}

const config = {
  enabled: true,
  collarPercent: BRVM_SESSION_COLLAR_PERCENT,
  slackPercent: 0.5,
  maxGapDays: 7,
  overrideTickers: new Set<string>(),
};

describe("filterCanonicalByCollar", () => {
  it("accepte une variation dans le collier BRVM (~7,5 %)", () => {
    const { accepted, rejected } = filterCanonicalByCollar(
      [row("2026-09-14", 10000), row("2026-09-15", 10700)],
      { config }
    );
    expect(rejected).toHaveLength(0);
    expect(accepted).toHaveLength(2);
  });

  it("quarantaine un spike absurde sans inventer de cours", () => {
    const { accepted, rejected } = filterCanonicalByCollar(
      [row("2026-09-14", 10000), row("2026-09-15", 18000)],
      { config }
    );
    expect(accepted.map((r) => r.date)).toEqual(["2026-09-14"]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.deltaPercent).toBeGreaterThan(50);
  });

  it("n'applique pas le collier aux points annuels (écart > 7 j)", () => {
    const { rejected } = filterCanonicalByCollar(
      [row("2024-12-31", 10000), row("2025-12-31", 20000)],
      { config }
    );
    expect(rejected).toHaveLength(0);
  });

  it("PRICE_COLLAR_OVERRIDE ticker laisse passer", () => {
    const { rejected } = filterCanonicalByCollar(
      [row("2026-09-14", 10000), row("2026-09-15", 18000)],
      { config: { ...config, overrideTickers: new Set(["SNTS"]) } }
    );
    expect(rejected).toHaveLength(0);
  });
});
