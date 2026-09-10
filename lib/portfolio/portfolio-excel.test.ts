import { describe, expect, it } from "vitest";
import {
  buildPortfolioWorkbook,
  parsePortfolioExcelBuffer,
  parsePortfolioBuyDate,
  parseHorizon,
  buildPortfolioExportFileName,
  ymdToFr,
  frToYmd,
  formatUtcYmd,
} from "./portfolio-excel";

describe("portfolio-excel", () => {
  it("round-trip export → import conserve la date JJ/MM/AAAA", () => {
    const buf = buildPortfolioWorkbook("Test", [
      {
        ticker: "SNTS",
        name: "Sonatel",
        quantity: 10,
        avgBuyPrice: 25000,
        buyDate: "2024-06-15",
        buyHorizon: "LONG",
        notes: "Core",
      },
      {
        ticker: "SGBC",
        name: "SGCI",
        quantity: 5.5,
        avgBuyPrice: 18000,
        buyDate: "2023-01-03",
        buyHorizon: "MOYEN",
        notes: null,
      },
    ]);
    const parsed = parsePortfolioExcelBuffer(buf);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      ticker: "SNTS",
      quantity: 10,
      avgBuyPrice: 25000,
      buyDate: "2024-06-15",
      buyHorizon: "LONG",
      notes: "Core",
    });
    expect(parsed.rows[1]?.buyDate).toBe("2023-01-03");
  });

  it("parse les dates FR / locales Excel sans décalage", () => {
    expect(ymdToFr("2024-06-15")).toBe("15/06/2024");
    expect(frToYmd("15/06/2024")).toBe("2024-06-15");
    expect(parsePortfolioBuyDate("15/06/2024")).toBe("2024-06-15");
    // Date JS = minuit local (comme SheetJS) — ne pas utiliser toISOString.
    expect(parsePortfolioBuyDate(new Date(2024, 5, 15))).toBe("2024-06-15");
    expect(parseHorizon("long")).toBe("LONG");
    expect(formatUtcYmd(new Date(Date.UTC(2024, 5, 15)))).toBe("2024-06-15");
  });

  it("nom de fichier assaini", () => {
    expect(buildPortfolioExportFileName("Mon portefeuille!", new Date("2026-09-04T12:00:00Z"))).toBe(
      "OuestBourse_Mon_portefeuille_2026-09-04.xlsx"
    );
  });
});
