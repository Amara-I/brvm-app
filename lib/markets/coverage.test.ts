import { expect, it } from "vitest";
import { listingCoverage } from "./coverage";
it("déclare les lacunes et ne confond pas zéro et absence", () => {
  const row = listingCoverage({ ticker: "MTNN", exchange: "NGX", firstDate: null, lastDate: null, priceCount: 0,
    financials: [{ year: 2025, revenue: 0, operatingIncome: 0, netIncome: 0 }] }, "2026-11-01");
  expect(row.missingFinancialYears).toHaveLength(9);
  expect(row.missingFinancialYears).not.toContain(2025);
  expect(row.criticalMissing).toBe(true);
  expect(row.startsAtTarget).toBe(false);
});
it("ne présente pas un point ancien comme vingt ans de données complètes", () => {
  const row = listingCoverage({ ticker: "SNTS", exchange: "BRVM", firstDate: "2006-01-01", lastDate: "2026-10-30",
    priceCount: 2, financials: [{ year: 2025, revenue: null, operatingIncome: 1, netIncome: 1 }] }, "2026-11-01");
  expect(row.startsAtTarget).toBe(true);
  expect(row.continuity).toBe("NON_VERIFIEE");
  expect(row.missingFinancialYears).toContain(2025);
});
