import { describe, expect, it } from "vitest";
import type { SectorStat } from "@/lib/ngx/valuation";
import {
  PER_NOT_SIGNIFICANT_ABOVE,
  estimateBrvmFairValues,
  epsBlockForValuation,
  historicalPerMedian,
  usablePer,
  valuationRangeMode,
  type BrvmValuationInput,
} from "./valuation-methods";

function stat(median: number | null, n = 4): SectorStat {
  return { median, n, lowConfidence: n < 4 };
}

function input(over: Partial<BrvmValuationInput> = {}): BrvmValuationInput {
  return {
    price: 4_000,
    eps: 400,
    epsBlock: null,
    pbRatio: 2,
    pbNotSignificant: false,
    dps: 174,
    dividendCagrPercent: 3,
    historicalPer: { median: 12, n: 5, fromYear: 2021, toYear: 2025 },
    sectorPer: stat(16),
    sectorPbr: stat(1.5),
    sectorYield: stat(4),
    ...over,
  };
}

describe("seuils de multiple", () => {
  it("écarte un PER au-dessus de 100 et un PER négatif ou nul", () => {
    expect(usablePer(9.67)).toBe(9.67);
    expect(usablePer(PER_NOT_SIGNIFICANT_ABOVE)).toBe(100);
    expect(usablePer(100.01)).toBeNull();
    expect(usablePer(676.7)).toBeNull();
    expect(usablePer(-4)).toBeNull();
    expect(usablePer(0)).toBeNull();
  });

  it("bloque un BPA dont le PER implicite dépasse 100, et un résultat négatif", () => {
    expect(epsBlockForValuation(1_895, 1_895 / 676.7, 0.02)).toBe("outlier");
    expect(epsBlockForValuation(4_000, 413.59, 413.59)).toBeNull();
    expect(epsBlockForValuation(1_000, 50, -1)).toBe("negative");
    expect(epsBlockForValuation(null, 10, 1)).toBeNull();
  });
});

describe("PER historique", () => {
  it("prend la médiane des exercices clos et ignore les PER non significatifs", () => {
    const median = historicalPerMedian(
      [
        { year: 2021, per: 15.37 },
        { year: 2022, per: 13.91 },
        { year: 2023, per: 11.7 },
        { year: 2024, per: 9.86 },
        { year: 2025, per: 9.38 },
        { year: 2026, per: 9.67 },
        { year: 2020, per: 420 },
      ],
      2025,
    );
    expect(median).toEqual({ median: 11.7, n: 5, fromYear: 2021, toYear: 2025 });
  });

  it("refuse moins de trois exercices exploitables", () => {
    expect(
      historicalPerMedian(
        [
          { year: 2021, per: 8.72 },
          { year: 2022, per: 7.71 },
          { year: 2023, per: 421 },
          { year: 2025, per: 624.63 },
        ],
        2025,
      ),
    ).toBeNull();
  });
});

describe("méthodes de valorisation BRVM", () => {
  it("produit une vraie fourchette quand plusieurs méthodes ont des données", () => {
    const { estimates, skipped } = estimateBrvmFairValues(input());
    const methods = estimates.map((e) => e.method);
    expect(methods).toEqual(["SECTOR_PER", "SECTOR_PBR", "DIVIDEND_YIELD", "DDM", "HISTORICAL_PE"]);
    expect(skipped).toEqual([]);
    expect(valuationRangeMode(estimates.length)).toBe("range");
    const values = estimates.map((e) => e.value);
    expect(Math.min(...values)).not.toBe(Math.max(...values));
    const per = estimates.find((e) => e.method === "SECTOR_PER")!;
    expect(per.value).toBeCloseTo(400 * 16);
    const pb = estimates.find((e) => e.method === "SECTOR_PBR")!;
    expect(pb.value).toBeCloseTo((4_000 / 2) * 1.5);
    const yieldValue = estimates.find((e) => e.method === "DIVIDEND_YIELD")!;
    expect(yieldValue.value).toBeCloseTo(174 / 0.04);
    const ddm = estimates.find((e) => e.method === "DDM")!;
    expect(ddm.value).toBeCloseTo((174 * 1.03) / (0.04 - 0.03));
    const hist = estimates.find((e) => e.method === "HISTORICAL_PE")!;
    expect(hist.value).toBeCloseTo(12 * 400);
  });

  it("n'utilise pas un BPA outlier et l'explique, sans fabriquer de fourchette", () => {
    const { estimates, skipped } = estimateBrvmFairValues(
      input({
        price: 1_895,
        eps: null,
        epsBlock: "outlier",
        pbRatio: null,
        dps: null,
        dividendCagrPercent: null,
        historicalPer: null,
        sectorPbr: stat(null, 0),
        sectorYield: stat(null, 0),
      }),
    );
    expect(estimates).toEqual([]);
    expect(valuationRangeMode(0)).toBe("none");
    expect(skipped.find((s) => s.method === "SECTOR_PER")?.reason).toBe("outlierEps");
    expect(skipped.find((s) => s.method === "HISTORICAL_PE")?.reason).toBe("outlierEps");
    expect(skipped.find((s) => s.method === "SECTOR_PBR")?.reason).toBe("noBook");
  });

  it("laisse le modèle de Gordon de côté quand la croissance dépasse le rendement sectoriel", () => {
    const { estimates, skipped } = estimateBrvmFairValues(input({ dividendCagrPercent: 6, pbRatio: null, historicalPer: null }));
    expect(estimates.map((e) => e.method)).toEqual(["SECTOR_PER", "DIVIDEND_YIELD"]);
    expect(skipped.find((s) => s.method === "DDM")?.reason).toBe("growthAboveYield");
    expect(valuationRangeMode(estimates.length)).toBe("range");
  });

  it("signale une méthode unique au lieu d'une fourchette plate", () => {
    const { estimates } = estimateBrvmFairValues(
      input({
        pbRatio: null,
        dps: null,
        dividendCagrPercent: null,
        historicalPer: null,
        sectorYield: stat(null, 0),
      }),
    );
    expect(estimates).toHaveLength(1);
    expect(estimates[0]!.method).toBe("SECTOR_PER");
    expect(valuationRangeMode(1)).toBe("single");
  });

  it("écarte un résultat négatif des méthodes fondées sur le BPA", () => {
    const { estimates, skipped } = estimateBrvmFairValues(
      input({ eps: null, epsBlock: "negative", historicalPer: { median: 10, n: 4, fromYear: 2020, toYear: 2024 } }),
    );
    expect(estimates.find((e) => e.method === "SECTOR_PER")).toBeUndefined();
    expect(estimates.find((e) => e.method === "HISTORICAL_PE")).toBeUndefined();
    expect(skipped.find((s) => s.method === "SECTOR_PER")?.reason).toBe("negativeEps");
  });
});
