/**
 * Calendrier des dividendes BRVM — assemblage pur (sans base de données).
 * Une seule ligne par société et exercice ; montants et cours ajustés des opérations sur titres ;
 * rendement = dividende ÷ dernier cours canonique. Une donnée absente reste null (affichée N/D).
 */

import { presentClose, presentDividend } from "@/lib/corporate-actions/present-quotes";
import type { AdjustmentAction } from "@/lib/corporate-actions/types";
import { dataSourceLabel } from "@/lib/api/data-source-label";

export type DividendDatePrecision = "payment" | "ex" | "exercice";

export interface DividendCalendarEvent {
  id: string;
  ticker: string;
  name: string;
  sector: string;
  country: string;
  countryFlag: string;
  year: number;
  /** Dividende par action en FCFA, ajusté des fractionnements. */
  amount: number;
  /** Dernier cours canonique (FCFA), ajusté ; null si aucun cours. */
  close: number | null;
  /** Dividende ÷ dernier cours, en % ; null sans cours. */
  yieldPercent: number | null;
  /** YYYY-MM-DD — date réelle ou 31/12 de l'exercice (placement calendrier). */
  displayDate: string;
  exDate: string | null;
  paymentDate: string | null;
  precision: DividendDatePrecision;
  source: string;
}

export interface DividendCalendarDataset {
  events: DividendCalendarEvent[];
  years: number[];
  /** Années calendaires (dates ex/paiement) pour la vue mensuelle. */
  calendarYears: number[];
  sectors: string[];
  datedCount: number;
  exerciceOnlyCount: number;
  /** Dividendes à venir (date ex ou paiement ≥ aujourd'hui). */
  upcomingCount: number;
  /** Nombre de sociétés qui versent un dividende. */
  companies: number;
  /** Date du cours le plus récent utilisé pour le rendement. */
  priceDate: string | null;
}

export interface DividendCalendarDbRow {
  id: string;
  companyId: string;
  year: number;
  amount: number;
  /** YYYY-MM-DD */
  exDate: string | null;
  paymentDate: string | null;
  /** Valeur brute de l'enum `data_source` (BRVM_OFFICIEL, SIKAFINANCE, …). */
  source: string;
  ticker: string;
  name: string;
  sector: string;
  country: string;
  countryFlag: string;
}

export interface DividendCalendarDateRow {
  companyId: string;
  year: number;
  exDate: string | null;
  paymentDate: string | null;
  source: string;
}

export interface DividendCalendarPrice {
  close: number;
  /** YYYY-MM-DD */
  date: string;
}

/** Ordre de préférence des sources (plus petit = préféré) pour départager deux lignes d'un même exercice. */
const SOURCE_PRIORITY: Record<string, number> = {
  BRVM_OFFICIEL: 0,
  SIKAFINANCE: 1,
  OUESTBOURSE: 2,
  RICHBOURSE: 3,
  MANUEL: 4,
};

const sourcePriority = (s: string): number => SOURCE_PRIORITY[s] ?? 9;

/**
 * Choix de la ligne affichée pour une société et un exercice :
 * BRVM officiel, puis lignes datées, puis Sikafinance, puis saisie manuelle.
 */
export function compareDividendRows(
  a: Pick<DividendCalendarDbRow, "source" | "exDate" | "paymentDate">,
  b: Pick<DividendCalendarDbRow, "source" | "exDate" | "paymentDate">,
): number {
  const official = Number(b.source === "BRVM_OFFICIEL") - Number(a.source === "BRVM_OFFICIEL");
  if (official !== 0) return official;
  const dated = Number(Boolean(b.exDate || b.paymentDate)) - Number(Boolean(a.exDate || a.paymentDate));
  if (dated !== 0) return dated;
  return sourcePriority(a.source) - sourcePriority(b.source);
}

/** Rendement en % : dividende ÷ cours. null si le cours ou le montant n'est pas exploitable. */
export function yieldPercent(amount: number, close: number | null): number | null {
  if (close == null || !(close > 0) || !(amount > 0)) return null;
  return Math.round((amount / close) * 10000) / 100;
}

function exerciceAnchor(year: number): string {
  return `${year}-12-31`;
}

export function buildDividendCalendar(input: {
  rows: DividendCalendarDbRow[];
  /** Toutes les lignes de dividendes des sociétés (pour reprendre une date absente de la ligne affichée). */
  dateRows: DividendCalendarDateRow[];
  actions?: Map<string, AdjustmentAction[]>;
  /** companyId → dernier cours canonique. */
  prices?: Map<string, DividendCalendarPrice>;
  /** YYYY-MM-DD */
  today: string;
}): DividendCalendarDataset {
  const actions = input.actions ?? new Map<string, AdjustmentAction[]>();
  const prices = input.prices ?? new Map<string, DividendCalendarPrice>();

  // Dates de repli : la ligne affichée prime, sinon la meilleure ligne sœur qui porte la date.
  const siblings = new Map<string, DividendCalendarDateRow[]>();
  for (const d of input.dateRows) {
    const key = `${d.companyId}:${d.year}`;
    const list = siblings.get(key) ?? [];
    list.push(d);
    siblings.set(key, list);
  }
  const fallbackDate = (companyId: string, year: number, field: "exDate" | "paymentDate"): string | null => {
    const list = (siblings.get(`${companyId}:${year}`) ?? []).filter((d) => d[field]);
    list.sort((a, b) => sourcePriority(a.source) - sourcePriority(b.source));
    return list[0]?.[field] ?? null;
  };

  // Une seule ligne par société + exercice.
  const bestByYear = new Map<string, DividendCalendarDbRow>();
  for (const row of input.rows) {
    if (!Number.isFinite(row.amount) || !(row.amount > 0)) continue;
    const key = `${row.ticker}|${row.year}`;
    const prev = bestByYear.get(key);
    if (!prev || compareDividendRows(row, prev) < 0) bestByYear.set(key, row);
  }

  const events: DividendCalendarEvent[] = [];
  for (const row of bestByYear.values()) {
    const paymentDate = row.paymentDate ?? fallbackDate(row.companyId, row.year, "paymentDate");
    const exDate = row.exDate ?? fallbackDate(row.companyId, row.year, "exDate");
    const tickerActions = actions.get(row.ticker) ?? [];
    const amount = presentDividend(row.amount, row.year, exDate, tickerActions);
    if (!(amount > 0)) continue;

    const price = prices.get(row.companyId);
    const close =
      price && price.close > 0 ? presentClose(price.close, null, price.date, tickerActions).closePrice : null;

    let precision: DividendDatePrecision;
    let displayDate: string;
    if (paymentDate) {
      precision = "payment";
      displayDate = paymentDate;
    } else if (exDate) {
      precision = "ex";
      displayDate = exDate;
    } else {
      precision = "exercice";
      displayDate = exerciceAnchor(row.year);
    }

    events.push({
      id: row.id,
      ticker: row.ticker,
      name: row.name,
      sector: row.sector,
      country: row.country,
      countryFlag: row.countryFlag,
      year: row.year,
      amount,
      close,
      yieldPercent: yieldPercent(amount, close),
      displayDate,
      exDate,
      paymentDate,
      precision,
      source: dataSourceLabel(row.source),
    });
  }

  // Une seule ligne par ticker + date affichée : la source la mieux classée l'emporte.
  // Cas typique : Richbourse étiquette « 2026 » le dividende d'exercice 2025
  // déjà porté par BRVM_OFFICIEL (mêmes dates, montants parfois divergents).
  const LABEL_RANK: Record<string, number> = {
    "BRVM officiel": 0,
    Sikafinance: 1,
    "OuestBourse.com": 2,
    Richbourse: 3,
    "Saisie manuelle": 4,
  };
  const bestByDate = new Map<string, DividendCalendarEvent>();
  for (const ev of events) {
    const key = `${ev.ticker}|${ev.displayDate}`;
    const prev = bestByDate.get(key);
    if (!prev || (LABEL_RANK[ev.source] ?? 9) < (LABEL_RANK[prev.source] ?? 9)) bestByDate.set(key, ev);
  }
  const deduped = [...bestByDate.values()].sort((a, b) => {
    if (a.displayDate !== b.displayDate) return a.displayDate < b.displayDate ? -1 : 1;
    return a.ticker.localeCompare(b.ticker, "fr");
  });

  const years = new Set<number>();
  const calendarYears = new Set<number>();
  const sectors = new Set<string>();
  const tickers = new Set<string>();
  let datedCount = 0;
  let exerciceOnlyCount = 0;
  let priceDate: string | null = null;
  for (const ev of deduped) {
    years.add(ev.year);
    calendarYears.add(Number(ev.displayDate.slice(0, 4)));
    sectors.add(ev.sector);
    tickers.add(ev.ticker);
    if (ev.precision === "exercice") exerciceOnlyCount += 1;
    else datedCount += 1;
  }
  for (const p of prices.values()) if (!priceDate || p.date > priceDate) priceDate = p.date;

  return {
    events: deduped,
    years: [...years].sort((a, b) => b - a),
    calendarYears: [...calendarYears].sort((a, b) => b - a),
    sectors: [...sectors].sort((a, b) => a.localeCompare(b, "fr")),
    datedCount,
    exerciceOnlyCount,
    upcomingCount: deduped.filter((ev) => ev.precision !== "exercice" && ev.displayDate >= input.today).length,
    companies: tickers.size,
    priceDate,
  };
}

/** Meilleur rendement parmi le dernier dividende connu de chaque société. */
export function topYieldByCompany(events: DividendCalendarEvent[]): DividendCalendarEvent | null {
  const latest = new Map<string, DividendCalendarEvent>();
  for (const ev of events) {
    const prev = latest.get(ev.ticker);
    if (!prev || ev.year > prev.year) latest.set(ev.ticker, ev);
  }
  let best: DividendCalendarEvent | null = null;
  for (const ev of latest.values()) {
    if (ev.yieldPercent == null) continue;
    if (!best || ev.yieldPercent > (best.yieldPercent ?? -Infinity)) best = ev;
  }
  return best;
}
