/**
 * Export / import Excel du portefeuille (positions).
 *
 * Format stable (feuille « Positions ») pour un aller-retour exact :
 *   Ticker | Société | Quantité | PRU (FCFA) | Date d'achat | Horizon | Notes
 *
 * Les dates sont exportées en TEXTE JJ/MM/AAAA (pas de sérial Excel) pour
 * éviter les décalages de fuseau à la réouverture / réimport.
 */

import * as XLSX from "xlsx";
import type { BuyHorizonCode } from "@/lib/calc/portfolio-advice";

export const PORTFOLIO_EXCEL_SHEET = "Positions";

export const PORTFOLIO_EXCEL_HEADERS = [
  "Ticker",
  "Société",
  "Quantité",
  "PRU (FCFA)",
  "Date d'achat",
  "Horizon",
  "Notes",
] as const;

export type PortfolioExcelExportRow = {
  ticker: string;
  name: string;
  quantity: number;
  avgBuyPrice: number;
  /** YYYY-MM-DD ou null. */
  buyDate: string | null;
  buyHorizon: BuyHorizonCode;
  notes: string | null;
};

export type PortfolioExcelTradeExportRow = {
  tradedAt: string;
  side: "ACHAT" | "VENTE";
  ticker: string;
  name: string;
  quantity: number;
  price: number;
  costBasis: number | null;
  realizedPnl: number | null;
  notes: string | null;
};

export type PortfolioExcelImportRow = {
  ticker: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate: string | null;
  buyHorizon: BuyHorizonCode;
  notes: string | null;
};

export type PortfolioExcelParseResult = {
  rows: PortfolioExcelImportRow[];
  errors: string[];
};

const MAX_ROWS = 200;
const HORIZON_MAP: Record<string, BuyHorizonCode> = {
  COURT: "COURT",
  COURT_TERME: "COURT",
  "COURT TERME": "COURT",
  SHORT: "COURT",
  MOYEN: "MOYEN",
  "MOYEN TERME": "MOYEN",
  MEDIUM: "MOYEN",
  LONG: "LONG",
  "LONG TERME": "LONG",
};

function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const HEADER_ALIASES: Record<string, (typeof PORTFOLIO_EXCEL_HEADERS)[number]> = {
  ticker: "Ticker",
  symbole: "Ticker",
  code: "Ticker",
  societe: "Société",
  nom: "Société",
  name: "Société",
  quantite: "Quantité",
  qty: "Quantité",
  quantity: "Quantité",
  "pru (fcfa)": "PRU (FCFA)",
  pru: "PRU (FCFA)",
  "prix moyen": "PRU (FCFA)",
  "prix d'achat": "PRU (FCFA)",
  "avg buy price": "PRU (FCFA)",
  "date d'achat": "Date d'achat",
  "date achat": "Date d'achat",
  buydate: "Date d'achat",
  horizon: "Horizon",
  notes: "Notes",
  commentaire: "Notes",
};

/** Date calendaire UTC (champs Prisma @db.Date). */
export function formatUtcYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Affichage Excel FR sans ambiguïté. */
export function ymdToFr(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function frToYmd(fr: string): string | null {
  const m = fr.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return null;
  const dd = m[1]!.padStart(2, "0");
  const mm = m[2]!.padStart(2, "0");
  const yyyy = m[3]!;
  const dt = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) return null;
  if (formatUtcYmd(dt) !== `${yyyy}-${mm}-${dd}`) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function cellStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function parseNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = cellStr(v)
    .replace(/\s/g, "")
    .replace(/\u00a0/g, "")
    .replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Accepte JJ/MM/AAAA, YYYY-MM-DD, Date JS (composantes locales — Excel),
 * ou numéro de série Excel.
 */
export function parsePortfolioBuyDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    // SheetJS / Excel → minuit local ; utiliser les composantes locales.
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const parsed = XLSX.SSF?.parse_date_code?.(raw);
    if (parsed) {
      const mm = String(parsed.m).padStart(2, "0");
      const dd = String(parsed.d).padStart(2, "0");
      return `${parsed.y}-${mm}-${dd}`;
    }
  }
  const s = cellStr(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const fr = frToYmd(s);
  if (fr) return fr;
  return null;
}

export function parseHorizon(raw: unknown): BuyHorizonCode {
  const key = cellStr(raw)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!key) return "MOYEN";
  return HORIZON_MAP[key] ?? "MOYEN";
}

function setStringCell(ws: XLSX.WorkSheet, addr: string, value: string) {
  ws[addr] = { t: "s", v: value };
}

export function buildPortfolioWorkbook(
  portfolioName: string,
  rows: PortfolioExcelExportRow[],
  trades: PortfolioExcelTradeExportRow[] = []
): Buffer {
  const wb = XLSX.utils.book_new();
  const aoa: (string | number)[][] = [[...PORTFOLIO_EXCEL_HEADERS]];
  for (const r of rows) {
    aoa.push([
      r.ticker,
      r.name,
      r.quantity,
      r.avgBuyPrice,
      "", // date forcée en texte ci-dessous
      r.buyHorizon,
      r.notes ?? "",
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Forcer les dates en texte JJ/MM/AAAA (évite conversion Excel / fuseau).
  rows.forEach((r, i) => {
    const addr = XLSX.utils.encode_cell({ r: i + 1, c: 4 });
    setStringCell(ws, addr, r.buyDate ? ymdToFr(r.buyDate) : "");
  });
  ws["!cols"] = [
    { wch: 10 },
    { wch: 28 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, PORTFOLIO_EXCEL_SHEET);

  if (trades.length > 0) {
    const tradeAoa: (string | number)[][] = [
      [
        "Date",
        "Sens",
        "Ticker",
        "Société",
        "Quantité",
        "Prix (FCFA)",
        "PRU (vente)",
        "P&L réalisé",
        "Notes",
      ],
      ...trades.map((t) => [
        t.tradedAt ? ymdToFr(t.tradedAt) : "",
        t.side,
        t.ticker,
        t.name,
        t.quantity,
        t.price,
        t.costBasis ?? "",
        t.realizedPnl ?? "",
        t.notes ?? "",
      ]),
    ];
    const tws = XLSX.utils.aoa_to_sheet(tradeAoa);
    trades.forEach((t, i) => {
      const addr = XLSX.utils.encode_cell({ r: i + 1, c: 0 });
      setStringCell(tws, addr, t.tradedAt ? ymdToFr(t.tradedAt) : "");
    });
    XLSX.utils.book_append_sheet(wb, tws, "Mouvements");
  }

  const meta = XLSX.utils.aoa_to_sheet([
    ["Portefeuille", portfolioName],
    ["Exporté le", ymdToFr(formatUtcYmd(new Date()))],
    ["Format", "OuestBourse Positions v2"],
    [
      "Import",
      "Feuille Positions : dates en JJ/MM/AAAA (texte). Société ignorée (lookup Ticker). Mode remplacer = reconstitution exacte.",
    ],
  ]);
  XLSX.utils.book_append_sheet(wb, meta, "Info");

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function buildPortfolioExportFileName(portfolioName: string, when = new Date()): string {
  const safe =
    portfolioName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || "Portefeuille";
  const d = formatUtcYmd(when);
  return `OuestBourse_${safe}_${d}.xlsx`;
}

/**
 * Parse un Buffer .xlsx / .xls au format Positions.
 * Retourne les lignes valides + erreurs non bloquantes par ligne.
 */
export function parsePortfolioExcelBuffer(buffer: Buffer): PortfolioExcelParseResult {
  const errors: string[] = [];
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer", cellDates: true, dense: false });
  } catch {
    return { rows: [], errors: ["Fichier Excel illisible ou corrompu."] };
  }

  const sheetName =
    wb.SheetNames.find((n) => normalizeHeader(n) === "positions") ?? wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: ["Aucune feuille trouvée dans le fichier."] };

  const sheet = wb.Sheets[sheetName];
  if (!sheet) return { rows: [], errors: ["Feuille Positions introuvable."] };

  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });
  if (matrix.length < 2) {
    return { rows: [], errors: ["Le fichier ne contient aucune ligne de position."] };
  }

  const headerRow = matrix[0] ?? [];
  const colIndex = new Map<(typeof PORTFOLIO_EXCEL_HEADERS)[number], number>();
  headerRow.forEach((cell, i) => {
    const alias = HEADER_ALIASES[normalizeHeader(cell)];
    if (alias && !colIndex.has(alias)) colIndex.set(alias, i);
  });

  if (!colIndex.has("Ticker") || !colIndex.has("Quantité") || !colIndex.has("PRU (FCFA)")) {
    return {
      rows: [],
      errors: [
        "En-têtes requis manquants : Ticker, Quantité, PRU (FCFA). Exportez d'abord un modèle depuis OuestBourse.",
      ],
    };
  }

  const dataRows = matrix.slice(1, 1 + MAX_ROWS);
  if (matrix.length - 1 > MAX_ROWS) {
    errors.push(`Seules les ${MAX_ROWS} premières lignes ont été lues.`);
  }

  const rows: PortfolioExcelImportRow[] = [];
  const seen = new Set<string>();

  dataRows.forEach((line, idx) => {
    const lineNo = idx + 2;
    if (!line || line.every((c) => c == null || cellStr(c) === "")) return;

    const ticker = cellStr(line[colIndex.get("Ticker")!]).toUpperCase();
    const quantity = parseNumber(line[colIndex.get("Quantité")!]);
    const avgBuyPrice = parseNumber(line[colIndex.get("PRU (FCFA)")!]);
    const buyDateRaw = colIndex.has("Date d'achat")
      ? line[colIndex.get("Date d'achat")!]
      : null;
    const horizonRaw = colIndex.has("Horizon") ? line[colIndex.get("Horizon")!] : null;
    const notesRaw = colIndex.has("Notes") ? line[colIndex.get("Notes")!] : null;

    if (!ticker) {
      errors.push(`Ligne ${lineNo} : ticker manquant.`);
      return;
    }
    if (quantity == null || !(quantity > 0)) {
      errors.push(`Ligne ${lineNo} (${ticker}) : quantité invalide.`);
      return;
    }
    if (avgBuyPrice == null || !(avgBuyPrice > 0)) {
      errors.push(`Ligne ${lineNo} (${ticker}) : PRU invalide.`);
      return;
    }
    if (seen.has(ticker)) {
      errors.push(`Ligne ${lineNo} (${ticker}) : ticker en double — ligne ignorée.`);
      return;
    }
    seen.add(ticker);

    let buyDate: string | null = null;
    if (buyDateRaw != null && cellStr(buyDateRaw) !== "") {
      buyDate = parsePortfolioBuyDate(buyDateRaw);
      if (!buyDate) {
        errors.push(`Ligne ${lineNo} (${ticker}) : date d'achat invalide — ignorée.`);
      }
    }

    const notes = notesRaw != null ? cellStr(notesRaw).slice(0, 500) || null : null;

    rows.push({
      ticker,
      quantity,
      avgBuyPrice,
      buyDate,
      buyHorizon: parseHorizon(horizonRaw),
      notes,
    });
  });

  return { rows, errors };
}
