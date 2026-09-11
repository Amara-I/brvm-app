// Helpers purs pour densifier l'historique (GetHistos annuel → mensuel →
// journalier chunké). Aucun I/O : testables sans base ni réseau.
//
// Règle : on upsert TOUTES les cotations brutes (audit), mais on ne marque
// canonique que si aucune source plus prioritaire n'existe déjà à cette date
// (BRVM_OFFICIEL > SIKAFINANCE > OUESTBOURSE > RICHBOURSE > MANUEL).

import { sourceOutranks } from "./reconciliation";
import type { ReconciledPrice } from "./reconciliation";
import type { DataSourceCode, RawPriceQuote } from "./types";

/** Fenêtre max journalière GetHistos avant erreur API `toolong`. */
export const DEFAULT_DAILY_CHUNK_DAYS = 89;

/**
 * Nombre min de clôtures déjà en base dans une fenêtre ~89 j pour considérer
 * le chunk « assez dense » et éviter de re-frapper l'API (≈ 60 séances max ;
 * 35 = couverture réelle, pas seulement 1 point annuel au 31/12).
 */
export const DEFAULT_MIN_DAILY_POINTS_PER_CHUNK = 35;

export const DEFAULT_ANNUAL_FROM_YEAR = 1998;

export interface IsoRange {
  from: string;
  to: string;
}

export interface ExistingPriceRef {
  date: string; // YYYY-MM-DD
  source: DataSourceCode;
  closePrice: number;
}

export function iterateDailyChunks(
  fromIso: string,
  toIso: string,
  chunkDays = DEFAULT_DAILY_CHUNK_DAYS
): IsoRange[] {
  const start = new Date(`${fromIso}T00:00:00.000Z`);
  const end = new Date(`${toIso}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }
  const out: IsoRange[] = [];
  let cursor = start;
  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + chunkDays);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    out.push({
      from: cursor.toISOString().slice(0, 10),
      to: chunkEnd.toISOString().slice(0, 10),
    });
    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function countDatesInRange(dates: Iterable<string>, from: string, to: string): number {
  let n = 0;
  for (const d of dates) {
    if (d >= from && d <= to) n++;
  }
  return n;
}

export function calendarDaysInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Seuil de densité adapté à la longueur réelle de la fenêtre (dernier chunk court). */
export function minDailyPointsForChunk(
  from: string,
  to: string,
  defaultMin = DEFAULT_MIN_DAILY_POINTS_PER_CHUNK
): number {
  const days = calendarDaysInclusive(from, to);
  const approxTrading = Math.floor((days * 5) / 7);
  return Math.min(defaultMin, Math.max(1, approxTrading - 4));
}

/**
 * Retourne les fenêtres encore trop clairsemées (à re-fetcher en journalier).
 * `existingDates` = dates déjà couvertes par une source utilisable (BRVM ou Sika).
 */
export function chunksNeedingFetch(
  chunks: IsoRange[],
  existingDates: Set<string>,
  minPoints = DEFAULT_MIN_DAILY_POINTS_PER_CHUNK
): IsoRange[] {
  return chunks.filter((c) => {
    const need = minDailyPointsForChunk(c.from, c.to, minPoints);
    return countDatesInRange(existingDates, c.from, c.to) < need;
  });
}

export function quotesNeedingUpsert(
  incoming: RawPriceQuote[],
  existing: ExistingPriceRef[]
): RawPriceQuote[] {
  const byDateSource = new Map<string, number>();
  for (const e of existing) {
    byDateSource.set(`${e.date}|${e.source}`, e.closePrice);
  }
  const out: RawPriceQuote[] = [];
  for (const q of incoming) {
    const prev = byDateSource.get(`${q.date}|${q.source}`);
    if (prev != null && prev === q.closePrice) continue;
    out.push(q);
  }
  return out;
}

export function quotesEligibleForCanonical(
  incoming: ReconciledPrice[],
  existing: ExistingPriceRef[]
): ReconciledPrice[] {
  const byDate = new Map<string, DataSourceCode[]>();
  for (const e of existing) {
    const arr = byDate.get(e.date) ?? [];
    arr.push(e.source);
    byDate.set(e.date, arr);
  }
  return incoming.filter((r) => {
    const sources = byDate.get(r.date) ?? [];
    return !sources.some((s) => sourceOutranks(s, r.resolvedSource));
  });
}

export function mergeExistingPrices(
  prev: ExistingPriceRef[],
  quotes: RawPriceQuote[]
): ExistingPriceRef[] {
  const map = new Map(prev.map((p) => [`${p.date}|${p.source}`, p] as const));
  for (const q of quotes) {
    map.set(`${q.date}|${q.source}`, {
      date: q.date,
      source: q.source,
      closePrice: q.closePrice,
    });
  }
  return [...map.values()];
}

/** Dates déjà assez « officielles » pour ne pas re-demander du journalier Sika. */
export function coveredDailyDates(existing: ExistingPriceRef[]): Set<string> {
  const s = new Set<string>();
  for (const e of existing) {
    if (e.source === "BRVM_OFFICIEL" || e.source === "SIKAFINANCE") s.add(e.date);
  }
  return s;
}

export function earliestYearFromQuotes(quotes: RawPriceQuote[]): number | null {
  if (quotes.length === 0) return null;
  return Math.min(...quotes.map((q) => Number(q.date.slice(0, 4))));
}

export function earliestIsoFromQuotes(quotes: RawPriceQuote[]): string | null {
  if (quotes.length === 0) return null;
  return [...quotes].map((q) => q.date).sort()[0] ?? null;
}

export function parseIsoDateFlag(raw: string | undefined): string | null {
  if (!raw) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}
