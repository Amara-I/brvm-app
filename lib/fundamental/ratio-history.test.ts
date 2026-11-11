import { describe, expect, it } from "vitest";
import { collapseCanonicalRatios } from "./ratio-history";

describe("historique de ratios canoniques", () => {
  it("garde le PER officiel même extrême, et complète les trous avec la source suivante", () => {
    const rows = collapseCanonicalRatios([
      {
        year: 2026,
        source: "MANUEL",
        per: 583.21,
        pbRatio: null,
        roe: null,
        netMargin: null,
        debtRatio: null,
        revenueGrowth: null,
        fcf: null,
      },
      {
        year: 2026,
        source: "BRVM_OFFICIEL",
        per: 676.7,
        pbRatio: null,
        roe: null,
        netMargin: null,
        debtRatio: null,
        revenueGrowth: null,
        fcf: 1.2,
      },
      {
        year: 2025,
        source: "SIKAFINANCE",
        per: 624.63,
        pbRatio: null,
        roe: 4,
        netMargin: 0.05,
        debtRatio: null,
        revenueGrowth: -6.31,
        fcf: null,
      },
    ]);
    expect(rows).toEqual([
      {
        year: 2025,
        per: 624.63,
        pbRatio: null,
        roe: 4,
        netMargin: 0.05,
        debtRatio: null,
        revenueGrowth: -6.31,
        fcf: null,
      },
      {
        year: 2026,
        per: 676.7,
        pbRatio: null,
        roe: null,
        netMargin: null,
        debtRatio: null,
        revenueGrowth: null,
        fcf: 1.2,
      },
    ]);
  });

  it("traite un PER nul comme non publié", () => {
    const [row] = collapseCanonicalRatios([
      {
        year: 2024,
        source: "BRVM_OFFICIEL",
        per: 0,
        pbRatio: 1.4,
        roe: null,
        netMargin: null,
        debtRatio: 20,
        revenueGrowth: null,
        fcf: null,
      },
    ]);
    expect(row?.per).toBeNull();
    expect(row?.pbRatio).toBe(1.4);
    expect(row?.debtRatio).toBe(20);
  });
});
