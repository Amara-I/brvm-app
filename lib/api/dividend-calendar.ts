/**
 * Calendrier des dividendes BRVM — données canoniques en base.
 * Dates exactes (ex / paiement) si connues ; sinon placement sur l'exercice
 * avec précision "exercice" → l'UI affiche "N/D" pour la date précise.
 */

import { prisma } from "@/lib/prisma";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";

export type DividendDatePrecision = "payment" | "ex" | "exercice";

export interface DividendCalendarEvent {
  id: string;
  ticker: string;
  name: string;
  sector: string;
  country: string;
  countryFlag: string;
  year: number;
  amount: number;
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
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function exerciceAnchor(year: number): string {
  return `${year}-12-31`;
}

function mapSource(source: string): string {
  switch (source) {
    case "BRVM_OFFICIEL":
      return "BRVM officiel";
    case "SIKAFINANCE":
      return "Sikafinance";
    case "OUESTBOURSE":
      return "OuestBourse.com";
    case "RICHBOURSE":
      return "Richbourse";
    case "MANUEL":
      return "Saisie manuelle";
    default:
      return source;
  }
}

export async function getDividendCalendarDataset(): Promise<DividendCalendarDataset> {
  try {
    return await loadDividendCalendarFromDb();
  } catch (err) {
    if (!isDatabaseUnavailable(err)) throw err;
    console.error(
      "[dividendes] base injoignable — calendrier vide (N/D) :",
      err instanceof Error ? err.message : err
    );
    return {
      events: [],
      years: [],
      calendarYears: [],
      sectors: [],
      datedCount: 0,
      exerciceOnlyCount: 0,
      upcomingCount: 0,
    };
  }
}

async function loadDividendCalendarFromDb(): Promise<DividendCalendarDataset> {
  const rows = await prisma.dividend.findMany({
    where: {
      isCanonical: true,
      amount: { gt: 0 },
      company: { isActive: true },
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
  const dateRows =
    companyIds.length > 0
      ? await prisma.dividend.findMany({
          where: { companyId: { in: companyIds }, amount: { gt: 0 } },
          select: { companyId: true, year: true, exDate: true, paymentDate: true },
        })
      : [];
  const mergedDates = new Map<string, { exDate: Date | null; paymentDate: Date | null }>();
  for (const d of dateRows) {
    const key = `${d.companyId}:${d.year}`;
    const cur = mergedDates.get(key) ?? { exDate: null, paymentDate: null };
    if (d.exDate) cur.exDate = d.exDate;
    if (d.paymentDate) cur.paymentDate = d.paymentDate;
    mergedDates.set(key, cur);
  }

  const events: DividendCalendarEvent[] = [];
  const yearSet = new Set<number>();
  const calendarYearSet = new Set<number>();
  const sectorSet = new Set<string>();
  let datedCount = 0;
  let exerciceOnlyCount = 0;
  const today = toIsoDate(new Date());

  for (const row of rows) {
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const merged = mergedDates.get(`${row.companyId}:${row.year}`);
    const paymentDate = merged?.paymentDate
      ? toIsoDate(merged.paymentDate)
      : row.paymentDate
        ? toIsoDate(row.paymentDate)
        : null;
    const exDate = merged?.exDate
      ? toIsoDate(merged.exDate)
      : row.exDate
        ? toIsoDate(row.exDate)
        : null;

    let precision: DividendDatePrecision;
    let displayDate: string;
    if (paymentDate) {
      precision = "payment";
      displayDate = paymentDate;
      datedCount += 1;
    } else if (exDate) {
      precision = "ex";
      displayDate = exDate;
      datedCount += 1;
    } else {
      precision = "exercice";
      displayDate = exerciceAnchor(row.year);
      exerciceOnlyCount += 1;
    }

    const sector = row.company.sector.name;
    yearSet.add(row.year);
    calendarYearSet.add(Number(displayDate.slice(0, 4)));
    sectorSet.add(sector);

    events.push({
      id: row.id,
      ticker: row.company.ticker,
      name: row.company.name,
      sector,
      country: row.company.country.name,
      countryFlag: row.company.country.flagEmoji ?? "",
      year: row.year,
      amount,
      displayDate,
      exDate,
      paymentDate,
      precision,
      source: mapSource(row.source),
    });
  }

  events.sort((a, b) => {
    if (a.displayDate !== b.displayDate) return a.displayDate < b.displayDate ? -1 : 1;
    return a.ticker.localeCompare(b.ticker, "fr");
  });

  // Une seule ligne par ticker + date affichée : BRVM > autres sources.
  // Cas typique : Richbourse étiquette « 2026 » le dividende d'exercice 2025
  // déjà porté par BRVM_OFFICIEL (mêmes dates, montants parfois divergents).
  const SOURCE_RANK: Record<string, number> = {
    "BRVM officiel": 0,
    Sikafinance: 1,
    "OuestBourse.com": 2,
    Richbourse: 3,
    "Saisie manuelle": 4,
  };
  const bestByKey = new Map<string, DividendCalendarEvent>();
  for (const ev of events) {
    const key = `${ev.ticker}|${ev.displayDate}`;
    const prev = bestByKey.get(key);
    if (!prev) {
      bestByKey.set(key, ev);
      continue;
    }
    const rankNew = SOURCE_RANK[ev.source] ?? 9;
    const rankOld = SOURCE_RANK[prev.source] ?? 9;
    if (rankNew < rankOld) bestByKey.set(key, ev);
  }
  const deduped = [...bestByKey.values()].sort((a, b) => {
    if (a.displayDate !== b.displayDate) return a.displayDate < b.displayDate ? -1 : 1;
    return a.ticker.localeCompare(b.ticker, "fr");
  });

  const upcomingCount = deduped.filter(
    (ev) => ev.precision !== "exercice" && ev.displayDate >= today
  ).length;

  return {
    events: deduped,
    years: [...yearSet].sort((a, b) => b - a),
    calendarYears: [...calendarYearSet].sort((a, b) => b - a),
    sectors: [...sectorSet].sort((a, b) => a.localeCompare(b, "fr")),
    datedCount,
    exerciceOnlyCount,
    upcomingCount,
  };
}
