// JSON quotidien non documenté de doclib.ngxgroup.com.
// Un payload trop court, trop vieux, ou sans clôtures positives est rejeté :
// le connecteur bascule alors sur le PDF « Daily Official List ».

import { calendarDaysBetween, isoDate } from "./dates";

export interface NgxEquityQuote {
  symbol: string;
  name: string;
  sector: string | null;
  board: string | null;
  prevClose: number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  changePercent: number | null;
  trades: number | null;
  volume: number | null;
  value: number | null;
  tradeDate: string;
}

export interface EquitiesParseResult {
  ok: boolean;
  reasons: string[];
  rows: NgxEquityQuote[];
  tradeDate: string | null;
}

const SYMBOL_RE = /^[A-Z0-9.]{2,20}$/;
const MIN_ROWS = 80;
const MAX_ROWS = 250;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function field(row: Record<string, unknown>, ...names: string[]): unknown {
  const lowered = new Map(Object.entries(row).map(([key, val]) => [key.toLowerCase(), val]));
  for (const name of names) {
    const hit = lowered.get(name.toLowerCase());
    if (hit !== undefined) return hit;
  }
  return undefined;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function tradeIso(value: unknown): string | null {
  const raw = text(value);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1]! : null;
}

function listFromPayload(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  const record = asRecord(raw);
  if (!record) return null;
  for (const key of ["data", "equities", "items", "value", "result"]) {
    const hit = field(record, key);
    if (Array.isArray(hit)) return hit;
  }
  return null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseEquitiesPayload(raw: unknown, now = new Date()): EquitiesParseResult {
  const reasons: string[] = [];
  const list = listFromPayload(raw);
  if (!list) {
    return { ok: false, reasons: ["payload JSON inattendu (tableau absent)"], rows: [], tradeDate: null };
  }

  const rows: NgxEquityQuote[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const record = asRecord(item);
    if (!record) continue;
    const symbol = text(field(record, "Symbol", "symbol")).toUpperCase();
    if (!SYMBOL_RE.test(symbol) || seen.has(symbol)) continue;
    const close = num(field(record, "ClosePrice", "close", "closePrice"));
    const prev = num(field(record, "PrevClosingPrice", "prevClose", "previousClose"));
    if (close == null || !(close > 0) || prev == null || !(prev > 0)) continue;
    const tradeDate = tradeIso(field(record, "TradeDate", "tradeDate", "date"));
    if (!tradeDate) continue;
    seen.add(symbol);
    const published = num(field(record, "PercChange", "percentChange", "changePercent"));
    const changePercent = published != null ? round2(published) : round2(((close - prev) / prev) * 100);
    rows.push({
      symbol,
      name: text(field(record, "Company2", "company", "name")) || symbol,
      sector: text(field(record, "Sector", "sector")) || null,
      board: text(field(record, "Market", "board")) || null,
      prevClose: prev,
      open: num(field(record, "OpeningPrice", "open")),
      high: num(field(record, "HighPrice", "high")),
      low: num(field(record, "LowPrice", "low")),
      close,
      changePercent,
      trades: num(field(record, "Trades", "trades")),
      volume: num(field(record, "Volume", "volume")),
      value: num(field(record, "Value", "value")),
      tradeDate,
    });
  }

  if (rows.length < MIN_ROWS || rows.length > MAX_ROWS) {
    reasons.push(`effectif ${rows.length} hors bande ${MIN_ROWS}–${MAX_ROWS}`);
  }

  const byDate = new Map<string, number>();
  for (const row of rows) byDate.set(row.tradeDate, (byDate.get(row.tradeDate) ?? 0) + 1);
  const tradeDate = [...byDate.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  if (!tradeDate) {
    reasons.push("aucune date de séance");
  } else {
    const today = isoDate(now);
    const ahead = calendarDaysBetween(today, tradeDate);
    const behind = calendarDaysBetween(tradeDate, today);
    if (ahead > 2) reasons.push(`date de séance ${tradeDate} trop dans le futur`);
    if (behind > 10) reasons.push(`date de séance ${tradeDate} plus vieille que 10 jours`);
  }

  const sameDay = tradeDate ? rows.filter((row) => row.tradeDate === tradeDate) : rows;
  return { ok: reasons.length === 0, reasons, rows: sameDay, tradeDate };
}
