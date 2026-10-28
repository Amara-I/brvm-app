import { describe, expect, it } from "vitest";
import { noticeFiscalYear, parseDate, parseDividendNotice, summarizeNotices, type DividendNotice } from "./notices";
import { cashCheck } from "./validate";

const meta = { createdAt: "2016-03-17T10:00:00Z", title: "t", kind: "DIVIDEND_NOTICE" };

describe("parseDate", () => {
  it("reads day-first and month-first dates", () => {
    expect(parseDate("on 31 December 2023")).toBe("2023-12-31");
    expect(parseDate("Monday, April 15, 2024")).toBe("2024-04-15");
    expect(parseDate("no date here")).toBeNull();
  });
});

describe("parseDividendNotice", () => {
  it("old NGX form: interim 25k + final 30k + total 55k (kobo)", () => {
    const txt = `NAME OF COMPANY: ACCESS BANK
PERIOD: 31 December 2015
Interim Dividend: 25k
Proposed Final Dividend: 30k
Total Dividend: 55k
Closure Date: 21 April 2016
Date of Payment: 28 April 2016`;
    const r = parseDividendNotice(txt, meta);
    const by = Object.fromEntries(r.map((x) => [x.type, x.dps]));
    expect(by).toMatchObject({ interim: 0.25, final: 0.3, total: 0.55 });
    expect(r[0].periodEnd).toEqual({ year: 2015, month: 12 });
  });
  it("« 98 Kobo » is kobo", () => {
    const r = parseDividendNotice("DIVIDEND (Final): 98 Kobo\nClosure of Register 9 June 2017", meta);
    expect(r[0]).toMatchObject({ type: "final", dps: 0.98 });
  });
  it("newer form: « A final dividend of N45 per share » with period and dates", () => {
    const txt = `Period Ended          December 31, 2025
Proposed Dividend     A final dividend of N45 per share, subject to withholding tax, will be paid.
Qualification Date    Wednesday, June 17, 2026
Payment Date          By Thursday, July 2, 2026, dividends will be paid`;
    const r = parseDividendNotice(txt, meta);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ type: "final", dps: 45, qualificationDate: "2026-06-17", paymentDate: "2026-07-02", periodEnd: { year: 2025, month: 12 } });
  });
  it("« N2.45k » is ₦2.45 and « N1.40 kobo » (typo) is ₦1.40", () => {
    expect(parseDividendNotice("bringing the total dividend for the year to N2.45k per share", meta)[0].dps).toBe(2.45);
    expect(parseDividendNotice("the dividend of N1.40 kobo per 50 kobo ordinary share", meta)[0].dps).toBe(1.4);
  });
  it("ignores percentages, billions and dates after the colon", () => {
    expect(parseDividendNotice("Dividend: 30% of profit", meta)).toHaveLength(0);
    expect(parseDividendNotice("dividend of N12 billion was paid", meta)).toHaveLength(0);
    expect(parseDividendNotice("Dividend: 15 June 2024", meta)).toHaveLength(0);
  });
  it("skips the intro mention of « Payment date » followed by the period", () => {
    const txt = `announces a change to the date of its AGM and Payment date as follows:
Period Ended December 31, 2023
Proposed Dividend A final dividend of N30 per share
Payment Date By Friday, May 31, 2024, dividends will be paid`;
    expect(parseDividendNotice(txt, meta)[0].paymentDate).toBe("2024-05-31");
  });
});

describe("summarizeNotices", () => {
  const n = (type: DividendNotice["type"], dps: number, createdAt: string, periodEnd: DividendNotice["periodEnd"] = null): DividendNotice => ({ type, dps, createdAt, periodEnd, snippet: "", file: `f${dps}` });
  it("assigns fiscal year from the period, otherwise from the filing date", () => {
    expect(noticeFiscalYear(n("unspecified", 1, "2024-03-01", { year: 2023, month: 12 }), 12)).toEqual({ fy: 2023, type: "final" });
    expect(noticeFiscalYear(n("unspecified", 1, "2023-09-10", { year: 2023, month: 6 }), 12)).toEqual({ fy: 2023, type: "interim" });
    expect(noticeFiscalYear(n("unspecified", 1, "2024-03-01"), 12)).toEqual({ fy: 2023, type: "final" });
    expect(noticeFiscalYear(n("unspecified", 1, "2023-10-05"), 12)).toEqual({ fy: 2023, type: "interim" });
    // exercice clos le 31 mars : un avis de juin 2024 concerne l'exercice mars 2024
    expect(noticeFiscalYear(n("unspecified", 1, "2024-06-05"), 3)).toEqual({ fy: 2024, type: "final" });
  });
  it("sums interim + final, keeps the latest revision, flags partial years", () => {
    const m = summarizeNotices(
      [n("interim", 0.25, "2015-09-01", { year: 2015, month: 6 }), n("final", 0.3, "2016-03-01", { year: 2015, month: 12 }), n("final", 0.35, "2016-03-20", { year: 2015, month: 12 }), n("final", 1.4, "2024-04-29", { year: 2023, month: 12 })],
      12,
    );
    expect(m.get(2015)).toMatchObject({ completeness: "final+interim", total: 0.6, final: 0.35 });
    expect(m.get(2023)).toMatchObject({ completeness: "final_only", total: null, final: 1.4 });
  });
  it("uses a stated total", () => {
    const m = summarizeNotices([n("total", 0.55, "2016-03-17", { year: 2015, month: 12 }), n("final", 0.3, "2016-03-17", { year: 2015, month: 12 })], 12);
    expect(m.get(2015)).toMatchObject({ completeness: "total_stated", total: 0.55 });
  });
});

describe("cashCheck", () => {
  it("compares dividends paid with shares × (final N + interim N+1)", () => {
    const r = cashCheck(2.5, 0.3, 29.43e9, 82.41e9)!;
    expect(r.gap).toBeLessThan(0.01);
    expect(cashCheck(2.5, null, 29.43e9, 200e9)!.gap).toBeGreaterThan(0.5);
    expect(cashCheck(null, null, 1e9, 1e9)).toBeNull();
  });
});
