import { describe, expect, it } from "vitest";
import type { AdjustmentAction } from "@/lib/corporate-actions/types";
import { sessionDayChangePercent } from "./session-day-change";

const sntsSplit: AdjustmentAction = {
  ticker: "SNTS",
  kind: "SPLIT",
  effectiveDate: "2026-10-26",
  factor: 10,
  oldShares: 1,
  newShares: 10,
  adjustPrices: true,
  label: "Fractionnement 1:10 le 26/10/2026",
};

describe("sessionDayChangePercent — portefeuille SNTS", () => {
  const rows = [
    {
      date: "2026-10-22",
      close: 42000,
      source: "BRVM_OFFICIEL" as const,
      changePercent: null,
      isCanonical: true,
    },
    {
      date: "2026-10-23",
      close: 43850,
      source: "BRVM_OFFICIEL" as const,
      changePercent: null,
      isCanonical: false,
    },
    {
      date: "2026-10-23",
      close: 43850,
      source: "SIKAFINANCE" as const,
      changePercent: null,
      isCanonical: false,
    },
    {
      date: "2026-10-26",
      close: 4700,
      source: "BRVM_OFFICIEL" as const,
      changePercent: 7.18,
      isCanonical: true,
    },
  ];

  it("donne +7,18 % même si le 23/10 n'est pas canonique", () => {
    expect(sessionDayChangePercent(rows, [sntsSplit])).toBe(7.18);
  });

  it("retombe sur la clôture ajustée du 23/10 (4 385) si la variation officielle manque", () => {
    const withoutOfficial = rows.map((row) =>
      row.date === "2026-10-26" ? { ...row, changePercent: null } : row
    );
    expect(sessionDayChangePercent(withoutOfficial, [sntsSplit])).toBe(7.18);
  });

  it("ne saute pas le 23/10 pour comparer au 22/10 (ce qui donnerait ~+11 %)", () => {
    const canonicalOnly = rows.filter((row) => row.isCanonical).map((row) => ({ ...row, changePercent: null }));
    const skipped = sessionDayChangePercent(canonicalOnly, [sntsSplit]);
    expect(skipped).not.toBe(7.18);
    expect(sessionDayChangePercent(rows.map((row) => ({ ...row, changePercent: null })), [sntsSplit])).toBe(7.18);
  });
});
