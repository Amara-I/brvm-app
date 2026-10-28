import { describe, expect, it } from "vitest";
import { getCompany } from "./companies";
import { columnLayout, detectFiscalYear, extractStatements, pickColumns } from "./extract";
import { parsePage } from "./text";

const corp = getCompany("DANGCEM")!;
const bank = getCompany("GTCO")!;

const incomeCorp = (n: string) =>
  [
    "Dangote Cement Plc",
    "Consolidated statement of profit or loss and other comprehensive income",
    `For the year ended 31 December ${n}`,
    "                                            Notes       Group        Group      Company     Company",
    "                                                         2024         2023        2024        2023",
    "                                                       N'million    N'million   N'million   N'million",
    "Revenue                                       6       3,000,000    2,000,000   100,000     90,000",
    "Cost of sales                                 7      (1,800,000)  (1,200,000)  (10,000)    (9,000)",
    "Gross profit                                          1,200,000      800,000    90,000      81,000",
    "Operating profit                                        900,000      600,000    80,000      70,000",
    "Profit before tax                                       800,000      500,000    70,000      60,000",
    "Income tax expense                           11        (200,000)    (100,000)   (5,000)     (4,000)",
    "Profit for the year                                     600,000      400,000    65,000      56,000",
    "Profit attributable to:",
    "Owners of the parent                                    550,000      370,000    65,000      56,000",
    "Non-controlling interests                                50,000       30,000         -           -",
    "Earnings per share - Basic (kobo)                  12      3,235        2,176       -           -",
  ].join("\n");

describe("columnLayout", () => {
  it("detects four columns, notes column and group-first order", () => {
    const text = incomeCorp("2024");
    const lay = columnLayout(text, parsePage(text));
    expect(lay.n).toBe(4);
    expect(lay.groupFirst).toBe(true);
    expect(lay.hasNote).toBe(true);
  });
  it("does not mistake 'separate and consolidated' in the title for a company-first header", () => {
    const text = [
      "SEPARATE AND CONSOLIDATED STATEMENT OF PROFIT OR LOSS      GROUP        COMPANY",
      "Note   2020   2019   2020   2019",
      "Interest income   7   384,798   431,934   1,332   2,173",
      "Interest expense   8   (133,183)   (152,342)   (13)   (14)",
      "Fee income   10   113,222   103,381   -   -",
    ].join("\n");
    expect(columnLayout(text, parsePage(text)).groupFirst).toBe(true);
  });
});

describe("extractStatements (synthetic corporate income statement)", () => {
  const r = extractStatements(incomeCorp("2024"), corp);
  it("reads the Group column, unit and fiscal year", () => {
    expect(r.fiscalYear).toBe(2024);
    expect(r.unitMultiplier).toBe(1e6);
    expect(r.fields.revenue?.values).toEqual([3_000_000, 2_000_000]);
    expect(r.fields.operatingProfit?.values).toEqual([900_000, 600_000]);
  });
  it("reads profit for the year, owners' share, and EPS converted from kobo to naira", () => {
    expect(r.fields.netProfit?.values[0]).toBe(600_000);
    expect(r.fields.netProfitOwners?.values[0]).toBe(550_000);
    expect(r.fields.eps?.values).toEqual([32.35, 21.76]);
  });
  it("flags interim documents", () => {
    const interim = incomeCorp("2024").replace("For the year ended 31 December 2024", "For the six months ended 30 June 2024");
    expect(extractStatements(interim, corp).interim).toBe(true);
  });
});

describe("extractStatements (bank mapping)", () => {
  it("uses 'Gross earnings' as revenue when present and PBT as operating profit", () => {
    const text = [
      "Guaranty Trust Holding Company Plc",
      "Consolidated and separate statements of profit or loss",
      "For the year ended 31 December 2022",
      "In thousands of Nigerian Naira   Note   Dec-2022   Dec-2021   Dec-2022   Dec-2021",
      "Gross earnings    5   539,234,897   447,810,585   90,385,870   8,829,354",
      "Interest income   5   300,000,000   250,000,000   1,000   1,000",
      "Interest expense   6   (80,000,000)   (70,000,000)   (1)   (1)",
      "Net interest income   220,000,000   180,000,000   999   999",
      "Profit before income tax   214,154,094   221,497,676   88,605,108   8,282,599",
      "Income tax expense   (44,980,657)   (46,658,189)   -   -",
      "Profit for the year   169,173,437   174,839,487   88,605,108   8,282,599",
    ].join("\n");
    const r = extractStatements(text, bank);
    expect(r.revenueBasis).toBe("gross earnings");
    expect(r.fields.revenue?.values[0]).toBe(539_234_897);
    expect(r.operatingBasis?.startsWith("PBT")).toBe(true);
    expect(r.fields.operatingProfit?.values[0]).toBe(214_154_094);
    expect(r.unitMultiplier).toBe(1000);
  });
});

describe("step-2 company fixes", () => {
  it("findDividendsPaid reads the cash-flow row (absolute value, both columns)", async () => {
    const { findDividendsPaid } = await import("./extract");
    const text = [
      "Consolidated statement of cash flows",
      "For the year ended 31 December 2020",
      "                                   Group        Group",
      "                                   2020         2019",
      "                                 N'million    N'million",
      "Cash generated from operations      500,000      400,000",
      "Dividends paid                      (82,407)     (70,000)",
      "Net cash from financing             (90,000)     (75,000)",
    ].join("\n");
    const r = findDividendsPaid([{ index: 77, text, rows: parsePage(text) } as never]);
    expect(r?.values).toEqual([82407, 70000]);
    expect(r?.page).toBe(78);
  });
  it("dual-currency pages (US$ and ₦ columns) keep the first currency pair", () => {
    const text = [
      "Group results",
      "                                  2019      2019      2018      2018",
      "                                 US$'000   NGN'000   US$'000   NGN'000",
      "Gross earnings                  2,328,822 840,000,000 2,000,000 700,000,000",
      "Profit before tax                 405,079 146,000,000   350,000 120,000,000",
    ].join("\n");
    const lay = columnLayout(text, parsePage(text));
    expect(lay.dual).toBe(true);
    const row = parsePage(text).find((r) => /Gross earnings/.test(r.label))!;
    expect(pickColumns(row, lay)).toEqual([2328822, 2000000]);
  });
});

describe("detectFiscalYear — month/year headers", () => {
  it("reads « December 2023  December 2022 » without picking the trailing 23 as a day", () => {
    const page = "Consolidated statement of comprehensive income\n\nIn millions of Naira   Group  Group\n   Notes  December 2023      December 2022\n";
    expect(detectFiscalYear(page)).toEqual({ year: 2023, month: 12 });
  });
  it("reads abbreviated months", () => {
    expect(detectFiscalYear("financial statements for the year ended 31 Dec 2021\n")).toEqual({ year: 2021, month: 12 });
  });
});

describe("parsePage — stray dash after a number", () => {
  it("does not read « 214,297,747 -   161,085,778 » as a nil column", () => {
    const rows = parsePage("Revenue                    5           214,297,747 -      161,085,778       206,360,656     158,104,577");
    expect(rows[0].nums.slice(-4)).toEqual([214297747, 161085778, 206360656, 158104577]);
  });
});

describe("PBT label variants", () => {
  it("accepts 'Operating Profit/(Loss) Before Tax' as profit before tax (Jaiz)", async () => {
    const { PBT } = await import("./extract");
    expect(PBT.test("operating profit/(loss) before tax")).toBe(true);
    expect(PBT.test("operating profit")).toBe(false);
  });
});
