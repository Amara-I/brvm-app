import * as XLSX from "xlsx";
import { StatementImportError, STATEMENT_MAX_BYTES } from "./messages";
import { parseStatementMatrix } from "./parse-matrix";
import { parseStatementText } from "./parse-statement";
import type { SecurityCatalogEntry, StatementParseResult } from "./types";

export type StatementUpload = {
  filename: string;
  mime: string;
  bytes: Uint8Array;
};

type Kind = "pdf" | "csv" | "xlsx";

function extensionOf(filename: string): string {
  const base = filename.toLowerCase().split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot) : "";
}

function startsWith(bytes: Uint8Array, ascii: string): boolean {
  if (bytes.length < ascii.length) return false;
  return Buffer.from(bytes.subarray(0, ascii.length)).toString("latin1") === ascii;
}

function detectKind(file: StatementUpload): Kind {
  const ext = extensionOf(file.filename);
  const mime = (file.mime || "").toLowerCase();
  const pdfMagic = startsWith(file.bytes, "%PDF-");
  const zipMagic = startsWith(file.bytes, "PK");

  if (ext === ".pdf" || mime === "application/pdf") {
    if (!pdfMagic) throw new StatementImportError("INVALID_PDF");
    return "pdf";
  }
  if (pdfMagic) return "pdf";
  if (ext === ".xlsx" || ext === ".xls" || mime.includes("spreadsheet") || mime.includes("excel")) return "xlsx";
  if (zipMagic && ext !== ".csv") return "xlsx";
  if (ext === ".csv" || mime.includes("csv")) return "csv";
  throw new StatementImportError("UNSUPPORTED");
}

function decodeCsv(bytes: Uint8Array): string {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/^\uFEFF/, "");
  return text;
}

function detectDelimiter(headerLine: string): "," | ";" | "\t" {
  const counts = [
    { delim: ";" as const, count: headerLine.split(";").length },
    { delim: "," as const, count: headerLine.split(",").length },
    { delim: "\t" as const, count: headerLine.split("\t").length },
  ];
  counts.sort((a, b) => b.count - a.count);
  return counts[0]!.count > 1 ? counts[0]!.delim : ";";
}

export function parseCsvMatrix(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  const delim = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === delim) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (char !== "\r") cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  return rows;
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${d}/${m}/${y}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function readXlsxMatrix(bytes: Uint8Array): string[][] {
  const workbook = XLSX.read(Buffer.from(bytes), { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" }) as unknown[][];
  return matrix.map((row) => (Array.isArray(row) ? row : []).map((cell) => cellToString(cell)));
}

/**
 * Parse un relevé en mémoire. Ne journalise pas le contenu du fichier.
 */
export async function parseStatementUpload(
  file: StatementUpload,
  catalog: readonly SecurityCatalogEntry[]
): Promise<StatementParseResult> {
  if (file.bytes.byteLength <= 0) throw new StatementImportError("EMPTY");
  if (file.bytes.byteLength > STATEMENT_MAX_BYTES) throw new StatementImportError("TOO_LARGE");

  const kind = detectKind(file);
  if (kind === "pdf") {
    const { extractPdfText } = await import("./extract-pdf");
    const extracted = await extractPdfText(file.bytes);
    return parseStatementText(extracted.text, catalog);
  }

  const matrix = kind === "csv" ? parseCsvMatrix(decodeCsv(file.bytes)) : readXlsxMatrix(file.bytes);
  const fromMatrix = parseStatementMatrix(matrix, catalog);
  if (fromMatrix) return fromMatrix;

  const text = matrix.map((row) => row.filter(Boolean).join("   ")).join("\n");
  return parseStatementText(text, catalog);
}
