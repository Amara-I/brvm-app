// Chargeur de la fiche NGX : lit la base (société, cours, comptes, dividendes, événements,
// documents, pairs du secteur) et délègue tous les calculs à lib/ngx/sheet-model.ts.
// Lecture seule. Une table vide donne des sections vides, jamais des chiffres inventés.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildNgxSheet, type CompanyInput, type DividendRowLike, type NgxSheetModel } from "@/lib/ngx/sheet-model";
import type { RatioRowLike } from "@/lib/ngx/fundamentals";
import { loadNgxCompany, type NgxCompanyPage } from "./ngx-browse";

const isoDay = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);
const numOrNull = (v: { toString(): string } | null | undefined): number | null => {
  if (v == null) return null;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : null;
};

function boardOf(meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const board = (meta as { board?: unknown }).board;
  return typeof board === "string" && board.trim() ? board.trim() : null;
}

type RatioDb = {
  year: number;
  revenue: Prisma.Decimal | null;
  operatingIncome: Prisma.Decimal | null;
  netIncome: Prisma.Decimal | null;
  isCanonical: boolean;
  source: string;
};
type DividendDb = {
  year: number;
  amount: Prisma.Decimal;
  exDate: Date | null;
  paymentDate: Date | null;
  isCanonical: boolean;
  source: string;
};

const toRatio = (r: RatioDb): RatioRowLike => ({
  year: r.year,
  revenue: numOrNull(r.revenue),
  operatingIncome: numOrNull(r.operatingIncome),
  netIncome: numOrNull(r.netIncome),
  isCanonical: r.isCanonical,
  source: r.source,
});
const toDividend = (d: DividendDb): DividendRowLike => ({
  year: d.year,
  amount: Number(d.amount),
  exDate: isoDay(d.exDate),
  paymentDate: isoDay(d.paymentDate),
  isCanonical: d.isCanonical,
  source: d.source,
});

export interface NgxSheetData {
  page: NgxCompanyPage;
  model: NgxSheetModel;
}

export async function loadNgxSheet(ticker: string): Promise<NgxSheetData | null> {
  const page = await loadNgxCompany(ticker);
  if (!page) return null;

  const universeRows = await prisma.company.findMany({
    where: { exchange: "NGX", isActive: true },
    select: {
      id: true,
      ticker: true,
      name: true,
      isin: true,
      description: true,
      listedSince: true,
      profileMeta: true,
      sector: { select: { slug: true, name: true } },
      priceHistory: {
        where: { isCanonical: true },
        orderBy: { date: "desc" },
        take: 1,
        select: { closePrice: true },
      },
      financialRatios: {
        where: { year: { gte: 2010 } },
        select: {
          year: true,
          revenue: true,
          operatingIncome: true,
          netIncome: true,
          isCanonical: true,
          source: true,
        },
      },
      dividends: {
        select: {
          year: true,
          amount: true,
          exDate: true,
          paymentDate: true,
          isCanonical: true,
          source: true,
        },
      },
    },
  });

  const universe: CompanyInput[] = universeRows.map((c) => {
    const close = c.priceHistory[0] ? Number(c.priceHistory[0].closePrice) : null;
    return {
      ticker: c.ticker,
      name: c.name,
      sectorSlug: c.sector.slug,
      sectorName: c.sector.name,
      board: boardOf(c.profileMeta),
      isin: c.isin,
      description: c.description,
      listedSince: isoDay(c.listedSince),
      profileMeta: c.profileMeta,
      close: close != null && close > 0 ? close : null,
      ratios: c.financialRatios.map(toRatio),
      dividends: c.dividends.map(toDividend),
    };
  });

  const me = universe.find((c) => c.ticker === page.ticker);
  const meRow = universeRows.find((c) => c.ticker === page.ticker);
  if (!me || !meRow) return null;
  // Le cours de la fiche vient de la série présentée (ajustée des opérations sur titres).
  me.close = page.close;

  const [events, documents] = await Promise.all([
    prisma.companyEvent.findMany({
      where: { companyId: meRow.id },
      orderBy: { eventDate: "desc" },
      take: 60,
      select: {
        title: true,
        eventType: true,
        eventDate: true,
        endDate: true,
        comment: true,
        url: true,
        sourceName: true,
      },
    }),
    prisma.companyDocument.findMany({
      where: { companyId: meRow.id },
      orderBy: { publishedAt: "desc" },
      take: 40,
      select: {
        title: true,
        filename: true,
        url: true,
        docType: true,
        periodLabel: true,
        publishedAt: true,
        sourceName: true,
      },
    }),
  ]);

  const model = buildNgxSheet({
    company: me,
    previousClose: page.previousClose,
    changePercent: page.changePercent,
    volume: page.volume,
    sessionDate: page.sessionDate,
    indicativeFcfa: page.indicativeFcfa,
    series: page.series.map((p) => ({
      time: p.time,
      value: p.value,
      volume: p.volume ?? null,
    })),
    events: events.map((e) => ({
      title: e.title,
      eventType: e.eventType,
      eventDate: e.eventDate.toISOString().slice(0, 10),
      endDate: isoDay(e.endDate),
      comment: e.comment,
      url: e.url,
      sourceName: e.sourceName,
    })),
    documents: documents.map((d) => ({
      title: d.title,
      filename: d.filename,
      url: d.url,
      docType: d.docType,
      periodLabel: d.periodLabel,
      publishedAt: isoDay(d.publishedAt),
      sourceName: d.sourceName,
    })),
    universe,
    today: new Date().toISOString().slice(0, 10),
  });
  return { page, model };
}
