import { describe, expect, it } from "vitest";
import { parseCoverPageText } from "./cover-page";
import { matchSummaryToListings, parseDailySummaryText } from "./daily-summary";
import { parseNgxDocDate, recentWeekdays, weekdaysBetween } from "./dates";
import { parseEquitiesPayload } from "./equities-json";
import { indicativeFcfa, parseErApiNgn } from "@/lib/markets/fx";
import { chooseCompanyName, colorForTicker, normalizeLegalName, sectorSlug } from "./names";
import { parseOfficialListItems, parseOfficialListText } from "./official-list";

const COVER = `
Print Date 14/10/2026
Daily Official List For 14/10/2026
Thursday 08/10/2026 161,051,677,934,758.97 248,042.50
Friday 09/10/2026 161,260,133,063,211.63 248,363.55
Wednesday 14/10/2026 160,812,190,862,654.81 247,673.65
NGX30 NGX 30 Index 9,124.73 9,138.57 9,114.65 9,103.30 9,109.09
NGXBNK NGX Banking Index 2,639.74 2,614.79 2,567.52 2,547.15 2,550.65
`;

const OFFICIAL = `
EQTY - Main Board
AGRICULTURE
FTNCOCOA FTN COCOA
PROCESSORS PLC
0.50 7.92 + 7.92 23/10/26 3,910 11.954.17
OKOMUOIL THE OKOMU OIL
PALM COMPANY PLC
0.50 1,276.20 1,148.60 23/10/26 2
FINANCIAL SERVICES
ETI ECOBANK
TRANSNATIONAL
INCORPORATED
32.00 67.00 67.00 23/10/26 2,164
UBA UNITED BANK FOR
AFRICA PLC
0.50 40.70 - 40.80 23/10/26 100
PREMIUM - Premium Board
INDUSTRIAL GOODS
DANGCEM DANGOTE CEMENT
PLC
0.50 1,111.00 + 1,060.00 23/10/26 100
UNITYBNK UNITY BANK PLC 0.50 1.51 3.18 25/09/25 2,000
`;

const OFFICIAL_PDF_LAYOUT = `
EQTY - Main Board
AGRICULTURE
FTNCOCOA FTN COCOA 0.50 7.92 + 7.92 3,910 11.954.17 11/06/10 18/10/08 26/07/10 0.03 0.00
23/10/26
PROCESSORS PLC
OKOMUOIL THE OKOMU OIL 0.50 1,276.20 1,148.60 2 1,765.00 1,038.00 28/04/26 07/05/07 28/04/26 15.005.63 226.67
23/10/26
PALM COMPANY PLC
PREMIUM - Premium Board
INDUSTRIAL GOODS
DANGCEM DANGOTE CEMENT 0.50 1,111.00 + 1,060.00 100 1,189.00 534.60 18/06/26 14/05/12 18/06/26 45.000.63 1,766.54
23/10/26
PLC
`;

describe("parseurs NGX", () => {
  it("lit l'ASI et le dernier niveau d'indice de la couverture", () => {
    const cover = parseCoverPageText(COVER);
    expect(cover?.printDate).toBe("2026-10-14");
    expect(cover?.asi.code).toBe("NGX_ASI");
    expect(cover?.asi.value).toBe(247673.65);
    expect(cover?.asi.previous).toBe(248363.55);
    const ngx30 = cover?.indices.find((row) => row.code === "NGX30");
    expect(ngx30?.value).toBe(9109.09);
    expect(ngx30?.name).toBe("NGX 30 Index");
  });

  it("prend le deuxième nombre (après le nominal) comme clôture", () => {
    const rows = parseOfficialListText(OFFICIAL);
    const bySymbol = new Map(rows.map((row) => [row.symbol, row]));
    expect(bySymbol.get("FTNCOCOA")?.close).toBe(7.92);
    expect(bySymbol.get("FTNCOCOA")?.name).toContain("PROCESSORS");
    expect(bySymbol.get("OKOMUOIL")?.close).toBe(1276.2);
    expect(bySymbol.get("ETI")?.close).toBe(67);
    expect(bySymbol.get("UBA")?.close).toBe(40.7);
    expect(bySymbol.get("DANGCEM")?.close).toBe(1111);
    expect(bySymbol.get("DANGCEM")?.board).toBe("Premium Board");
    expect(bySymbol.get("DANGCEM")?.sector).toBe("INDUSTRIAL GOODS");
    expect(bySymbol.get("UNITYBNK")?.tradeDate).toBe("2025-09-25");
    expect(bySymbol.has("PROCESSORS")).toBe(false);
  });

  it("prend la dernière date comme séance quand les dividendes précèdent", () => {
    const rows = parseOfficialListText(OFFICIAL_PDF_LAYOUT);
    const bySymbol = new Map(rows.map((row) => [row.symbol, row]));
    expect(bySymbol.get("FTNCOCOA")?.tradeDate).toBe("2026-10-23");
    expect(bySymbol.get("FTNCOCOA")?.close).toBe(7.92);
    expect(bySymbol.get("OKOMUOIL")?.close).toBe(1276.2);
    expect(bySymbol.get("DANGCEM")?.tradeDate).toBe("2026-10-23");
    expect(bySymbol.get("DANGCEM")?.close).toBe(1111);
    expect(bySymbol.has("PROCESSORS")).toBe(false);
    expect(bySymbol.has("PALM")).toBe(false);
  });

  it("lit le prix de marché et la quantité dans les colonnes du PDF", () => {
    const y = 398;
    const rows = parseOfficialListItems([
      [
        { str: "PREMIUM - Premium Board", x: 30, y: 500 },
        { str: "INDUSTRIAL GOODS", x: 30, y: 480 },
        { str: "DANGCEM", x: 34, y },
        { str: "DANGOTE CEMENT", x: 95, y },
        { str: "0.50", x: 205, y },
        { str: "1,111.00", x: 391, y },
        { str: "+", x: 435, y },
        { str: "1,060.00", x: 495, y },
        { str: "23/10/26", x: 535, y: y - 1 },
        { str: "100", x: 593, y },
        { str: "PLC", x: 95, y: y - 14 },
      ],
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      symbol: "DANGCEM",
      close: 1111,
      volume: 100,
      tradeDate: "2026-10-23",
      board: "Premium Board",
      sector: "INDUSTRIAL GOODS",
    });
    expect(rows[0]?.name).toContain("DANGOTE CEMENT");
    expect(rows[0]?.name).toContain("PLC");
  });

  it("apparie le daily summary par raison sociale", () => {
    const text = `
PRICES FOR PREMIUM BOARD SECURITIES
INDUSTRIAL GOODS
6 DANGOTE CEMENT PLC 18,746,524.33 1,111.00 10.00 921 2,714,425
PRICES FOR MAIN BOARD SECURITIES
FINANCIAL SERVICES
1 UNITED BANK FOR AFRICA PLC 1,798,784.33 40.70 -2.63 1,004 8,786,710
5 MTN NIGERIA COMMUNICATIONS PLC 17,321,337.08 825.00 - 2,306 1,134,230
`;
    const rows = parseDailySummaryText(text);
    expect(rows.find((row) => row.name.includes("DANGOTE"))).toMatchObject({
      close: 1111,
      changePercent: 10,
      board: "Premium Board",
      sector: "INDUSTRIAL GOODS",
    });
    expect(rows.find((row) => row.name.includes("MTN"))?.changePercent).toBeNull();
    const matched = matchSummaryToListings(rows, [
      { ticker: "DANGCEM", name: "DANGOTE CEMENT PLC" },
      { ticker: "UBA", name: "UNITED BANK FOR AFRICA PLC" },
      { ticker: "MTNN", name: "MTN NIGERIA COMMUNICATIONS PLC" },
    ]);
    expect(matched.map((row) => row.ticker).sort()).toEqual(["DANGCEM", "MTNN", "UBA"]);
  });

  it("refuse un JSON trop court ou trop vieux et accepte une séance complète", () => {
    const now = new Date("2026-10-27T16:00:00.000Z");
    const one = parseEquitiesPayload(
      [{ Symbol: "DANGCEM", ClosePrice: 1111, PrevClosingPrice: 1010, TradeDate: "2026-10-27T00:00:00", Company2: "DANGOTE", Sector: "INDUSTRIAL GOODS", Market: "Premium Board" }],
      now
    );
    expect(one.ok).toBe(false);

    const rows = Array.from({ length: 100 }, (_, index) => ({
      Symbol: `NGX${String(index).padStart(3, "0")}`,
      ClosePrice: 10 + index,
      PrevClosingPrice: 9 + index,
      PercChange: null,
      TradeDate: "2026-10-27T00:00:00",
      Company2: `NAME ${index}`,
      Volume: 1000,
    }));
    const ok = parseEquitiesPayload(rows, now);
    expect(ok.ok).toBe(true);
    expect(ok.rows).toHaveLength(100);
    expect(ok.rows[0]?.changePercent).toBeCloseTo(((10 - 9) / 9) * 100, 1);

    rows[0]!.TradeDate = "2026-10-01T00:00:00";
    const stale = parseEquitiesPayload(
      rows.map((row) => ({ ...row, TradeDate: "2026-10-01T00:00:00" })),
      now
    );
    expect(stale.ok).toBe(false);
  });
});

describe("noms, dates et change indicatif", () => {
  it("ne remplace pas une raison sociale par le libellé court du JSON", () => {
    expect(chooseCompanyName("DANGOTE CEMENT PLC", "DANGOTE", "DANGCEM")).toBe("DANGOTE CEMENT PLC");
    expect(chooseCompanyName("DANGCEM", "DANGOTE CEMENT PLC", "DANGCEM")).toBe("DANGOTE CEMENT PLC");
    expect(chooseCompanyName("DANGOTE", "DANGOTE CEMENT PLC", "DANGCEM")).toBe("DANGOTE CEMENT PLC");
  });

  it("normalise le secteur et le nom légal", () => {
    expect(sectorSlug("CONSTRUCTION/REAL ESTATE")).toBe("construction-real-estate");
    expect(normalizeLegalName("MTN NIGERIA COMMUNICATIONS PLC")).toBe("MTN NIGERIA COMMUNICATIONS");
    expect(colorForTicker("DANGCEM")).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("convertit un lundi et borne les semaines", () => {
    expect(parseNgxDocDate("23/10/26")).toBe("2026-10-23");
    expect(recentWeekdays("2026-10-25", 2)).toEqual(["2026-10-23", "2026-10-22"]);
    expect(weekdaysBetween("2026-10-23", "2026-10-26")).toEqual(["2026-10-23", "2026-10-26"]);
  });

  it("calcule un FCFA indicatif à partir du peg XOF et du taux EUR/NGN", () => {
    const rate = parseErApiNgn({ result: "success", rates: { NGN: 1500.531304 }, time_last_update_unix: 1761609600 });
    expect(rate?.ngnPerEur).toBeCloseTo(1500.531304);
    expect(indicativeFcfa(1500.531304, 1500.531304)).toBe(656);
    expect(indicativeFcfa(Number.NaN, 1500)).toBeNull();
  });
});
