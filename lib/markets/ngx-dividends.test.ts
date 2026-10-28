import { describe, expect, it } from "vitest";
import type { AdjustmentAction } from "@/lib/corporate-actions/types";
import { buildNgxDividends, topYieldByCompany, yieldPercent, type NgxDividendDbRow } from "./ngx-dividends";

function row(over: Partial<NgxDividendDbRow>): NgxDividendDbRow {
  return {
    id: "ngx-dv-X-2025",
    year: 2025,
    amount: 10,
    exDate: null,
    paymentDate: null,
    source: "NGX_OFFICIEL",
    isCanonical: true,
    ticker: "ZENITHBANK",
    name: "Zenith Bank",
    sectorSlug: "financial-services",
    sectorName: "Financial Services",
    close: 120,
    closeDate: "2026-10-28",
    ...over,
  };
}

describe("yieldPercent", () => {
  it("rapporte le dividende au cours", () => {
    expect(yieldPercent(10, 120)).toBe(8.33);
    expect(yieldPercent(5, 43)).toBe(11.63);
  });
  it("renvoie null sans cours ou sans montant exploitable", () => {
    expect(yieldPercent(10, null)).toBeNull();
    expect(yieldPercent(10, 0)).toBeNull();
    expect(yieldPercent(0, 100)).toBeNull();
  });
});

describe("buildNgxDividends", () => {
  it("renvoie une liste vide sans ligne", () => {
    const d = buildNgxDividends([]);
    expect(d.rows).toEqual([]);
    expect(d.years).toEqual([]);
    expect(d.companies).toBe(0);
    expect(d.priceDate).toBeNull();
  });

  it("calcule le rendement, trie par exercice puis ticker et liste les exercices", () => {
    const d = buildNgxDividends([
      row({ id: "a", ticker: "UBA", name: "UBA", year: 2024, amount: 5, close: 43 }),
      row({ id: "b", ticker: "ZENITHBANK", year: 2025 }),
      row({ id: "c", ticker: "ACCESSCORP", name: "Access", year: 2025, amount: 2, close: 20 }),
    ]);
    expect(d.rows.map((r) => `${r.year}-${r.ticker}`)).toEqual(["2025-ACCESSCORP", "2025-ZENITHBANK", "2024-UBA"]);
    expect(d.rows[1].yieldPercent).toBe(8.33);
    expect(d.years).toEqual([2025, 2024]);
    expect(d.companies).toBe(3);
    expect(d.priceDate).toBe("2026-10-28");
  });

  it("laisse le rendement à null sans cours et ignore les montants nuls", () => {
    const d = buildNgxDividends([
      row({ id: "a", close: null, closeDate: null }),
      row({ id: "b", ticker: "ZERO", amount: 0 }),
    ]);
    expect(d.rows).toHaveLength(1);
    expect(d.rows[0].close).toBeNull();
    expect(d.rows[0].yieldPercent).toBeNull();
  });

  it("garde une seule ligne par société et exercice : canonique et datée d'abord", () => {
    const d = buildNgxDividends([
      row({ id: "plain", amount: 9, isCanonical: false }),
      row({ id: "canon", amount: 10 }),
      row({ id: "dated", amount: 10, isCanonical: true, exDate: "2026-04-10", paymentDate: "2026-04-20" }),
    ]);
    expect(d.rows).toHaveLength(1);
    expect(d.rows[0].id).toBe("dated");
    expect(d.datedCount).toBe(1);
    expect(d.rows[0].exDate).toBe("2026-04-10");
  });

  it("ajuste montant et cours d'un fractionnement", () => {
    const split: AdjustmentAction = {
      ticker: "ZENITHBANK",
      kind: "SPLIT",
      effectiveDate: "2026-06-01",
      factor: 2,
      oldShares: 1,
      newShares: 2,
      adjustPrices: true,
      label: "2:1",
      sharesOutstandingBefore: null,
      sourceUrl: null,
    } as AdjustmentAction;
    const d = buildNgxDividends([row({ year: 2025, amount: 10, close: 120, closeDate: "2026-05-01" })], new Map([["ZENITHBANK", [split]]]));
    // Dividende et cours d'avant fractionnement sont divisés par 2 : le rendement ne change pas.
    expect(d.rows[0].amount).toBe(5);
    expect(d.rows[0].close).toBe(60);
    expect(d.rows[0].yieldPercent).toBe(8.33);
  });
});

describe("topYieldByCompany", () => {
  it("retient le dernier dividende de chaque société puis le meilleur rendement", () => {
    const d = buildNgxDividends([
      row({ id: "a", ticker: "UBA", year: 2024, amount: 5, close: 43 }),
      row({ id: "b", ticker: "UBA", year: 2023, amount: 40, close: 43 }),
      row({ id: "c", ticker: "ZENITHBANK", year: 2025 }),
    ]);
    expect(topYieldByCompany(d.rows)?.ticker).toBe("UBA");
    expect(topYieldByCompany(d.rows)?.year).toBe(2024);
    expect(topYieldByCompany([])).toBeNull();
  });
});
