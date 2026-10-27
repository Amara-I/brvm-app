// Texte du PDF « Daily Official List - Equities ».
// La clôture retenue est le deuxième nombre de la ligne (après le nominal) :
// c'est le PRICE du Daily Summary, pas le dernier nombre avant la date.

import { parseNgxDocDate } from "./dates";
import { NGX_SECTORS } from "./names";

export interface OfficialListRow {
  symbol: string;
  name: string;
  close: number;
  volume: number | null;
  tradeDate: string;
  sector: string | null;
  board: string | null;
}

const SECTOR_SET = new Set<string>(NGX_SECTORS);
const STOP = new Set([
  "HOLDING",
  "COMPANY",
  "PLC",
  "BANK",
  "THE",
  "AND",
  "OF",
  "FOR",
  "NIGERIA",
  "TRUST",
  "LIMITED",
  "LTD",
  "GROUP",
  "AFRICA",
  "ENERGY",
  "CEMENT",
  "FOODS",
  "OIL",
  "PALM",
  "INSURANCE",
  "DATE",
  "EPS",
  "QTY",
  "HIGH",
  "LOW",
  "PAID",
  "EX",
  "PAGE",
  "SYMBOL",
  "OFFICIAL",
  "CURRENT",
  "PUBLIC",
  "PRICE",
  "MARKET",
  "BOARD",
  "EQTY",
  "SECURITY",
  "NAME",
  "DIV",
  "BUSINESS",
  "DONE",
  "LAST",
  "PRINT",
  "COPYRIGHT",
  "PUBLISHED",
  "FINANCIAL",
  "HOLDINGS",
  "COMMUNICATIONS",
  "TRANSNATIONAL",
  "INCORPORATED",
  "INTERIM",
  "FINAL",
  "OPEN",
  "CLOSE",
  "QUOTATION",
]);

function boardFromLine(line: string): string | null {
  const upper = line.toUpperCase();
  if (upper.startsWith("EQTY")) return "Main Board";
  if (upper.startsWith("PREMIUM")) return "Premium Board";
  if (upper.startsWith("GROWTH")) return "Growth Board";
  if (upper.startsWith("REIT")) return "REIT";
  if (upper.includes("NON-INTEREST") || upper.includes("NON INTEREST")) return "NON-INTEREST FINANCE BOARD";
  return null;
}

function isNoise(line: string): boolean {
  if (!line) return true;
  if (/^---\s*page/i.test(line)) return true;
  if (/^page \d+/i.test(line)) return true;
  if (/copyright|all rights reserved|published by|print date|daily official list/i.test(line)) return true;
  if (/^symbol\b/i.test(line)) return true;
  if (/public|quotation|official open|market price|business done|dividends/i.test(line) && !/\d/.test(line)) {
    return true;
  }
  return false;
}

function unglueDates(text: string): string {
  return text.replace(/(\d)(\d{2}\/\d{2}\/\d{2,4})/g, "$1 $2");
}

function numericTokens(blob: string): { raw: string; value: number }[] {
  const out: { raw: string; value: number }[] = [];
  for (const token of blob.split(/\s+/)) {
    if (!/^[\d,]+(?:\.\d+)?$/.test(token)) continue;
    const value = Number(token.replace(/,/g, ""));
    if (Number.isFinite(value)) out.push({ raw: token, value });
  }
  return out;
}

function parseRecord(blob: string, symbol: string, sector: string | null, board: string | null): OfficialListRow | null {
  const cleaned = unglueDates(blob.replace(/\s+/g, " ").trim());
  const dateMatch = cleaned.match(/(\d{2}\/\d{2}\/\d{2,4})/);
  if (!dateMatch || dateMatch.index == null) return null;
  const tradeDate = parseNgxDocDate(dateMatch[1]!);
  if (!tradeDate) return null;
  const before = cleaned.slice(0, dateMatch.index);
  const after = cleaned.slice(dateMatch.index + dateMatch[1]!.length);
  const numbers = numericTokens(before);
  if (numbers.length === 0) return null;
  const close = numbers.length >= 2 ? numbers[1]!.value : numbers[0]!.value;
  if (!(close > 0) || close > 10_000_000) return null;
  const volumeToken = numericTokens(after)[0];
  const volume = volumeToken && volumeToken.value >= 0 && volumeToken.value < 1e12 ? Math.round(volumeToken.value) : null;
  const nameParts = before.split(/\s+/).filter((token) => token && !/^[\d,]+(?:\.\d+)?$/.test(token) && token !== "+" && token !== "-");
  const nameBody = nameParts.filter((token) => token.toUpperCase() !== symbol).join(" ").trim();
  return {
    symbol,
    name: nameBody || symbol,
    close,
    volume,
    tradeDate,
    sector,
    board,
  };
}

export function parseOfficialListText(text: string): OfficialListRow[] {
  let sector: string | null = null;
  let board: string | null = null;
  let current: { symbol: string; lines: string[] } | null = null;
  const rows: OfficialListRow[] = [];

  const flush = () => {
    if (!current) return;
    const row = parseRecord(current.lines.join(" "), current.symbol, sector, board);
    if (row) rows.push(row);
    current = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (isNoise(line)) continue;
    const sectorHit = SECTOR_SET.has(line.toUpperCase()) ? line.toUpperCase() : null;
    const boardHit = boardFromLine(line);
    if (sectorHit || boardHit) {
      flush();
      if (sectorHit) sector = sectorHit;
      if (boardHit) board = boardHit;
      continue;
    }
    const symbolMatch = line.match(/^([A-Z][A-Z0-9.]{1,15})\b\s*(.*)$/);
    const token = symbolMatch?.[1] ?? "";
    const currentHasPrice = current?.lines.some((part) => /\d/.test(part)) ?? false;
    // Une suite de raison sociale (« PROCESSORS PLC ») n'a pas de chiffre et
    // arrive avant le prix. Le symbole suivant n'arrive qu'une fois le prix vu.
    const startsSecurity =
      Boolean(symbolMatch) && token.length >= 2 && !STOP.has(token) && (/\d/.test(line) || currentHasPrice || !current);
    if (startsSecurity && symbolMatch) {
      flush();
      current = { symbol: token, lines: [line] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();

  const bySymbol = new Map<string, OfficialListRow>();
  for (const row of rows) bySymbol.set(row.symbol, row);
  return [...bySymbol.values()];
}
