/**
 * Calendrier des dividendes BRVM — données canoniques en base.
 * Dates exactes (ex / paiement) si connues ; sinon placement sur l'exercice
 * avec précision "exercice" → l'UI affiche "N/D" pour la date précise.
 * Rendement = dividende ÷ dernier cours canonique (assemblage dans dividend-calendar-build.ts).
 */

import { prisma } from "@/lib/prisma";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { loadLatestCanonicalPrice } from "@/lib/db/latest-canonical";
import type { PriceHistory } from "@prisma/client";
import { actionsByTicker } from "@/lib/corporate-actions/load";
import type { AdjustmentAction } from "@/lib/corporate-actions/types";
import {
  buildDividendCalendar,
  type DividendCalendarDataset,
  type DividendCalendarPrice,
} from "@/lib/api/dividend-calendar-build";

export type {
  DividendCalendarDataset,
  DividendCalendarEvent,
  DividendDatePrecision,
} from "@/lib/api/dividend-calendar-build";

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const EMPTY: DividendCalendarDataset = {
  events: [],
  years: [],
  calendarYears: [],
  sectors: [],
  datedCount: 0,
  exerciceOnlyCount: 0,
  upcomingCount: 0,
  companies: 0,
  priceDate: null,
};

export async function getDividendCalendarDataset(): Promise<DividendCalendarDataset> {
  try {
    return await loadDividendCalendarFromDb();
  } catch (err) {
    if (!isDatabaseUnavailable(err)) throw err;
    console.error(
      "[dividendes] base injoignable — calendrier vide (N/D) :",
      err instanceof Error ? err.message : err
    );
    return EMPTY;
  }
}

async function loadDividendCalendarFromDb(): Promise<DividendCalendarDataset> {
  // Seules les lignes canoniques sont candidates (comme tous les autres consommateurs de `dividends`) ;
  // `buildDividendCalendar` départage ensuite par source : BRVM officiel > lignes datées > Sikafinance > saisie manuelle.
  const rows = await prisma.dividend.findMany({
    where: {
      isCanonical: true,
      amount: { gt: 0 },
      company: { isActive: true, exchange: "BRVM" },
    },
    select: {
      id: true,
      companyId: true,
      year: true,
      amount: true,
      exDate: true,
      paymentDate: true,
      source: true,
      company: {
        select: {
          ticker: true,
          name: true,
          sector: { select: { name: true } },
          country: { select: { name: true, flagEmoji: true } },
        },
      },
    },
    orderBy: [{ year: "desc" }, { paymentDate: "asc" }, { exDate: "asc" }],
  });

  const companyIds = [...new Set(rows.map((r) => r.companyId))];
  // Dernier cours canonique par PostgreSQL (LATERAL … LIMIT 1) plutôt qu'un `take`
  // imbriqué Prisma, qui rapatriait tout l'historique de chaque société.
  const [dateRows, latestPrices] =
    companyIds.length > 0
      ? await Promise.all([
          prisma.dividend.findMany({
            where: { companyId: { in: companyIds }, amount: { gt: 0 } },
            select: { companyId: true, year: true, exDate: true, paymentDate: true, source: true },
          }),
          loadLatestCanonicalPrice(prisma, companyIds),
        ])
      : [[], new Map<string, PriceHistory>()];

  let actions = new Map<string, AdjustmentAction[]>();
  try {
    actions = await actionsByTicker();
  } catch {
    actions = new Map();
  }

  const prices = new Map<string, DividendCalendarPrice>();
  for (const r of rows) {
    const last = latestPrices.get(r.companyId);
    const close = last ? Number(last.closePrice) : NaN;
    if (last && Number.isFinite(close) && close > 0) {
      prices.set(r.companyId, { close, date: toIsoDate(last.date) });
    }
  }

  return buildDividendCalendar({
    rows: rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      year: r.year,
      amount: Number(r.amount),
      exDate: r.exDate ? toIsoDate(r.exDate) : null,
      paymentDate: r.paymentDate ? toIsoDate(r.paymentDate) : null,
      source: r.source,
      ticker: r.company.ticker,
      name: r.company.name,
      sector: r.company.sector.name,
      country: r.company.country.name,
      countryFlag: r.company.country.flagEmoji ?? "",
    })),
    dateRows: dateRows.map((d) => ({
      companyId: d.companyId,
      year: d.year,
      exDate: d.exDate ? toIsoDate(d.exDate) : null,
      paymentDate: d.paymentDate ? toIsoDate(d.paymentDate) : null,
      source: d.source,
    })),
    actions,
    prices,
    today: toIsoDate(new Date()),
  });
}
