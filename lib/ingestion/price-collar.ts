// Garde-fou séance BRVM : collier typique ±7,5 % entre deux clôtures proches.
// On ne invente pas de cours : la ligne brute reste upsertée, le canonique
// (et donc l'affichage) est refusé si le mouvement est absurde.

import type { DataSourceCode, RawPriceQuote } from "./types";
import type { ReconciledPrice } from "./reconciliation";

/** Collier officiel BRVM (variation max usuelle d'une séance). */
export const BRVM_SESSION_COLLAR_PERCENT = 7.5;

/** Jours calendaires max pour considérer deux points comme « séance suivante ». */
export const COLLAR_MAX_GAP_DAYS = 7;

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function envFlag(name: string): boolean {
  const raw = process.env[name];
  if (!raw) return false;
  return raw === "1" || raw.toLowerCase() === "true";
}

export function getCollarConfig(): {
  enabled: boolean;
  collarPercent: number;
  slackPercent: number;
  maxGapDays: number;
  overrideTickers: Set<string>;
} {
  const override = new Set(
    (process.env.PRICE_COLLAR_OVERRIDE_TICKERS ?? "")
      .split(/[,;\s]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)
  );
  return {
    enabled: !envFlag("PRICE_COLLAR_DISABLED"),
    collarPercent: envNumber("BRVM_PRICE_COLLAR_PERCENT", BRVM_SESSION_COLLAR_PERCENT),
    slackPercent: envNumber("BRVM_PRICE_COLLAR_SLACK_PERCENT", 0.5),
    maxGapDays: envNumber("PRICE_COLLAR_MAX_GAP_DAYS", COLLAR_MAX_GAP_DAYS),
    overrideTickers: override,
  };
}

export function calendarGapDays(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso.slice(0, 10)}T00:00:00.000Z`);
  const b = Date.parse(`${toIso.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.round(Math.abs(b - a) / 86_400_000);
}

export function movePercent(prev: number, next: number): number | null {
  if (!(prev > 0) || !Number.isFinite(next)) return null;
  return ((next - prev) / prev) * 100;
}

export interface CollarPreviousClose {
  date: string;
  closePrice: number;
}

export interface CollarReject {
  ticker: string;
  date: string;
  closePrice: number;
  previousDate: string;
  previousClose: number;
  deltaPercent: number;
  resolvedSource: DataSourceCode;
}

export interface CollarFilterResult {
  accepted: ReconciledPrice[];
  rejected: CollarReject[];
}

function publishedChangeWithinCollar(
  quotes: RawPriceQuote[] | undefined,
  ticker: string,
  date: string,
  source: DataSourceCode,
  limit: number
): boolean {
  if (!quotes) return false;
  const hit = quotes.find((q) => q.ticker === ticker && q.date === date && q.source === source);
  if (hit?.changePercent == null || !Number.isFinite(hit.changePercent)) return false;
  return Math.abs(hit.changePercent) <= limit;
}

/**
 * Filtre les lignes à marquer canoniques. Les écarts > collier (avec marge)
 * sont rejetés sauf override ticker / quote / variation officielle dans la bande.
 */
export function filterCanonicalByCollar(
  incoming: ReconciledPrice[],
  opts: {
    previous?: CollarPreviousClose | null;
    previousByTicker?: Map<string, CollarPreviousClose>;
    rawQuotes?: RawPriceQuote[];
    config?: ReturnType<typeof getCollarConfig>;
  } = {}
): CollarFilterResult {
  const config = opts.config ?? getCollarConfig();
  const limit = config.collarPercent + config.slackPercent;
  const accepted: ReconciledPrice[] = [];
  const rejected: CollarReject[] = [];

  if (!config.enabled) {
    return { accepted: incoming, rejected };
  }

  const sorted = [...incoming].sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker));
  const lastByTicker = new Map<string, CollarPreviousClose>();
  if (opts.previousByTicker) {
    for (const [k, v] of opts.previousByTicker) lastByTicker.set(k.toUpperCase(), v);
  } else if (opts.previous && incoming[0]) {
    lastByTicker.set(incoming[0].ticker.toUpperCase(), opts.previous);
  }

  for (const row of sorted) {
    const ticker = row.ticker.toUpperCase();
    if (config.overrideTickers.has(ticker)) {
      accepted.push(row);
      lastByTicker.set(ticker, { date: row.date, closePrice: row.closePrice });
      continue;
    }
    const rawOverride = opts.rawQuotes?.some(
      (q) => q.ticker.toUpperCase() === ticker && q.date === row.date && q.collarOverride === true
    );
    if (rawOverride) {
      accepted.push(row);
      lastByTicker.set(ticker, { date: row.date, closePrice: row.closePrice });
      continue;
    }

    const prev = lastByTicker.get(ticker);
    if (!prev) {
      accepted.push(row);
      lastByTicker.set(ticker, { date: row.date, closePrice: row.closePrice });
      continue;
    }

    const gap = calendarGapDays(prev.date, row.date);
    if (gap > config.maxGapDays || gap === 0) {
      accepted.push(row);
      lastByTicker.set(ticker, { date: row.date, closePrice: row.closePrice });
      continue;
    }

    if (publishedChangeWithinCollar(opts.rawQuotes, row.ticker, row.date, row.resolvedSource, limit)) {
      accepted.push(row);
      lastByTicker.set(ticker, { date: row.date, closePrice: row.closePrice });
      continue;
    }

    const pct = movePercent(prev.closePrice, row.closePrice);
    if (pct == null || Math.abs(pct) <= limit) {
      accepted.push(row);
      lastByTicker.set(ticker, { date: row.date, closePrice: row.closePrice });
      continue;
    }

    rejected.push({
      ticker: row.ticker,
      date: row.date,
      closePrice: row.closePrice,
      previousDate: prev.date,
      previousClose: prev.closePrice,
      deltaPercent: Math.round(pct * 100) / 100,
      resolvedSource: row.resolvedSource,
    });
    // Ne pas avancer la référence : un spike ne « valide » pas le lendemain.
  }

  return { accepted, rejected };
}
