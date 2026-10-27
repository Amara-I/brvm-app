// Texte du PDF « Daily Official List - Equities ».
// La clôture retenue est le deuxième nombre de la ligne (après le nominal) :
// c'est le PRICE du Daily Summary, pas le dernier nombre avant la date.

import { parseNgxDocDate } from "./dates";
import { NGX_SECTORS } from "./names";
import type { NgxPdfItem } from "./pdf-text";

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
  const dates = [...cleaned.matchAll(/(\d{2}\/\d{2}\/\d{2,4})/g)];
  const dateMatch = dates[dates.length - 1];
  if (!dateMatch || dateMatch.index == null) return null;
  // La date de séance est la dernière : les dates de dividende précèdent,
  // et l'extraction PDF place souvent la séance seule sur la ligne suivante.
  const tradeDate = parseNgxDocDate(dateMatch[1]!);
  if (!tradeDate) return null;
  const firstDateAt = dates[0]?.index ?? dateMatch.index;
  const before = cleaned.slice(0, firstDateAt);
  const after = cleaned.slice(dateMatch.index + dateMatch[1]!.length);
  const numbers = numericTokens(before);
  if (numbers.length === 0) return null;
  const close = numbers.length >= 2 ? numbers[1]!.value : numbers[0]!.value;
  if (!(close > 0) || close > 10_000_000) return null;
  const volumeToken = numericTokens(after)[0];
  const volume = volumeToken && volumeToken.value >= 0 && volumeToken.value < 1e12 ? Math.round(volumeToken.value) : null;
  const nameParts = before.split(/\s+/).filter((token) => {
    if (!token || token === "+" || token === "-") return false;
    if (token.toUpperCase() === symbol) return false;
    if (/^[\d.,]+$/.test(token)) return false;
    return /[A-Za-z]/.test(token);
  });
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

const SYMBOL_X_MIN = 32;
const SYMBOL_X_MAX = 50;
const NAME_X_MIN = 80;
const NAME_X_MAX = 190;
const CLOSE_X_MIN = 360;
const CLOSE_X_MAX = 450;
const DATE_X_MIN = 520;
const DATE_X_MAX = 575;
const QTY_X_MIN = 575;
const QTY_X_MAX = 640;

function firstNumber(raw: string): number | null {
  const token = raw.trim().split(/\s+/)[0] ?? "";
  if (!/^[\d,]+(?:\.\d+)?$/.test(token)) return null;
  const value = Number(token.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function isSymbolItem(item: NgxPdfItem): boolean {
  const text = item.str.trim();
  return (
    item.x >= SYMBOL_X_MIN &&
    item.x <= SYMBOL_X_MAX &&
    /^[A-Z][A-Z0-9.]{1,15}$/.test(text) &&
    !STOP.has(text) &&
    !SECTOR_SET.has(text)
  );
}

/** Colonnes du PDF réel : le prix de marché (~x 390) et la date de séance (~x 535). */
export function parseOfficialListItems(pages: NgxPdfItem[][]): OfficialListRow[] {
  const rows: OfficialListRow[] = [];
  let sector: string | null = null;
  let board: string | null = null;

  for (const page of pages) {
    const events: { y: number; x: number; kind: "sector" | "board" | "symbol"; text: string }[] = [];
    for (const item of page) {
      const text = item.str.replace(/\s+/g, " ").trim();
      if (!text) continue;
      if (SECTOR_SET.has(text.toUpperCase())) {
        events.push({ y: item.y, x: item.x, kind: "sector", text: text.toUpperCase() });
        continue;
      }
      const boardHit = boardFromLine(text);
      if (boardHit) {
        events.push({ y: item.y, x: item.x, kind: "board", text: boardHit });
        continue;
      }
      if (isSymbolItem(item)) events.push({ y: item.y, x: item.x, kind: "symbol", text });
    }
    events.sort((a, b) => b.y - a.y || a.x - b.x);
    const symbolYs = events.filter((event) => event.kind === "symbol").map((event) => event.y);

    for (const event of events) {
      if (event.kind === "sector") {
        sector = event.text;
        continue;
      }
      if (event.kind === "board") {
        board = event.text;
        continue;
      }
      const nextY = symbolYs.find((y) => y < event.y - 0.5) ?? Number.NEGATIVE_INFINITY;
      const sameRow = (item: NgxPdfItem) => Math.abs(item.y - event.y) <= 2.5;
      const close = page
        .map((item) => ({ item, value: firstNumber(item.str) }))
        .filter(
          (hit) =>
            hit.value != null &&
            hit.value > 0 &&
            hit.value < 10_000_000 &&
            sameRow(hit.item) &&
            hit.item.x >= CLOSE_X_MIN &&
            hit.item.x <= CLOSE_X_MAX
        )
        .sort((a, b) => Math.abs(a.item.x - 400) - Math.abs(b.item.x - 400))[0];
      if (!close?.value) continue;
      const dateItem = page.find(
        (item) => sameRow(item) && item.x >= DATE_X_MIN && item.x <= DATE_X_MAX && parseNgxDocDate(item.str.trim())
      );
      const tradeDate = dateItem ? parseNgxDocDate(dateItem.str.trim()) : null;
      if (!tradeDate) continue;
      const volume = page
        .map((item) => (sameRow(item) && item.x >= QTY_X_MIN && item.x <= QTY_X_MAX ? firstNumber(item.str) : null))
        .find((value) => value != null && value >= 0 && value < 1e12);
      const name = page
        .filter((item) => {
          if (item.x < NAME_X_MIN || item.x > NAME_X_MAX) return false;
          const between = item.y < event.y - 1 && item.y > nextY + 1;
          return (sameRow(item) || between) && /[A-Za-z]/.test(item.str);
        })
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .map((item) => item.str.replace(/\s+/g, " ").trim())
        .filter((token) => token && !/^[\d.,]+$/.test(token) && !SECTOR_SET.has(token.toUpperCase()))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      rows.push({
        symbol: event.text,
        name: name || event.text,
        close: close.value,
        volume: volume == null ? null : Math.round(volume),
        tradeDate,
        sector,
        board,
      });
    }
  }

  const bySymbol = new Map<string, OfficialListRow>();
  for (const row of rows) bySymbol.set(row.symbol, row);
  return [...bySymbol.values()];
}
