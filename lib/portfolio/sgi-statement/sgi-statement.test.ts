import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { COMPANIES_FULL } from "@/prisma/seed-data/companies-full";
import { createSecurityMatcher } from "./match-security";
import { parseFrNumber } from "./french-number";
import { StatementImportError } from "./messages";
import { parseStatementText } from "./parse-statement";
import { parseStatementUpload } from "./parse-upload";
import { buildStatementTradeNote, consolidateImportRows, consolidateOtherRows } from "./consolidate";
import type { SecurityCatalogEntry, StatementParseResult, StatementRowDraft } from "./types";

const catalog: SecurityCatalogEntry[] = COMPANIES_FULL.map((company) => ({
  id: company.ticker,
  ticker: company.ticker,
  name: company.name,
  isin: company.ticker === "SNTS" ? "SN0000000018" : null,
}));

function fixture(name: string): string {
  return readFileSync(path.join(__dirname, "fixtures", name), "utf8");
}

function parseFixture(name: string): StatementParseResult {
  return parseStatementText(fixture(name), catalog);
}

function byTicker(result: StatementParseResult, ticker: string): StatementRowDraft {
  const row = result.rows.find((item) => item.match.ticker === ticker);
  expect(row, ticker).toBeTruthy();
  return row!;
}

function pdfEscape(value: string): string {
  let out = "";
  for (const char of value) {
    if (char === "(" || char === ")" || char === "\\") out += `\\${char}`;
    else if (char.charCodeAt(0) <= 255) out += char;
    else out += "?";
  }
  return out;
}

function pdfStream(lines: string[]): string {
  const commands = ["BT", "/F1 10 Tf", "40 800 Td"];
  lines.forEach((line, index) => {
    if (index > 0) commands.push("0 -14 Td");
    commands.push(`(${pdfEscape(line)}) Tj`);
  });
  commands.push("ET");
  return commands.join("\n");
}

function buildRawPdf(streams: string[], mediaBox = "0 0 595 842"): Buffer {
  const fontId = 3;
  const objects: string[] = ["", "", ""];
  const kids: string[] = [];
  streams.forEach((stream) => {
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    kids.push(`${pageId} 0 R`);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [${mediaBox}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`
    );
    objects.push(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  });
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${streams.length} >>`;
  objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(body, "latin1");
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += `${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return Buffer.from(body, "latin1");
}

const TABLE_X = [36, 120, 210, 400, 485, 545, 600];

function tableStream(rows: string[][]): string {
  const commands = ["BT", "/F1 9 Tf"];
  rows.forEach((row, rowIndex) => {
    const y = 780 - rowIndex * 16;
    row.forEach((cell, column) => {
      if (!cell) return;
      const x = TABLE_X[column] ?? 36;
      commands.push(`1 0 0 1 ${x} ${y} Tm (${pdfEscape(asciiFold(cell))}) Tj`);
    });
  });
  commands.push("ET");
  return commands.join("\n");
}

function buildTablePdf(pages: string[][][]): Buffer {
  return buildRawPdf(pages.map(tableStream), "0 0 700 842");
}

function buildTextPdf(lines: string[]): Buffer {
  return buildRawPdf([pdfStream(lines)]);
}

function buildPdfPages(pages: string[][]): Buffer {
  return buildRawPdf(pages.map(pdfStream));
}

function asciiFold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

describe("nombres français", () => {
  it("lit les formats FCFA usuels", () => {
    expect(parseFrNumber("1 234,50")).toBe(1234.5);
    expect(parseFrNumber("1.234,50")).toBe(1234.5);
    expect(parseFrNumber("1,234.50")).toBe(1234.5);
    expect(parseFrNumber("12,5 %")).toBe(12.5);
    expect(parseFrNumber("7 800 FCFA")).toBe(7800);
    expect(parseFrNumber("25 000,00")).toBe(25000);
    expect(parseFrNumber("8 520.000")).toBe(8520);
    expect(parseFrNumber("16 300.000")).toBe(16300);
    expect(parseFrNumber(32000)).toBe(32000);
  });
});

describe("relevé SGI — texte", () => {
  it("lit un tableau SGI-CI (colonnes, nombres FR)", () => {
    const result = parseFixture("sgici-colonnes.txt");
    expect(result.layoutId).toBe("colonnes");
    expect(result.issuer).toBe("SGI-CI");
    expect(result.statementDate).toBe("2026-09-30");
    expect(result.rows).toHaveLength(4);
    expect(byTicker(result, "SNTS")).toMatchObject({
      quantity: 120,
      avgBuyPrice: 25000,
      lastPrice: 32000,
      valuation: 3840000,
      match: { confidence: "haute", ticker: "SNTS" },
    });
    expect(byTicker(result, "SGBC").avgBuyPrice).toBe(19250.5);
    expect(byTicker(result, "ORAC").match.confidence).toBe("haute");
    expect(byTicker(result, "PALC").quantity).toBe(200);
  });

  it("lit Hudson (nom + code entre parenthèses) et garde la ligne inconnue", () => {
    const result = parseFixture("hudson-colonnes.txt");
    expect(result.issuer).toBe("Hudson & Cie");
    expect(result.statementDate).toBe("2026-06-15");
    expect(byTicker(result, "SNTS")).toMatchObject({ quantity: 1234, avgBuyPrice: 12500.5, lastPrice: 13200 });
    expect(byTicker(result, "SGBC").quantity).toBe(50);
    const unknown = result.rows.find((row) => row.match.confidence === "aucune");
    expect(unknown?.label).toMatch(/LIGNE INCONNUE/i);
    expect(unknown?.quantity).toBe(10);
    expect(result.rows.some((row) => /total portefeuille/i.test(row.label))).toBe(false);
  });

  it("respecte un ordre de colonnes différent (Atlantique Finance)", () => {
    const result = parseFixture("atlantique-ordre.txt");
    expect(result.issuer).toBe("Atlantique Finance");
    expect(result.statementDate).toBe("2026-01-02");
    expect(byTicker(result, "ECOC")).toMatchObject({ quantity: 50, avgBuyPrice: 8500, lastPrice: 9000, valuation: 450000 });
    expect(byTicker(result, "TTLS")).toMatchObject({ quantity: 100, lastPrice: 12000, avgBuyPrice: 11000 });
  });

  it("ignore une colonne de variation en pourcentage", () => {
    const result = parseFixture("variation.txt");
    expect(byTicker(result, "SNTS")).toMatchObject({ quantity: 120, avgBuyPrice: 25000, lastPrice: 32000, valuation: 3840000 });
  });

  it("lit des blocs libellé / valeur (BICI Bourse) sans jeter l’inconnue", () => {
    const result = parseFixture("bici-blocs.txt");
    expect(result.layoutId).toBe("blocs");
    expect(result.issuer).toBe("BICI Bourse");
    expect(result.statementDate).toBe("2025-12-31");
    expect(byTicker(result, "CBIBF")).toMatchObject({ quantity: 75, avgBuyPrice: 7800, lastPrice: 8150, valuation: 611250 });
    expect(byTicker(result, "SIBC").quantity).toBe(30);
    const unknown = result.rows.find((row) => /FICTIVE|XYZ1/i.test(row.label));
    expect(unknown?.match.confidence).toBe("aucune");
    expect(unknown?.quantity).toBe(5);
  });

  it("lit des lignes libres EDC et ne devine pas un BOA ambigu", () => {
    const edc = parseFixture("edc-lignes.txt");
    expect(edc.layoutId).toBe("lignes");
    expect(edc.issuer).toBe("EDC");
    expect(edc.statementDate).toBe("2026-03-10");
    expect(byTicker(edc, "SNTS").quantity).toBe(40);
    expect(byTicker(edc, "BOAB")).toMatchObject({ quantity: 25, avgBuyPrice: 4800, lastPrice: 5100 });
    const fund = edc.rows.find((row) => /FONDS PRIVE/i.test(row.label));
    expect(fund?.instrumentKind).toBe("fcp");
    expect(fund?.tracked).toBe(true);
    expect(fund?.match.companyId).toBeNull();
    expect(fund?.quantity).toBe(12);

    const boa = parseFixture("boa-ambigu.txt");
    expect(boa.rows).toHaveLength(1);
    expect(boa.rows[0]?.quantity).toBe(10);
    expect(boa.rows[0]?.match.confidence).not.toBe("haute");
    expect(boa.rows[0]?.match.ticker == null || boa.rows[0]?.match.ambiguous).toBe(true);
  });

  it("refuse un courrier qui n’est pas un relevé", () => {
    expect(() => parseFixture("lettre.txt")).toThrow(StatementImportError);
    try {
      parseFixture("lettre.txt");
    } catch (error) {
      expect(error).toBeInstanceOf(StatementImportError);
      expect((error as StatementImportError).code).toBe("UNRECOGNIZED");
      expect((error as StatementImportError).message).toMatch(/Aucune ligne de position/);
    }
  });
});

describe("relevé SGI — fichiers", () => {
  it("lit un CSV séparé par des points-virgules", async () => {
    const csv = [
      "ticker;libelle;quantite;pru;cours;valorisation",
      "ETIT;Ecobank Transnational;1000;18,50;22,00;22000",
      "TTLC;TotalEnergies Marketing CI;10;2 100;2 400;24 000",
      "ZZZZ;Fonds prive ouest;12;2000;2200;26400",
    ].join("\n");
    const result = await parseStatementUpload(
      { filename: "releve-sgi-benin.csv", mime: "text/csv", bytes: new TextEncoder().encode(csv) },
      catalog
    );
    expect(result.layoutId).toBe("matrice");
    expect(byTicker(result, "ETIT")).toMatchObject({ quantity: 1000, avgBuyPrice: 18.5, lastPrice: 22, valuation: 22000 });
    expect(byTicker(result, "TTLC").quantity).toBe(10);
    expect(result.rows.find((row) => row.instrumentKind === "fcp")).toMatchObject({
      quantity: 12,
      tracked: true,
      avgBuyPrice: 2000,
    });
  });

  it("lit un Excel dont les colonnes ne sont pas dans l’ordre OuestBourse", async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Désignation", "Évaluation", "Cours", "PRU", "Quantité"],
      ["Sonatel", 3840000, 32000, 25000, 120],
      ["SGB CI", 1050000, 21000, 18500, 50],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Relevé");
    const bytes = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const result = await parseStatementUpload(
      { filename: "releve.xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes },
      catalog
    );
    expect(byTicker(result, "SNTS")).toMatchObject({ quantity: 120, avgBuyPrice: 25000, lastPrice: 32000, valuation: 3840000 });
    expect(byTicker(result, "SGBC").quantity).toBe(50);
  });

  it("extrait le texte d’un PDF et refuse un PDF sans couche de texte", async () => {
    const lines = fixture("sgici-colonnes.txt").split(/\r?\n/).filter(Boolean);
    const pdf = buildTextPdf(lines);
    const parsed = await parseStatementUpload({ filename: "releve.pdf", mime: "application/pdf", bytes: pdf }, catalog);
    expect(byTicker(parsed, "SNTS").quantity).toBe(120);
    expect(parsed.issuer).toBe("SGI-CI");

    await expect(
      parseStatementUpload({ filename: "scan.pdf", mime: "application/pdf", bytes: buildTextPdf([]) }, catalog)
    ).rejects.toMatchObject({
      code: "SCANNED_PDF",
    });
    await expect(
      parseStatementUpload({ filename: "scan.pdf", mime: "application/pdf", bytes: buildTextPdf([]) }, catalog)
    ).rejects.toThrow(/OCR/);
  });

  it("agrège un historique bruité en une position par titre", () => {
    const result = parseFixture("historique-bruit.txt");
    expect(result.layoutId).toBe("positions");
    expect(result.documentKind).toBe("historique");
    expect(result.issuer).toBe("SGI-CI");
    expect(result.statementDate).toBe("2026-09-30");
    expect(result.rows).toHaveLength(4);
    expect(byTicker(result, "SNTS")).toMatchObject({
      quantity: 120,
      avgBuyPrice: 12000,
      tradeDate: "2026-01-10",
      instrumentKind: "action",
      tracked: true,
    });
    expect(byTicker(result, "PALC")).toMatchObject({ quantity: 200, avgBuyPrice: 7500, tradeDate: "2026-02-10" });
    const bond = result.rows.find((row) => row.instrumentKind === "obligation");
    const fund = result.rows.find((row) => row.instrumentKind === "fcp");
    expect(bond).toMatchObject({
      quantity: 10,
      avgBuyPrice: 10000,
      tracked: true,
      instrumentKind: "obligation",
      couponRate: 6.25,
      maturityDate: null,
      priceMode: "FCFA",
    });
    expect(fund).toMatchObject({ quantity: 25, avgBuyPrice: 8000, tracked: true, instrumentKind: "fcp", priceMode: "FCFA" });
    expect(bond?.warnings.join(" ")).not.toMatch(/non suivie/i);
    expect(fund?.warnings.join(" ")).not.toMatch(/non suivi/i);
    expect(result.rows.some((row) => row.match.ticker === "SGBC" || row.quantity === 999)).toBe(false);
    const reasons = new Set(result.ignored.map((line) => line.reason));
    for (const reason of ["adresse", "especes", "frais", "total", "page", "disclaimer", "soldee", "couverte", "en-tete"] as const) {
      expect(reasons.has(reason), reason).toBe(true);
    }
  });

  it("agrège achats et ventes d’une obligation et d’un FCP", () => {
    const text = [
      "Date d'opération    Libellé    Sens    Qté    Cours moy",
      "10/01/2026    OBL ETAT CI 6,25% 2028    Achat    10    10000",
      "01/03/2026    OBL ETAT CI 6,25% 2028    Achat    5    12000",
      "01/06/2026    OBL ETAT CI 6,25% 2028    Vente    3    13000",
      "10/01/2026    FCP HORIZON UEMOA géré par NSIA AM    Achat    20    8000",
      "01/04/2026    FCP HORIZON UEMOA géré par NSIA AM    Achat    10    11000",
      "01/07/2026    FCP HORIZON UEMOA géré par NSIA AM    Vente    5    9000",
    ].join("\n");
    const result = parseStatementText(text, catalog);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.find((row) => row.instrumentKind === "obligation")).toMatchObject({
      quantity: 12,
      avgBuyPrice: 10666.67,
      tradeDate: "2026-01-10",
      tracked: true,
      couponRate: 6.25,
    });
    expect(result.rows.find((row) => row.instrumentKind === "fcp")).toMatchObject({
      quantity: 25,
      avgBuyPrice: 9000,
      tradeDate: "2026-01-10",
      tracked: true,
      manager: "NSIA AM",
    });
  });

  it("refuse un format non supporté", async () => {
    await expect(
      parseStatementUpload({ filename: "notes.txt", mime: "text/plain", bytes: new TextEncoder().encode("SNTS 10") }, catalog)
    ).rejects.toMatchObject({ code: "UNSUPPORTED" });
  });

  function historyMatrix(): string[][] {
    return fixture("historique-bruit.txt")
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => line.trim().split(/\s{2,}/));
  }

  it("agrège le même historique en CSV, Excel et PDF", async () => {
    const matrix = historyMatrix();
    const csv = matrix.map((row) => row.join(";")).join("\n");
    const fromCsv = await parseStatementUpload(
      { filename: "historique.csv", mime: "text/csv", bytes: new TextEncoder().encode(csv) },
      catalog
    );
    expect(byTicker(fromCsv, "SNTS")).toMatchObject({ quantity: 120, avgBuyPrice: 12000 });
    expect(fromCsv.rows).toHaveLength(4);

    const sheet = XLSX.utils.aoa_to_sheet(matrix);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Historique");
    const xlsx = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const fromXlsx = await parseStatementUpload(
      {
        filename: "historique.xlsx",
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: xlsx,
      },
      catalog
    );
    expect(byTicker(fromXlsx, "SNTS")).toMatchObject({ quantity: 120, avgBuyPrice: 12000, tradeDate: "2026-01-10" });
    expect(fromXlsx.rows.filter((row) => row.instrumentKind === "obligation")).toHaveLength(1);
    expect(fromXlsx.rows.filter((row) => row.instrumentKind === "fcp")).toHaveLength(1);

    const pdf = buildTextPdf(
      fixture("historique-bruit.txt")
        .split(/\r?\n/)
        .map((line) => line.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    );
    const fromPdf = await parseStatementUpload({ filename: "historique.pdf", mime: "application/pdf", bytes: pdf }, catalog);
    expect(byTicker(fromPdf, "SNTS")).toMatchObject({ quantity: 120, avgBuyPrice: 12000 });
    expect(fromPdf.rows).toHaveLength(4);
  });

  it("lit une image via le texte transcrit, et refuse un HEIC", async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const fromImage = await parseStatementUpload(
      { filename: "releve.png", mime: "image/png", bytes: png },
      catalog,
      { transcribe: async () => ({ text: fixture("historique-bruit.txt") }) }
    );
    expect(byTicker(fromImage, "SNTS")).toMatchObject({ quantity: 120, avgBuyPrice: 12000 });
    expect(fromImage.rows).toHaveLength(4);

    const heic = Buffer.alloc(16);
    heic.write("ftyp", 4);
    heic.write("heic", 8);
    await expect(
      parseStatementUpload({ filename: "photo.heic", mime: "image/heic", bytes: heic }, catalog)
    ).rejects.toMatchObject({ code: "HEIC" });
  });
});

const MOUVEMENTS_MATRIX: string[][] = [
  ["Titre", "Date", "Libellé", "Valeur Unitaire", "Débit", "Crédit", "Solde"],
  ["BOA BENIN", "", "", "", "", "", "16"],
  ["", "29/04/2026", "Solde au :29/04/2026", "", "", "", "0"],
  ["", "29/07/2026", "Acquisitions BOA BENIN", "8 520.000", "", "16", "16"],
  ["BOA NIGER", "", "", "", "", "", "0"],
  ["", "29/04/2026", "Solde au :29/04/2026", "", "", "", "0"],
  ["", "23/06/2026", "Acquisitions BOA NIGER", "3 850.000", "", "26", "26"],
  ["", "28/07/2026", "Cessions BOA NIGER", "5 250.000", "2", "", "24"],
  ["", "28/07/2026", "Cessions BOA NIGER", "5 250.000", "24", "", "0"],
  ["BOA-BURKINA FASO", "", "", "", "", "", "0"],
  ["", "29/04/2026", "Solde au :29/04/2026", "", "", "", "0"],
  ["", "23/06/2026", "Acquisitions BOA-BURKINA FASO", "5 595.000", "", "27", "27"],
  ["", "28/07/2026", "Cessions BOA-BURKINA FASO", "6 905.000", "2", "", "25"],
  ["", "28/07/2026", "Cessions BOA-BURKINA FASO", "6 905.000", "5", "", "20"],
  ["", "28/07/2026", "Cessions BOA-BURKINA FASO", "6 905.000", "20", "", "0"],
  ["CIE COTE DIVOIRE", "", "", "", "", "", "36"],
  ["", "29/04/2026", "Solde au :29/04/2026", "", "", "", "0"],
  ["", "21/07/2026", "Acquisitions CIE COTE DIVOIRE", "5 140.000", "", "16", "16"],
  ["", "24/07/2026", "Acquisitions CIE COTE DIVOIRE", "5 390.000", "", "20", "36"],
  ["ECOBANK- CI", "", "", "", "", "", "6"],
  ["", "29/04/2026", "Solde au :29/04/2026", "", "", "", "0"],
  ["", "20/05/2026", "Acquisitions ECOBANK- CI", "16 300.000", "", "5", "5"],
  ["", "20/05/2026", "Acquisitions ECOBANK- CI", "16 300.000", "", "1", "6"],
  ["FILTISAC COTE", "", "", "", "", "", "33"],
  ["DIVOIRE", "", "", "", "", "", ""],
  ["", "29/04/2026", "Solde au :29/04/2026", "", "", "", "0"],
];

function expectMouvements(result: StatementParseResult) {
  expect(result.layoutId).toBe("mouvements");
  expect(result.documentKind).toBe("historique");
  expect(result.rows.map((row) => row.match.ticker)).toEqual(["BOAB", "CIEC", "ECOC", "FTSC"]);
  expect(byTicker(result, "BOAB")).toMatchObject({
    quantity: 16,
    avgBuyPrice: 8520,
    tradeDate: "2026-07-29",
    match: { ticker: "BOAB", confidence: "haute" },
  });
  expect(byTicker(result, "CIEC")).toMatchObject({
    quantity: 36,
    avgBuyPrice: 5278.89,
    tradeDate: "2026-07-21",
    match: { ticker: "CIEC", confidence: "haute" },
  });
  expect(byTicker(result, "ECOC")).toMatchObject({
    quantity: 6,
    avgBuyPrice: 16300,
    tradeDate: "2026-05-20",
    match: { ticker: "ECOC", confidence: "haute" },
  });
  const filtisac = byTicker(result, "FTSC");
  expect(filtisac).toMatchObject({
    quantity: 33,
    avgBuyPrice: null,
    tradeDate: null,
    match: { ticker: "FTSC", confidence: "faible" },
  });
  expect(filtisac.warnings.join(" ")).toMatch(/solde d'en-tête/i);
  expect(result.rows.some((row) => row.match.ticker === "BOAN" || row.match.ticker === "BOABF")).toBe(false);
  const sold = result.ignored.filter((line) => line.reason === "soldee").map((line) => line.raw);
  expect(sold.some((raw) => /BOA NIGER/i.test(raw) && /36 400/.test(raw))).toBe(true);
  expect(sold.some((raw) => /BURKINA/i.test(raw) && /35 370/.test(raw))).toBe(true);
}

describe("relevé de mouvements de titres", () => {
  it("rapproche les graphies SGI de toutes les cotes du catalogue", () => {
    const matcher = createSecurityMatcher(catalog);
    expect(matcher("BOA BENIN")).toMatchObject({ ticker: "BOAB", confidence: "haute" });
    expect(matcher("BOA NIGER")).toMatchObject({ ticker: "BOAN", confidence: "haute" });
    expect(matcher("BOA-BURKINA FASO")).toMatchObject({ ticker: "BOABF", confidence: "haute" });
    expect(matcher("CIE COTE DIVOIRE")).toMatchObject({ ticker: "CIEC", confidence: "haute" });
    expect(matcher("CIE COTE D'IVOIRE")).toMatchObject({ ticker: "CIEC", confidence: "haute" });
    expect(matcher("CIE COTE D IVOIRE")).toMatchObject({ ticker: "CIEC", confidence: "haute" });
    expect(matcher("ECOBANK- CI")).toMatchObject({ ticker: "ECOC", confidence: "haute" });
    expect(matcher("FILTISAC COTE DIVOIRE")).toMatchObject({ ticker: "FTSC", confidence: "haute" });
    expect(matcher("FILTISAC COTE D IVOIRE")).toMatchObject({ ticker: "FTSC", confidence: "haute" });
    expect(matcher("SITAB COTE DIVOIRE")).toMatchObject({ ticker: "STBC", confidence: "haute" });
    expect(matcher("BOA COTE D IVOIRE")).toMatchObject({ ticker: "BOAC", confidence: "haute" });
  });

  it("lit le relevé groupé (texte, Excel, PDF)", async () => {
    expectMouvements(parseFixture("mouvements-titres.txt"));

    const sheet = XLSX.utils.aoa_to_sheet(MOUVEMENTS_MATRIX);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Mouvements");
    const xlsx = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const fromXlsx = await parseStatementUpload(
      {
        filename: "mouvements.xlsx",
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: xlsx,
      },
      catalog
    );
    expectMouvements(fromXlsx);

    const csv = MOUVEMENTS_MATRIX.map((row) => row.join(";")).join("\n");
    const fromCsv = await parseStatementUpload(
      { filename: "mouvements.csv", mime: "text/csv", bytes: new TextEncoder().encode(csv) },
      catalog
    );
    expectMouvements(fromCsv);

    const fromPdf = await parseStatementUpload(
      { filename: "mouvements.pdf", mime: "application/pdf", bytes: buildTablePdf([MOUVEMENTS_MATRIX]) },
      catalog
    );
    expectMouvements(fromPdf);
  });

  it("poursuit un groupe sur la page suivante", async () => {
    const lines = fixture("mouvements-titres.txt").split(/\r?\n/).filter((line) => line.length > 0);
    const header = lines.find((line) => line.startsWith("Titre"));
    const cie = lines.find((line) => line.startsWith("CIE COTE DIVOIRE"));
    const cut = lines.findIndex((line) => /24\/07\/2026/.test(line));
    expect(cut).toBeGreaterThan(0);
    const continued = [...lines.slice(0, cut), "Page 1 / 2", header!, cie!, ...lines.slice(cut)].join("\n");
    expectMouvements(parseStatementText(continued, catalog));

    const matrixCut = MOUVEMENTS_MATRIX.findIndex((row) => row[1] === "24/07/2026");
    const fromPdf = await parseStatementUpload(
      {
        filename: "mouvements-2p.pdf",
        mime: "application/pdf",
        bytes: buildTablePdf([
          MOUVEMENTS_MATRIX.slice(0, matrixCut),
          [MOUVEMENTS_MATRIX[0]!, ...MOUVEMENTS_MATRIX.slice(matrixCut)],
        ]),
      },
      catalog
    );
    expectMouvements(fromPdf);
  });

  it("reprend un solde d'en-tête sans mouvements et signale un écart", () => {
    const text = [
      "Titre                   Date          Libellé                           Valeur Unitaire Débit     Crédit    Solde",
      "PALM CI                                                                                                     40",
      "                        01/01/2026    Solde au :01/01/2026                                                  0",
      "SONATEL                                                                                                     12",
      "                        01/01/2026    Solde au :01/01/2026                                                  0",
      "                        02/02/2026    Acquisitions SONATEL              1 000.000                 10        10",
    ].join("\n");
    const result = parseStatementText(text, catalog);
    expect(byTicker(result, "PALC")).toMatchObject({ quantity: 40, avgBuyPrice: null, match: { confidence: "faible" } });
    expect(byTicker(result, "SNTS")).toMatchObject({
      quantity: 10,
      avgBuyPrice: 1000,
      tradeDate: "2026-02-02",
      match: { confidence: "faible" },
    });
    expect(byTicker(result, "SNTS").warnings.join(" ")).toMatch(/quantité calculée/);
  });

  it("lit la capture (OCR) même si les colonnes ne sont plus alignées", async () => {
    expectMouvements(parseFixture("mouvements-titres-ocr.txt"));
    const png = readFileSync(path.join(__dirname, "fixtures", "mouvements-titres.png"));
    const fromImage = await parseStatementUpload(
      { filename: "releve-mouvements.png", mime: "image/png", bytes: png },
      catalog,
      { transcribe: async () => ({ text: fixture("mouvements-titres-ocr.txt") }) }
    );
    expectMouvements(fromImage);
  });

  it("compte une attribution gratuite et un transfert sans inverser débit et crédit", () => {
    const widths = [24, 14, 34, 16, 10, 10, 8];
    const render = (rows: string[][]) =>
      rows
        .map((row) => row.map((cell, index) => cell.padEnd(widths[index] ?? 8, " ")).join("").trimEnd())
        .join("\n");
    const result = parseStatementText(
      render([
        ["Titre", "Date", "Libellé", "Valeur Unitaire", "Débit", "Crédit", "Solde"],
        ["SONATEL", "", "", "", "", "", "16"],
        ["", "01/01/2026", "Acquisition", "1 000.000", "", "10", "10"],
        ["", "02/01/2026", "Attribution gratuite", "", "", "10", "20"],
        ["", "03/01/2026", "Transfert sortant", "1 500.000", "4", "", "16"],
      ]),
      catalog
    );
    expect(byTicker(result, "SNTS")).toMatchObject({
      quantity: 16,
      avgBuyPrice: 500,
      tradeDate: "2026-01-01",
      match: { confidence: "haute" },
    });
  });
});

describe("consolidation avant écriture", () => {
  it("pondère le PRU quand le relevé répète une société", () => {
    expect(
      consolidateImportRows([
        { companyId: "a", quantity: 10, avgBuyPrice: 100 },
        { companyId: "a", quantity: 10, avgBuyPrice: 300 },
        { companyId: "b", quantity: 2, avgBuyPrice: 50 },
      ])
    ).toEqual([
      { companyId: "a", quantity: 20, avgBuyPrice: 200 },
      { companyId: "b", quantity: 2, avgBuyPrice: 50 },
    ]);
  });

  it("conserve la date du premier achat", () => {
    expect(
      consolidateImportRows([
        { companyId: "a", quantity: 10, avgBuyPrice: 100, buyDate: "2026-03-01" },
        { companyId: "a", quantity: 5, avgBuyPrice: 200, buyDate: "2026-01-10" },
      ])
    ).toEqual([{ companyId: "a", quantity: 15, avgBuyPrice: 133.33, buyDate: "2026-01-10" }]);
  });

  it("pondère le PRU d’une obligation et d’un FCP homonymes", () => {
    expect(
      consolidateOtherRows([
        { kind: "OBLIGATION", name: "OBL ETAT CI 6,25% 2028", quantity: 10, avgBuyPrice: 10000, buyDate: "2026-03-01", couponRate: 6.25 },
        { kind: "OBLIGATION", name: "OBL ETAT CI 6,25% 2028", quantity: 10, avgBuyPrice: 12000, buyDate: "2026-01-10" },
        { kind: "FCP", name: "FCP Horizon UEMOA", quantity: 4, avgBuyPrice: 5000, priceMode: "PERCENT" },
      ])
    ).toEqual([
      {
        kind: "OBLIGATION",
        name: "OBL ETAT CI 6,25% 2028",
        isin: null,
        code: null,
        manager: null,
        quantity: 20,
        avgBuyPrice: 11000,
        priceMode: "FCFA",
        nominal: null,
        couponRate: 6.25,
        maturityDate: null,
        buyDate: "2026-01-10",
        latestValue: null,
      },
      {
        kind: "FCP",
        name: "FCP Horizon UEMOA",
        isin: null,
        code: null,
        manager: null,
        quantity: 4,
        avgBuyPrice: 5000,
        priceMode: "FCFA",
        nominal: null,
        couponRate: null,
        maturityDate: null,
        buyDate: null,
        latestValue: null,
      },
    ]);
  });

  it("rédige une note de mouvement sans reprendre le fichier", () => {
    expect(buildStatementTradeNote("SGI-CI", "2026-09-30")).toBe("Import relevé SGI · SGI-CI · arrêté au 30/09/2026");
  });
});
