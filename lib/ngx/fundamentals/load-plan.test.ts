import { describe, expect, it } from "vitest";
import { buildLoadPlan, meets, type DividendCsvRow, type FundamentalsCsvRow } from "./load-plan";

const base = {
  ticker: "GTCO", fiscal_year: "2024", currency: "NGN", revenue_bn: "1500.5", operating_profit_bn: "600.1", net_profit_bn: "500.2", equity_bn: "1200", eps: "14.5",
  conf_revenue: "high", conf_operating_profit: "medium", conf_net_profit: "high", conf_equity: "high", conf_eps: "high",
  source_pdf: "https://doclib.ngxgroup.com/Financial_NewsDocs/x.pdf", source_file: "x.pdf",
} as unknown as FundamentalsCsvRow;

describe("buildLoadPlan", () => {
  it("only plans values at or above the confidence threshold", () => {
    const plan = buildLoadPlan([base], [], "high");
    expect(plan.ratios).toEqual([{ ticker: "GTCO", year: 2024, revenue: 1500.5, operatingIncome: null, netIncome: 500.2 }]);
    expect(plan.meta[0]).toMatchObject({ equityBn: 1200, epsNgn: 14.5, equityConfidence: "high", epsConfidence: "high" });
    expect(plan.documents).toHaveLength(1);
    expect(buildLoadPlan([base], [], "medium").ratios[0].operatingIncome).toBe(600.1);
  });
  it("skips non-NGN reporters and their dividends", () => {
    const usd = { ...base, ticker: "ETI", currency: "USD" } as FundamentalsCsvRow;
    const div = { ticker: "ETI", fiscal_year: "2024", dps: "0.5", confidence: "high", source_pdf: "u" } as DividendCsvRow;
    const plan = buildLoadPlan([usd], [div]);
    expect(plan.ratios).toHaveLength(0);
    expect(plan.dividends).toHaveLength(0);
    expect(plan.skipped).toHaveLength(2);
  });
  it("gates dividends on confidence and positive amount", () => {
    const d = (dps: string, confidence: string) => ({ ticker: "GTCO", fiscal_year: "2023", dps, confidence, source_pdf: "u" }) as DividendCsvRow;
    const plan = buildLoadPlan([base], [d("3.5", "high"), d("0", "high"), d("2", "low")]);
    expect(plan.dividends).toEqual([{ ticker: "GTCO", year: 2023, amount: 3.5, sourceUrl: "u" }]);
  });
  it("meets() never accepts 'none'", () => {
    expect(meets("none", "low")).toBe(false);
    expect(meets("high", "medium")).toBe(true);
  });
});

describe("document fiscal year", () => {
  it("uses the year encoded in the file name when a PDF feeds a restated earlier year", () => {
    const row = { ...base, fiscal_year: "2023", source_file: "AUDITED_FS_2024_03_x.pdf" } as unknown as FundamentalsCsvRow;
    expect(buildLoadPlan([row], [], "high").documents[0].year).toBe(2024);
  });
});
