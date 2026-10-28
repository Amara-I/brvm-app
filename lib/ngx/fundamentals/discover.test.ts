import { describe, expect, it } from "vitest";
import { buildListUrl, classifyDocument, guessFiscalYear } from "./discover";
import type { NgxListItem } from "./types";

const item = (title: string, created = "2025-03-28T10:00:00Z", type = "Financial Statements"): NgxListItem => ({
  URL: { Description: title, Url: "https://doclib.ngxgroup.com/Financial_NewsDocs/x.pdf" },
  Type_of_Submission: type,
  CompanyName: "X",
  CompanySymbol: "X",
  Created: created,
});

describe("classifyDocument", () => {
  it("accepts audited annual statements and the Q4/Q5 year-end filings", () => {
    expect(classifyDocument(item("GTCO - AUDITED FINANCIAL STATEMENT FOR 2024"))).toBe("AUDITED_FS");
    expect(classifyDocument(item("ZENITH BANK PLC- QUARTER 5 - FINANCIAL STATEMENT FOR 2023"))).toBe("AUDITED_FS");
  });
  it("rejects interim quarters", () => {
    expect(classifyDocument(item("ZENITH - Q3 2024 UNAUDITED FINANCIAL STATEMENTS"))).toBeNull();
    expect(classifyDocument(item("X - HALF YEAR 2024 FINANCIAL STATEMENTS"))).toBeNull();
  });
  it("classifies annual reports", () => {
    expect(classifyDocument(item("DANGOTE CEMENT 2023 ANNUAL REPORT", "2024-04-01T00:00:00Z", "Corporate Actions"))).toBe("ANNUAL_REPORT");
  });
});

describe("guessFiscalYear", () => {
  it("prefers the year in the title", () => {
    expect(guessFiscalYear(item("FINANCIAL STATEMENT FOR 2023", "2024-04-02T00:00:00Z"))).toBe(2023);
  });
  it("falls back to the filing date (filed before August → previous year)", () => {
    expect(guessFiscalYear(item("AUDITED FINANCIAL STATEMENTS", "2018-03-20T00:00:00Z"))).toBe(2017);
  });
});

describe("buildListUrl", () => {
  it("escapes the symbol in the OData filter", () => {
    expect(buildListUrl("GTCO")).toContain("CompanySymbol%20eq%20'GTCO'");
  });
});
