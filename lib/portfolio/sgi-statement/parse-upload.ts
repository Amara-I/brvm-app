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

type Kind = "pdf" | "csv" | "xlsx" | "image" | "heic";

export type StatementTranscribe = (file: StatementUpload) => Promise<{ text: string }>;

export type ParseStatementHooks = {
  /** Remplace vision + OCR (tests). Le texte est ensuite parsé comme un relevé. */
  transcribe?: StatementTranscribe;
};

function extensionOf(filename: string): string {
  const base = filename.toLowerCase().split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot) : "";
}

function startsWith(bytes: Uint8Array, ascii: string): boolean {
  if (bytes.length < ascii.length) return false;
  return Buffer.from(bytes.subarray(0, ascii.length)).toString("latin1") === ascii;
}

function isHeic(file: StatementUpload): boolean {
  const ext = extensionOf(file.filename);
  const mime = (file.mime || "").toLowerCase();
  if (ext === ".heic" || ext === ".heif" || mime.includes("heic") || mime.includes("heif")) return true;
  if (file.bytes.length < 12) return false;
  const box = Buffer.from(file.bytes.subarray(4, 8)).toString("ascii");
  const brand = Buffer.from(file.bytes.subarray(8, 12)).toString("ascii").toLowerCase();
  return box === "ftyp" && /heic|heif|mif1|msf1/.test(brand);
}

function isRasterImage(file: StatementUpload): boolean {
  const ext = extensionOf(file.filename);
  const mime = (file.mime || "").toLowerCase();
  if (ext === ".png" || mime === "image/png") return file.bytes[0] === 0x89 && file.bytes[1] === 0x50;
  if (ext === ".jpg" || ext === ".jpeg" || mime === "image/jpeg" || mime === "image/jpg") {
    return file.bytes[0] === 0xff && file.bytes[1] === 0xd8;
  }
  if (ext === ".webp" || mime === "image/webp") {
    return startsWith(file.bytes, "RIFF") && Buffer.from(file.bytes.subarray(8, 12)).toString("ascii") === "WEBP";
  }
  if (file.bytes[0] === 0x89 && file.bytes[1] === 0x50 && file.bytes[2] === 0x4e && file.bytes[3] === 0x47) return true;
  if (file.bytes[0] === 0xff && file.bytes[1] === 0xd8 && file.bytes[2] === 0xff) return true;
  if (startsWith(file.bytes, "RIFF") && file.bytes.length > 12 && Buffer.from(file.bytes.subarray(8, 12)).toString("ascii") === "WEBP") {
    return true;
  }
  return false;
}

function detectKind(file: StatementUpload): Kind {
  const ext = extensionOf(file.filename);
  const mime = (file.mime || "").toLowerCase();
  const pdfMagic = startsWith(file.bytes, "%PDF-");
  const zipMagic = startsWith(file.bytes, "PK");

  if (isHeic(file)) return "heic";
  if (ext === ".pdf" || mime === "application/pdf") {
    if (!pdfMagic) throw new StatementImportError("INVALID_PDF");
    return "pdf";
  }
  if (pdfMagic) return "pdf";
  if (isRasterImage(file)) return "image";
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

async function readTranscribed(
  file: StatementUpload,
  catalog: readonly SecurityCatalogEntry[],
  hooks?: ParseStatementHooks
): Promise<StatementParseResult> {
  if (hooks?.transcribe) return parseStatementText((await hooks.transcribe(file)).text, catalog);
  const { transcribeStatement } = await import("./transcribe");
  const transcript = await transcribeStatement(file);
  if (transcript.mode === "vision") {
    const { applyVisionDocument } = await import("./templates/vision");
    const applied = applyVisionDocument(transcript.document, catalog);
    if (applied) return applied;
    if (transcript.text.trim()) return parseStatementText(transcript.text, catalog);
    throw new StatementImportError("UNREADABLE");
  }
  return parseStatementText(transcript.text, catalog);
}

/**
 * Parse un relevé en mémoire. Ne journalise pas le contenu du fichier.
 */
export async function parseStatementUpload(
  file: StatementUpload,
  catalog: readonly SecurityCatalogEntry[],
  hooks?: ParseStatementHooks
): Promise<StatementParseResult> {
  if (file.bytes.byteLength <= 0) throw new StatementImportError("EMPTY");
  if (file.bytes.byteLength > STATEMENT_MAX_BYTES) throw new StatementImportError("TOO_LARGE");

  const kind = detectKind(file);
  if (kind === "heic") throw new StatementImportError("HEIC");
  if (kind === "image") {
    return readTranscribed(file, catalog, hooks);
  }
  if (kind === "pdf") {
    const { extractPdfText } = await import("./extract-pdf");
    try {
      const extracted = await extractPdfText(file.bytes);
      return parseStatementText(extracted.text, catalog);
    } catch (error) {
      if (!(error instanceof StatementImportError) || error.code !== "SCANNED_PDF") throw error;
      if (!hooks?.transcribe) {
        const { visionConfigured } = await import("./transcribe");
        if (!visionConfigured()) throw error;
      }
      return readTranscribed(file, catalog, hooks);
    }
  }

  const matrix = kind === "csv" ? parseCsvMatrix(decodeCsv(file.bytes)) : readXlsxMatrix(file.bytes);
  const fromMatrix = parseStatementMatrix(matrix, catalog);
  if (fromMatrix) return fromMatrix;

  const text = matrix.map((row) => row.filter(Boolean).join("   ")).join("\n");
  return parseStatementText(text, catalog);
}
