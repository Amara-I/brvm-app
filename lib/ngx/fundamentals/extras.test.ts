import { describe, expect, it } from "vitest";
import { findBorrowings, findCashFlowItems } from "./extract";
import { buildExtrasRows, debtRatioPercent, freeCashFlow } from "./extras";
import { parsePage } from "./text";
import type { ExtractedDoc } from "./validate";

const page = (index: number, text: string) => ({ index, text, rows: parsePage(text) });

describe("NGX extras — borrowings, operating cash flow, capex", () => {
  it("sums current and non-current borrowings, ignoring lease liabilities", () => {
    const text = [
      "Statement of financial position as at 31 December 2024",
      "                                     2024          2023",
      "                                    N'000         N'000",
      "Borrowings                      1,200,000       900,000",
      "Lease liabilities                  50,000        40,000",
      "Current portion of borrowings     300,000       100,000",
      "Trade and other payables          700,000       650,000",
    ].join("\n");
    const r = findBorrowings([page(10, text)], [0]);
    expect(r?.values).toEqual([1_500_000, 1_000_000]);
    expect(r?.page).toBe(11);
  });

  it("returns null when the balance sheet has no borrowing line", () => {
    const text = "Statement of financial position\n   2024   2023\nTrade payables   10   9\n";
    expect(findBorrowings([page(0, text)], [0])).toBeNull();
  });

  it("reads net cash from operating activities and PPE purchases on the cash-flow statement", () => {
    const text = [
      "Statement of cash flows for the year ended 31 December 2024",
      "                                                   2024          2023",
      "Cash generated from operations                  900,000       800,000",
      "Net cash generated from operating activities    750,000       640,000",
      "Purchase of property, plant and equipment      (210,000)     (180,000)",
      "Dividends paid                                 (100,000)      (90,000)",
    ].join("\n");
    const r = findCashFlowItems([page(0, "Notes\n"), page(1, text)]);
    expect(r.operatingCashFlow?.values).toEqual([750_000, 640_000]);
    expect(r.capex?.values).toEqual([210_000, 180_000]);
  });

  it("grades a value high when the next AFS comparative agrees, low when restated", () => {
    const mk = (fy: number, cur: number, prev: number): ExtractedDoc =>
      ({
        file: `f${fy}.pdf`,
        url: `https://doclib/${fy}`,
        guessedFiscalYear: fy,
        createdAt: "",
        dividends: [],
        extraction: {
          fiscalYear: fy,
          unitMultiplier: 1000,
          borrowings: { values: [cur, prev], label: "Borrowings", page: 3 },
          operatingCashFlow: { values: [cur * 2, prev * 2], label: "Net cash from operating activities", page: 5 },
          capex: { values: [cur / 2, prev / 2], label: "Purchase of PPE", page: 5 },
        },
      }) as unknown as ExtractedDoc;
    const docs = [mk(2023, 1_000_000, 900_000), mk(2024, 1_100_000, 1_000_000), mk(2025, 1_200_000, 1_150_000)];
    const chosen = new Map(docs.map((d) => [d.guessedFiscalYear, d.file]));
    const rows = buildExtrasRows("X", docs, chosen);
    expect(rows.map((r) => r.fields.borrowings?.confidence)).toEqual(["high", "low", "medium"]);
    expect(rows[0].fields.borrowings?.valueBn).toBeCloseTo(1);
    expect(rows[1].fields.borrowings?.restatedBn).toBeCloseTo(1.15);
    expect(freeCashFlow(rows[0])).toEqual({ valueBn: 1.5, confidence: "high" });
  });

  it("debt ratio is null for non-positive equity", () => {
    expect(debtRatioPercent(50, 200)).toBe(25);
    expect(debtRatioPercent(50, -3)).toBeNull();
    expect(debtRatioPercent(50, null)).toBeNull();
  });
});
