// PDF « DAILY SUMMARY » : prix par raison sociale, sans ticker.
// Sert de repli quand la liste officielle (qui porte le symbole) manque.

import { NGX_SECTORS, normalizeLegalName } from "./names";

export interface DailySummaryRow {
  name: string;
  close: number;
  changePercent: number | null;
  trades: number | null;
  volume: number | null;
  sector: string | null;
  board: string | null;
}

const SECTOR_SET = new Set<string>(NGX_SECTORS);

function boardFromLine(line: string): string | null {
  const upper = line.toUpperCase();
  if (upper.includes("PREMIUM BOARD")) return "Premium Board";
  if (upper.includes("GROWTH BOARD")) return "Growth Board";
  if (upper.includes("MAIN BOARD")) return "Main Board";
  if (upper.includes("REIT")) return "REIT";
  if (upper.includes("NON-INTEREST") || upper.includes("NON INTEREST")) return "NON-INTEREST FINANCE BOARD";
  return null;
}

function parseNumber(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

const ROW_RE =
  /^(\d+)\s+(.+?)\s+([\d,]+\.\d+)\s+([\d,]+(?:\.\d+)?)\s+(-|[+-]?\d[\d,.]*)\s+([\d,]+)\s+([\d,]+)\s*$/;

export function parseDailySummaryText(text: string): DailySummaryRow[] {
  let sector: string | null = null;
  let board: string | null = null;
  const rows: DailySummaryRow[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const upper = line.toUpperCase();
    if (SECTOR_SET.has(upper)) {
      sector = upper;
      continue;
    }
    const boardHit = boardFromLine(line);
    if (boardHit && !/^\d+\s/.test(line)) {
      board = boardHit;
      continue;
    }
    const match = line.match(ROW_RE);
    if (!match) continue;
    const close = parseNumber(match[4]!);
    if (close == null || !(close > 0)) continue;
    const change = match[5] === "-" ? null : parseNumber(match[5]!);
    const trades = parseNumber(match[6]!);
    const volume = parseNumber(match[7]!);
    rows.push({
      name: match[2]!.replace(/\s+/g, " ").trim(),
      close,
      changePercent: change,
      trades: trades != null ? Math.round(trades) : null,
      volume: volume != null ? Math.round(volume) : null,
      sector,
      board,
    });
  }
  return rows;
}

export interface NamedListing {
  ticker: string;
  name: string;
}

/** Apparie le résumé (nom légal) au référentiel déjà connu. Ambigu → ignoré. */
export function matchSummaryToListings(
  rows: DailySummaryRow[],
  listings: NamedListing[]
): Array<DailySummaryRow & { ticker: string }> {
  const byName = new Map<string, string[]>();
  for (const listing of listings) {
    const key = normalizeLegalName(listing.name);
    if (!key) continue;
    const list = byName.get(key) ?? [];
    list.push(listing.ticker.toUpperCase());
    byName.set(key, list);
  }
  const matched: Array<DailySummaryRow & { ticker: string }> = [];
  for (const row of rows) {
    const tickers = byName.get(normalizeLegalName(row.name));
    if (!tickers || tickers.length !== 1) continue;
    matched.push({ ...row, ticker: tickers[0]! });
  }
  return matched;
}
