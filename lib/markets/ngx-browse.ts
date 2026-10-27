// Lecture NGX pour les pages /marches/ngx. Aucun chiffre inventé :
// une base vide produit des listes vides, affichées N/D côté UI.

import type { ChartClosePoint } from "@/lib/charts/indicators";
import { presentCompanyCloses } from "@/lib/corporate-actions/present-series";
import { dataSourceLabel } from "@/lib/api/data-source-label";
import { indicativeFcfa, latestEurNgnRate, type EurNgnRate } from "@/lib/markets/fx";
import { prisma } from "@/lib/prisma";

export interface NgxShareRow {
  ticker: string;
  name: string;
  sectorSlug: string;
  sectorName: string;
  board: string | null;
  close: number | null;
  changePercent: number | null;
  volume: number | null;
  sessionDate: string | null;
  sourceLabel: string;
  indicativeFcfa: number | null;
}

export interface NgxSectorCount {
  slug: string;
  name: string;
  count: number;
}

export interface NgxOverview {
  shares: NgxShareRow[];
  sectors: NgxSectorCount[];
  gainers: NgxShareRow[];
  losers: NgxShareRow[];
  sessionDate: string | null;
  asi: { value: number; changePercent: number | null; date: string } | null;
  fx: EurNgnRate | null;
}

function boardOf(meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const board = (meta as { board?: unknown }).board;
  return typeof board === "string" && board.trim() ? board.trim() : null;
}

function dayChange(
  changePercent: { toString(): string } | null,
  close: number,
  previous: number | null
): number | null {
  if (changePercent != null) {
    const published = Number(changePercent);
    if (Number.isFinite(published)) return Math.round(published * 100) / 100;
  }
  if (previous == null || !(previous > 0)) return null;
  return Math.round(((close - previous) / previous) * 10000) / 100;
}

export async function loadNgxOverview(): Promise<NgxOverview> {
  const [companies, asiRow, fx] = await Promise.all([
    prisma.company.findMany({
      where: { exchange: "NGX", isActive: true },
      orderBy: { ticker: "asc" },
      select: {
        ticker: true,
        name: true,
        profileMeta: true,
        sector: { select: { slug: true, name: true } },
        priceHistory: {
          where: { isCanonical: true },
          orderBy: { date: "desc" },
          take: 2,
          select: { date: true, closePrice: true, changePercent: true, volume: true, source: true },
        },
      },
    }),
    prisma.marketIndex.findUnique({
      where: { code: "NGX_ASI" },
      include: {
        values: {
          where: { isCanonical: true },
          orderBy: { date: "desc" },
          take: 1,
        },
      },
    }),
    latestEurNgnRate(prisma).catch(() => null),
  ]);

  const shares: NgxShareRow[] = companies.map((company) => {
    const latest = company.priceHistory[0];
    const previous = company.priceHistory[1];
    const close = latest ? Number(latest.closePrice) : null;
    const prevClose = previous ? Number(previous.closePrice) : null;
    return {
      ticker: company.ticker,
      name: company.name,
      sectorSlug: company.sector.slug,
      sectorName: company.sector.name,
      board: boardOf(company.profileMeta),
      close: close != null && close > 0 ? close : null,
      changePercent: latest && close != null ? dayChange(latest.changePercent, close, prevClose) : null,
      volume: latest?.volume != null ? Number(latest.volume) : null,
      sessionDate: latest ? latest.date.toISOString().slice(0, 10) : null,
      sourceLabel: dataSourceLabel(latest?.source ?? null),
      indicativeFcfa: close != null && fx ? indicativeFcfa(close, fx.ngnPerEur) : null,
    };
  });

  const sectorMap = new Map<string, NgxSectorCount>();
  for (const share of shares) {
    const current = sectorMap.get(share.sectorSlug) ?? {
      slug: share.sectorSlug,
      name: share.sectorName,
      count: 0,
    };
    current.count += 1;
    sectorMap.set(share.sectorSlug, current);
  }
  const sectors = [...sectorMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const moved = shares.filter((row) => row.changePercent != null && row.close != null);
  const gainers = [...moved].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0)).slice(0, 5);
  const losers = [...moved].sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0)).slice(0, 5);
  const sessionDate = shares.reduce<string | null>((max, row) => {
    if (!row.sessionDate) return max;
    return !max || row.sessionDate > max ? row.sessionDate : max;
  }, null);

  const asiValue = asiRow?.exchange === "NGX" ? asiRow.values[0] : undefined;
  const asi =
    asiValue && Number(asiValue.value) > 0
      ? {
          value: Number(asiValue.value),
          changePercent: asiValue.changePercent != null ? Number(asiValue.changePercent) : null,
          date: asiValue.date.toISOString().slice(0, 10),
        }
      : null;

  return { shares, sectors, gainers, losers, sessionDate, asi, fx };
}

export interface NgxCompanyPage {
  ticker: string;
  name: string;
  sectorSlug: string;
  sectorName: string;
  board: string | null;
  close: number | null;
  changePercent: number | null;
  previousClose: number | null;
  volume: number | null;
  sessionDate: string | null;
  sourceLabel: string;
  indicativeFcfa: number | null;
  fx: EurNgnRate | null;
  series: ChartClosePoint[];
}

export async function loadNgxCompany(ticker: string): Promise<NgxCompanyPage | null> {
  const company = await prisma.company.findFirst({
    where: { ticker: ticker.toUpperCase(), exchange: "NGX", isActive: true },
    select: {
      id: true,
      ticker: true,
      name: true,
      profileMeta: true,
      sector: { select: { slug: true, name: true } },
    },
  });
  if (!company) return null;

  const [prices, fx] = await Promise.all([
    prisma.priceHistory.findMany({
      where: { companyId: company.id, isCanonical: true },
      orderBy: { date: "asc" },
      select: { date: true, closePrice: true, volume: true, changePercent: true, source: true },
    }),
    latestEurNgnRate(prisma).catch(() => null),
  ]);

  const raw: ChartClosePoint[] = prices
    .map((row) => ({
      time: row.date.toISOString().slice(0, 10),
      value: Number(row.closePrice),
      volume: row.volume != null ? Number(row.volume) : null,
    }))
    .filter((point) => point.value > 0);

  const presented = await presentCompanyCloses(prisma, company.id, company.ticker, raw);
  const latest = prices[prices.length - 1];
  const previous = prices.length >= 2 ? prices[prices.length - 2] : null;
  const close = latest ? Number(latest.closePrice) : null;

  return {
    ticker: company.ticker,
    name: company.name,
    sectorSlug: company.sector.slug,
    sectorName: company.sector.name,
    board: boardOf(company.profileMeta),
    close: close != null && close > 0 ? close : null,
    changePercent:
      latest && close != null ? dayChange(latest.changePercent, close, previous ? Number(previous.closePrice) : null) : null,
    previousClose: previous ? Number(previous.closePrice) : null,
    volume: latest?.volume != null ? Number(latest.volume) : null,
    sessionDate: latest ? latest.date.toISOString().slice(0, 10) : null,
    sourceLabel: dataSourceLabel(latest?.source ?? null),
    indicativeFcfa: close != null && fx ? indicativeFcfa(close, fx.ngnPerEur) : null,
    fx,
    series: presented.points,
  };
}

export interface NgxIndexPage {
  code: string;
  name: string;
  value: number | null;
  changePercent: number | null;
  date: string | null;
  sourceLabel: string;
  series: ChartClosePoint[];
}

export async function loadNgxIndex(code: string): Promise<NgxIndexPage | null> {
  const row = await prisma.marketIndex.findUnique({ where: { code: code.toUpperCase() } });
  if (!row || row.exchange !== "NGX") return null;
  const values = await prisma.marketIndexValue.findMany({
    where: { marketIndexId: row.id, isCanonical: true },
    orderBy: { date: "asc" },
    select: { date: true, value: true, changePercent: true, source: true },
  });
  const latest = values[values.length - 1];
  return {
    code: row.code,
    name: row.name,
    value: latest ? Number(latest.value) : null,
    changePercent: latest?.changePercent != null ? Number(latest.changePercent) : null,
    date: latest ? latest.date.toISOString().slice(0, 10) : null,
    sourceLabel: dataSourceLabel(latest?.source ?? null),
    series: values
      .map((point) => ({ time: point.date.toISOString().slice(0, 10), value: Number(point.value) }))
      .filter((point) => point.value > 0),
  };
}
