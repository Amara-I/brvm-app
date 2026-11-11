import { describe, expect, it } from "vitest";
import { mergeIncomeRowsBySource } from "./income-merge";

describe("mergeIncomeRowsBySource", () => {
  it("une ligne MANUEL partielle ne masque pas le CA / RN Sikafinance", () => {
    const out = mergeIncomeRowsBySource([
      { year: 2025, source: "SIKAFINANCE", revenue: 1200, netIncome: 400, operatingIncome: null },
      { year: 2025, source: "MANUEL", revenue: null, netIncome: null, operatingIncome: 650 },
    ]);
    expect(out).toEqual([{ year: 2025, revenue: 1200, netIncome: 400, operatingIncome: 650 }]);
  });

  it("la source prioritaire gagne quel que soit l'ordre de lecture", () => {
    const out = mergeIncomeRowsBySource([
      { year: 2024, source: "MANUEL", revenue: 999, netIncome: 1, operatingIncome: 2 },
      { year: 2024, source: "BRVM_OFFICIEL", revenue: 100, netIncome: null, operatingIncome: null },
      { year: 2024, source: "SIKAFINANCE", revenue: 110, netIncome: 30, operatingIncome: null },
    ]);
    expect(out).toEqual([{ year: 2024, revenue: 100, netIncome: 30, operatingIncome: 2 }]);
  });

  it("trie par année et ignore les valeurs non numériques", () => {
    const out = mergeIncomeRowsBySource([
      { year: 2025, source: "SIKAFINANCE", revenue: "12.5", netIncome: "abc", operatingIncome: undefined },
      { year: 2023, source: "SIKAFINANCE", revenue: 10, netIncome: 1, operatingIncome: null },
    ]);
    expect(out.map((p) => p.year)).toEqual([2023, 2025]);
    expect(out[1]).toEqual({ year: 2025, revenue: 12.5, netIncome: null, operatingIncome: null });
  });
});
