// Dividendes NGX : lit la table `dividends` (lignes canoniques des sociétés NGX, montants en naira ₦ par action),
// ajoute le rendement sur le dernier cours canonique et les dates ex / paiement quand elles existent.
// Lecture seule. Une donnée absente reste null (affichée N/D), jamais estimée.

import { prisma } from "@/lib/prisma";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { actionsByTicker } from "@/lib/corporate-actions/load";
import { presentClose, presentDividend } from "@/lib/corporate-actions/present-quotes";
import type { AdjustmentAction } from "@/lib/corporate-actions/types";
import { dataSourceLabel } from "@/lib/api/data-source-label";

export interface NgxDividendRow {
  id: string;
  ticker: string;
  name: string;
  sectorSlug: string;
  sectorName: string;
  /** Exercice concerné. */
  year: number;
  /** Dividende par action en naira, déjà ajusté des fractionnements. */
  amount: number;
  /** Dernier cours canonique (₦), ajusté ; null si aucun cours. */
  close: number | null;
  /** Dividende ÷ dernier cours, en % ; null sans cours. */
  yieldPercent: number | null;
  exDate: string | null;
  paymentDate: string | null;
  source: string;
}

export interface NgxDividendsData {
  rows: NgxDividendRow[];
  /** Exercices présents, du plus récent au plus ancien. */
  years: number[];
  sectors: Array<{ slug: string; name: string }>;
  companies: number;
  datedCount: number;
  priceDate: string | null;
}

export interface NgxDividendDbRow {
  id: string;
  year: number;
  amount: number;
  exDate: string | null;
  paymentDate: string | null;
  source: string;
  isCanonical: boolean;
  ticker: string;
  name: string;
  sectorSlug: string;
  sectorName: string;
  close: number | null;
  closeDate: string | null;
}

/** Rendement en % : dividende ÷ cours. null si le cours ou le montant n'est pas exploitable. */
export function yieldPercent(amount: number, close: number | null): number | null {
  if (close == null || !(close > 0) || !(amount > 0)) return null;
  return Math.round((amount / close) * 10000) / 100;
}

/**
 * Assemble les lignes affichées. Une ligne par société et exercice (la canonique prime, puis les dates
 * connues) ; montant et cours sont ajustés des opérations sur titres de la société.
 */
export function buildNgxDividends(
  input: NgxDividendDbRow[],
  actions: Map<string, AdjustmentAction[]> = new Map(),
): NgxDividendsData {
  const best = new Map<string, NgxDividendDbRow>();
  for (const r of input) {
    if (!Number.isFinite(r.amount) || !(r.amount > 0)) continue;
    const key = `${r.ticker}|${r.year}`;
    const prev = best.get(key);
    const rank = (x: NgxDividendDbRow) => (x.isCanonical ? 2 : 0) + (x.exDate || x.paymentDate ? 1 : 0);
    if (!prev || rank(r) > rank(prev)) best.set(key, r);
  }

  const rows: NgxDividendRow[] = [];
  const years = new Set<number>();
  const sectors = new Map<string, string>();
  const tickers = new Set<string>();
  let datedCount = 0;
  let priceDate: string | null = null;

  for (const r of best.values()) {
    const acts = actions.get(r.ticker) ?? [];
    const amount = presentDividend(r.amount, r.year, r.exDate, acts);
    if (!(amount > 0)) continue;
    const close =
      r.close != null && r.close > 0 && r.closeDate
        ? presentClose(r.close, null, r.closeDate, acts).closePrice
        : null;
    if (r.closeDate && (!priceDate || r.closeDate > priceDate)) priceDate = r.closeDate;
    if (r.exDate || r.paymentDate) datedCount += 1;
    years.add(r.year);
    sectors.set(r.sectorSlug, r.sectorName);
    tickers.add(r.ticker);
    rows.push({
      id: r.id,
      ticker: r.ticker,
      name: r.name,
      sectorSlug: r.sectorSlug,
      sectorName: r.sectorName,
      year: r.year,
      amount,
      close,
      yieldPercent: yieldPercent(amount, close),
      exDate: r.exDate,
      paymentDate: r.paymentDate,
      source: dataSourceLabel(r.source),
    });
  }

  rows.sort((a, b) => b.year - a.year || a.ticker.localeCompare(b.ticker, "fr"));
  return {
    rows,
    years: [...years].sort((a, b) => b - a),
    sectors: [...sectors].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name, "fr")),
    companies: tickers.size,
    datedCount,
    priceDate,
  };
}

const EMPTY: NgxDividendsData = { rows: [], years: [], sectors: [], companies: 0, datedCount: 0, priceDate: null };

const isoDay = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);

export async function loadNgxDividends(): Promise<NgxDividendsData> {
  try {
    const companies = await prisma.company.findMany({
      where: { exchange: "NGX", isActive: true, dividends: { some: { amount: { gt: 0 } } } },
      select: {
        ticker: true,
        name: true,
        sector: { select: { slug: true, name: true } },
        priceHistory: {
          where: { isCanonical: true },
          orderBy: { date: "desc" },
          take: 1,
          select: { date: true, closePrice: true },
        },
        dividends: {
          where: { amount: { gt: 0 } },
          select: { id: true, year: true, amount: true, exDate: true, paymentDate: true, source: true, isCanonical: true },
        },
      },
    });
    const actions = await actionsByTicker().catch(() => new Map<string, AdjustmentAction[]>());
    const input: NgxDividendDbRow[] = companies.flatMap((c) => {
      const last = c.priceHistory[0];
      const close = last ? Number(last.closePrice) : null;
      return c.dividends.map((d) => ({
        id: d.id,
        year: d.year,
        amount: Number(d.amount),
        exDate: isoDay(d.exDate),
        paymentDate: isoDay(d.paymentDate),
        source: d.source,
        isCanonical: d.isCanonical,
        ticker: c.ticker,
        name: c.name,
        sectorSlug: c.sector.slug,
        sectorName: c.sector.name,
        close: close != null && close > 0 ? close : null,
        closeDate: last ? isoDay(last.date) : null,
      }));
    });
    return buildNgxDividends(input, actions);
  } catch (err) {
    if (!isDatabaseUnavailable(err)) throw err;
    console.error("[ngx-dividendes] base injoignable — liste vide (N/D) :", err instanceof Error ? err.message : err);
    return EMPTY;
  }
}

/** Meilleur rendement parmi le dernier dividende connu de chaque société (lignes triées exercice décroissant). */
export function topYieldByCompany(rows: NgxDividendRow[]): NgxDividendRow | null {
  const latest = new Map<string, NgxDividendRow>();
  for (const r of rows) {
    const prev = latest.get(r.ticker);
    if (!prev || r.year > prev.year) latest.set(r.ticker, r);
  }
  let best: NgxDividendRow | null = null;
  for (const r of latest.values()) {
    if (r.yieldPercent == null) continue;
    if (!best || r.yieldPercent > (best.yieldPercent ?? -Infinity)) best = r;
  }
  return best;
}
