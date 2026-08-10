import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { buildBrvmWorkbook, buildExportFileName, type ExportCompanyRow } from "./export-workbook";
import { COMPANIES_FULL, YEARS } from "../../prisma/seed-data/companies-full";
import golden from "./__fixtures__/golden-legacy-output.json";

const YEARS_ARRAY = [...YEARS];

function toRow(co: (typeof COMPANIES_FULL)[number]): ExportCompanyRow {
  return {
    ticker: co.ticker,
    name: co.name,
    country: co.country,
    sector: co.sector,
    per: co.per,
    mktcap: co.mktcap,
    prices: co.prices,
    dividends: co.dividends,
  };
}

describe("buildBrvmWorkbook", () => {
  const rows = COMPANIES_FULL.map(toRow);
  const buffer = buildBrvmWorkbook(rows, YEARS_ARRAY);
  const wb = XLSX.read(buffer, { type: "buffer" });

  it("génère les 3 feuilles attendues, dans le bon ordre", () => {
    expect(wb.SheetNames).toEqual(["Données BRVM", "Projections", "Classements"]);
  });

  it("feuille 'Données BRVM' : métriques brutes + score/signal présents pour SNTS", () => {
    const sheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Données BRVM"]);
    const sonatel = sheet.find((r) => r["Ticker"] === "SNTS")!;
    const expected = golden.find((g) => g.ticker === "SNTS")!;

    // Étape 14 : score/signal recalibrés — on ne fige plus leur égalité au JSX.
    expect(Number(sonatel["Score"])).toBeGreaterThan(0);
    expect(["ACHAT FORT", "ACHAT", "CONSERVER", "ALLÉGER", "VENDRE"]).toContain(sonatel["Signal"]);
    expect(String(sonatel["Perf.5ans(%)"])).toBe(String(expected.metrics.perf5));
    expect(String(sonatel["Rend.Div.(%)"])).toBe(String(expected.metrics.yield_));
    expect(sonatel["Cours 2026"]).toBe(expected.metrics.currentPrice);
  });

  it("feuille 'Projections' : les colonnes correspondent bien aux années de leur en-tête (bug corrigé)", () => {
    const sheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Projections"]);
    const sonatel = sheet.find((r) => r["Ticker"] === "SNTS")!;
    const expectedProjections = golden.find((g) => g.ticker === "SNTS")!.projections;

    expect(sonatel["2027 Proj."]).toBe(expectedProjections[0].projected);
    expect(sonatel["2027 Opt."]).toBe(expectedProjections[0].optimistic);
    expect(sonatel["2027 Pess."]).toBe(expectedProjections[0].pessimistic); // JSX : bug, colonne désalignée
    expect(sonatel["2028 Proj."]).toBe(expectedProjections[1].projected);
    expect(sonatel["2028 Opt."]).toBe(expectedProjections[1].optimistic);
    expect(sonatel["2028 Pess."]).toBe(expectedProjections[1].pessimistic);
    expect(sonatel["2029 Proj."]).toBe(expectedProjections[2].projected);
    expect(sonatel["2030 Proj."]).toBe(expectedProjections[3].projected);
    expect(sonatel["2031 Proj."]).toBe(expectedProjections[4].projected);
  });

  it("feuille 'Classements' : triée par score décroissant", () => {
    const sheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Classements"]);
    const scores = sheet.map((r) => Number(r["Score"]));
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

describe("buildExportFileName", () => {
  it("remplace les '/' par des '-' comme dans le JSX d'origine", () => {
    expect(buildExportFileName("09/08/2026")).toBe("BRVM_Analyse_09-08-2026.xlsx");
  });
});
