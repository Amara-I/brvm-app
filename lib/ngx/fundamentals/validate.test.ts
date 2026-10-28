import { describe, expect, it } from "vitest";
import { getCompany } from "./companies";
import type { StatementExtraction } from "./types";
import { buildStagedRows, unitCorrection, type ExtractedDoc } from "./validate";

const corp = getCompany("DANGCEM")!;
const SHARES = 1_000_000_000;

function doc(fy: number, v: { rev: [number, number]; op: [number, number]; np: [number, number]; eq: [number, number]; eps: [number, number] }, over: Partial<StatementExtraction> = {}): ExtractedDoc {
  const f = (values: [number, number]) => ({ values, label: "x", page: 10 });
  return {
    file: `f${fy}.pdf`,
    url: `https://example/f${fy}.pdf`,
    guessedFiscalYear: fy,
    createdAt: `${fy + 1}-03-30T00:00:00Z`,
    dividends: [],
    extraction: {
      fiscalYear: fy,
      currency: "NGN",
      unitMultiplier: 1e6,
      unitLabel: "N 'million",
      fields: { revenue: f(v.rev), operatingProfit: f(v.op), netProfit: f(v.np), equity: f(v.eq), eps: f(v.eps) },
      revenueBasis: "revenue",
      operatingBasis: "operating profit",
      pages: { income: 10, balance: 11 },
      columnNote: null,
      periodEndMonth: 12,
      interim: false,
      warnings: [],
      ...over,
    },
  };
}

// net profit 100,000 N'm = ₦100bn ; 1bn shares → EPS ₦100
const y23 = doc(2023, { rev: [1000_000, 900_000], op: [200_000, 150_000], np: [100_000, 80_000], eq: [500_000, 450_000], eps: [100, 80] });
const y24 = doc(2024, { rev: [1200_000, 1000_000], op: [250_000, 200_000], np: [120_000, 100_000], eq: [600_000, 500_000], eps: [120, 100] });

describe("buildStagedRows", () => {
  it("converts to ₦ bn and gives high confidence when the next AFS comparative and EPS×shares agree", () => {
    const { rows } = buildStagedRows(corp, [y23, y24], { fromYear: 2023, toYear: 2024, shares: SHARES });
    const r = rows.find((x) => x.fiscalYear === 2023)!;
    expect(r.revenueBn).toBe(1000);
    expect(r.netProfitBn).toBe(100);
    expect(r.conf.revenue).toBe("high");
    expect(r.conf.netProfit).toBe("high");
    expect(r.conf.eps).toBe("high");
  });
  it("keeps the original value, downgrades to medium and records the restated value when N+1 comparative differs >1%", () => {
    const restated = doc(2024, { rev: [1200_000, 950_000], op: [250_000, 200_000], np: [120_000, 100_000], eq: [600_000, 500_000], eps: [120, 100] });
    const { rows, review } = buildStagedRows(corp, [y23, restated], { fromYear: 2023, toYear: 2023, shares: SHARES });
    const r = rows[0];
    expect(r.revenueBn).toBe(1000);
    expect(r.conf.revenue).toBe("medium");
    expect(r.restated.revenue).toBe(950);
    expect(review.some((x) => x.field === "revenue" && x.severity === "medium")).toBe(true);
  });
  it("last year without comparative: revenue medium, net profit/EPS high only if EPS×shares is tight", () => {
    const { rows } = buildStagedRows(corp, [y24], { fromYear: 2024, toYear: 2024, shares: SHARES });
    expect(rows[0].conf.revenue).toBe("medium");
    expect(rows[0].conf.netProfit).toBe("high");
  });
  it("flags EPS × shares mismatch as low (or medium when comparative-confirmed)", () => {
    const bad = doc(2024, { rev: [1200_000, 1000_000], op: [250_000, 200_000], np: [120_000, 100_000], eq: [600_000, 500_000], eps: [12, 100] });
    const { rows, review } = buildStagedRows(corp, [bad], { fromYear: 2024, toYear: 2024, shares: SHARES });
    expect(rows[0].conf.eps).toBe("low");
    expect(rows[0].conf.netProfit).toBe("low");
    expect(review.some((x) => x.field === "eps" && x.severity === "low")).toBe(true);
  });
  it("flags operating profit above revenue (magnitude sanity)", () => {
    const bad = doc(2024, { rev: [100_000, 100_000], op: [250_000, 200_000], np: [50_000, 40_000], eq: [600_000, 500_000], eps: [50, 40] });
    const { rows } = buildStagedRows(corp, [bad], { fromYear: 2024, toYear: 2024, shares: SHARES });
    expect(rows[0].conf.operatingProfit).toBe("low");
  });
  it("excludes interim documents and reports missing years", () => {
    const interim = doc(2024, { rev: [1, 1], op: [1, 1], np: [1, 1], eq: [1, 1], eps: [1, 1] }, { interim: true });
    const { rows, review } = buildStagedRows(corp, [interim], { fromYear: 2024, toYear: 2024, shares: SHARES });
    expect(rows[0].conf.revenue).toBe("none");
    expect(review.some((x) => x.reason.includes("aucun état audité"))).toBe(true);
  });
  it("does not convert amounts when the unit is missing", () => {
    const nounit = doc(2024, { rev: [1200_000, 1000_000], op: [250_000, 200_000], np: [120_000, 100_000], eq: [600_000, 500_000], eps: [120, 100] }, { unitMultiplier: null, unitLabel: null });
    const { rows } = buildStagedRows(corp, [nounit], { fromYear: 2024, toYear: 2024, shares: SHARES });
    expect(rows[0].revenueBn).toBeNull();
    expect(rows[0].conf.revenue).toBe("none");
  });
  it("flags USD reporters whose currency differs from the NGN config", () => {
    const eti = getCompany("ETI")!;
    const usd = doc(2024, { rev: [1200, 1000], op: [250, 200], np: [120, 100], eq: [600, 500], eps: [0.1, 0.1] }, { currency: "USD" });
    const { rows } = buildStagedRows(eti, [usd], { fromYear: 2024, toYear: 2024, shares: 18_000_000_000 });
    expect(rows[0].currency).toBe("USD");
  });
});

describe("unit & EPS scale corrections", () => {
  it("corrects a thousand-fold unit error using EPS × NGX shares", () => {
    // montants lus en « millions » alors que le document est en milliers : résultat 1000× trop grand
    const wrong = doc(2024, { rev: [1200_000, 1000_000], op: [250_000, 200_000], np: [120_000_000, 100_000_000], eq: [600_000, 500_000], eps: [120, 100] });
    expect(unitCorrection(wrong, SHARES)).toBe(0.001);
    expect(unitCorrection(y24, SHARES)).toBe(1);
  });
  it("rescales an EPS printed in kobo under a Naira label (and tolerates a share consolidation)", () => {
    // 2.0 Md de résultat / 4 Md d'actions (annuaire) = 0.5 ₦ ; BPA lu 50 (kobo)
    const kobo = doc(2024, { rev: [1200_000, 1000_000], op: [250_000, 200_000], np: [2_000, 1_800], eq: [600_000, 500_000], eps: [50, 45] });
    const { rows } = buildStagedRows(corp, [kobo], { fromYear: 2024, toYear: 2024, shares: 4_000_000_000 });
    expect(rows[0].eps).toBeCloseTo(0.5, 6);
    expect(rows[0].notes.some((n) => n.startsWith("eps_scaled_x0.01"))).toBe(true);
  });
  it("fills a year from the next AFS comparative column when its own document is unreadable (virtual doc)", () => {
    const unreadable = doc(2023, { rev: [0, 0], op: [0, 0], np: [0, 0], eq: [0, 0], eps: [0, 0] }, { fields: {} });
    const { rows } = buildStagedRows(corp, [unreadable, y24], { fromYear: 2023, toYear: 2023, shares: SHARES });
    expect(rows[0].revenueBn).toBe(1000);
    expect(rows[0].conf.revenue).toBe("medium");
    expect(rows[0].notes.some((n) => n.startsWith("from_comparative_of_2024"))).toBe(true);
  });
  it("prefers, among duplicate documents of a fiscal year, the one that agrees with the neighbour year comparative", () => {
    const interimLike = doc(2023, { rev: [300_000, 250_000], op: [50_000, 40_000], np: [25_000, 20_000], eq: [500_000, 450_000], eps: [25, 20] });
    interimLike.file = "interim-like.pdf";
    const { rows } = buildStagedRows(corp, [interimLike, y23, y24], { fromYear: 2023, toYear: 2023, shares: SHARES });
    expect(rows[0].revenueBn).toBe(1000);
  });
});
