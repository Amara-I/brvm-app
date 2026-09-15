// Rebuild des séries précalculées (`chart_series`) après upserts de cours.
// Lecture graphes / sparklines : 1 ligne JSON au lieu de scanner price_history.

import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { isMissingDatabaseObject } from "../db/is-database-unavailable";
import { dedupeChartPointsByDay, type ChartClosePoint } from "./indicators";
import {
  CHART_SERIES_RANGE_KEYS,
  buildChartSeriesMeta,
  fingerprintForSeries,
  fromCompactPoints,
  sliceForCacheRange,
  toCompactPoints,
  type ChartSeriesKindCode,
  type ChartSeriesMetaPayload,
  type ChartSeriesRangeKey,
} from "./chart-series-cache";

export interface RefreshChartSeriesOptions {
  symbols?: string[];
  kinds?: ChartSeriesKindCode[];
  timeBudgetMs?: number;
  logger?: (msg: string) => void;
}

export interface RefreshChartSeriesSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  incomplete: boolean;
  nextSymbol: string | null;
  companiesUpdated: number;
  indicesUpdated: number;
  rowsUpserted: number;
  skippedMissingTable: boolean;
}

function log(opts: RefreshChartSeriesOptions, msg: string): void {
  (opts.logger ?? console.log)(msg);
}

function timeLeft(startedAt: number, budgetMs: number | undefined): number {
  if (budgetMs == null || budgetMs <= 0) return Number.POSITIVE_INFINITY;
  return budgetMs - (Date.now() - startedAt);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function loadCanonicalCompanyCloses(
  db: PrismaClient,
  companyId: string
): Promise<{ points: ChartClosePoint[]; sources: string[] }> {
  const now = Date.now();
  const rows = await db.priceHistory.findMany({
    where: { companyId, isCanonical: true },
    orderBy: { date: "asc" },
    select: { date: true, closePrice: true, volume: true, source: true },
  });
  const byDay = new Map<string, ChartClosePoint & { source: string }>();
  for (const p of rows) {
    if (p.date.getTime() > now) continue;
    const time = isoDate(p.date);
    byDay.set(time, {
      time,
      value: Number(p.closePrice),
      volume: p.volume !== null ? Number(p.volume) : null,
      source: p.source,
    });
  }
  const ordered = [...byDay.values()].sort((a, b) => a.time.localeCompare(b.time));
  return {
    points: ordered.map(({ time, value, volume }) => ({ time, value, volume })),
    sources: [...new Set(ordered.map((p) => p.source))],
  };
}

export async function loadCanonicalIndexCloses(
  db: PrismaClient,
  marketIndexId: string
): Promise<{ points: ChartClosePoint[]; sources: string[] }> {
  const now = Date.now();
  const rows = await db.marketIndexValue.findMany({
    where: { marketIndexId, isCanonical: true },
    orderBy: { date: "asc" },
    select: { date: true, value: true, volume: true, source: true },
  });
  const byDay = new Map<string, ChartClosePoint & { source: string }>();
  for (const p of rows) {
    if (p.date.getTime() > now) continue;
    const time = isoDate(p.date);
    byDay.set(time, {
      time,
      value: Number(p.value),
      volume: p.volume !== null ? Number(p.volume) : null,
      source: p.source,
    });
  }
  const ordered = [...byDay.values()].sort((a, b) => a.time.localeCompare(b.time));
  return {
    points: ordered.map(({ time, value, volume }) => ({ time, value, volume })),
    sources: [...new Set(ordered.map((p) => p.source))],
  };
}

async function upsertRangeRows(opts: {
  db: PrismaClient;
  kind: ChartSeriesKindCode;
  symbol: string;
  companyId: string | null;
  full: ChartClosePoint[];
  sources: string[];
}): Promise<number> {
  const { db, kind, symbol, companyId, full, sources } = opts;
  const meta = buildChartSeriesMeta(full, sources);
  const fingerprint = fingerprintForSeries(full);
  let upserted = 0;
  for (const rangeKey of CHART_SERIES_RANGE_KEYS) {
    const slice = sliceForCacheRange(full, rangeKey);
    const first = slice[0]?.time ?? null;
    const last = slice[slice.length - 1]?.time ?? null;
    await db.chartSeries.upsert({
      where: {
        uniq_chart_series_kind_symbol_range: { kind, symbol, rangeKey },
      },
      create: {
        kind,
        symbol,
        companyId,
        rangeKey,
        points: toCompactPoints(slice) as unknown as Prisma.InputJsonValue,
        pointCount: slice.length,
        firstDate: first ? new Date(`${first}T00:00:00.000Z`) : null,
        lastDate: last ? new Date(`${last}T00:00:00.000Z`) : null,
        fingerprint,
        meta: meta as unknown as Prisma.InputJsonValue,
        builtAt: new Date(),
      },
      update: {
        companyId,
        points: toCompactPoints(slice) as unknown as Prisma.InputJsonValue,
        pointCount: slice.length,
        firstDate: first ? new Date(`${first}T00:00:00.000Z`) : null,
        lastDate: last ? new Date(`${last}T00:00:00.000Z`) : null,
        fingerprint,
        meta: meta as unknown as Prisma.InputJsonValue,
        builtAt: new Date(),
      },
    });
    upserted++;
  }
  return upserted;
}

export async function readCachedChartSeries(
  db: PrismaClient,
  kind: ChartSeriesKindCode,
  symbol: string,
  rangeKey: ChartSeriesRangeKey
): Promise<{ points: ChartClosePoint[]; meta: ChartSeriesMetaPayload | null; fingerprint: string } | null> {
  try {
    const row = await db.chartSeries.findUnique({
      where: {
        uniq_chart_series_kind_symbol_range: {
          kind,
          symbol: symbol.toUpperCase(),
          rangeKey,
        },
      },
      select: { points: true, meta: true, fingerprint: true, pointCount: true },
    });
    if (!row || row.pointCount === 0) return null;
    const points = fromCompactPoints(row.points);
    if (points.length === 0) return null;
    const meta = (row.meta ?? null) as ChartSeriesMetaPayload | null;
    return { points, meta, fingerprint: row.fingerprint };
  } catch (err) {
    if (isMissingDatabaseObject(err)) return null;
    throw err;
  }
}

export async function readCachedSparkSeriesByTicker(
  db: PrismaClient = prisma
): Promise<Record<string, ChartClosePoint[]> | null> {
  try {
    const rows = await db.chartSeries.findMany({
      where: { kind: "COMPANY", rangeKey: "SPARK" },
      select: { symbol: true, points: true, pointCount: true },
    });
    if (rows.length === 0) return null;
    const out: Record<string, ChartClosePoint[]> = {};
    for (const row of rows) {
      if (row.pointCount === 0) continue;
      out[row.symbol] = fromCompactPoints(row.points);
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch (err) {
    if (isMissingDatabaseObject(err)) return null;
    throw err;
  }
}

export async function refreshChartSeries(
  options: RefreshChartSeriesOptions = {},
  db: PrismaClient = prisma
): Promise<RefreshChartSeriesSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date();
  const only = options.symbols?.map((s) => s.toUpperCase()).filter(Boolean);
  const kinds = new Set(options.kinds ?? ["COMPANY", "INDEX"]);
  let companiesUpdated = 0;
  let indicesUpdated = 0;
  let rowsUpserted = 0;
  let incomplete = false;
  let nextSymbol: string | null = null;
  let skippedMissingTable = false;

  try {
    if (kinds.has("COMPANY")) {
      const companies = await db.company.findMany({
        where: { isActive: true, ...(only?.length ? { ticker: { in: only } } : {}) },
        select: { id: true, ticker: true },
        orderBy: { ticker: "asc" },
      });
      log(options, `→ Refresh chart_series — ${companies.length} société(s)`);
      for (const co of companies) {
        if (timeLeft(startedAtMs, options.timeBudgetMs) < 4_000) {
          incomplete = true;
          nextSymbol = co.ticker;
          log(options, `⏱ Budget atteint avant ${co.ticker}`);
          break;
        }
        const { points, sources } = await loadCanonicalCompanyCloses(db, co.id);
        const n = await upsertRangeRows({
          db,
          kind: "COMPANY",
          symbol: co.ticker,
          companyId: co.id,
          full: dedupeChartPointsByDay(points),
          sources,
        });
        rowsUpserted += n;
        companiesUpdated++;
      }
    }

    if (!incomplete && kinds.has("INDEX")) {
      const indices = await db.marketIndex.findMany({
        where: only?.length ? { code: { in: only } } : undefined,
        select: { id: true, code: true },
        orderBy: { code: "asc" },
      });
      for (const idx of indices) {
        if (timeLeft(startedAtMs, options.timeBudgetMs) < 4_000) {
          incomplete = true;
          nextSymbol = idx.code;
          break;
        }
        const { points, sources } = await loadCanonicalIndexCloses(db, idx.id);
        const n = await upsertRangeRows({
          db,
          kind: "INDEX",
          symbol: idx.code,
          companyId: null,
          full: dedupeChartPointsByDay(points),
          sources,
        });
        rowsUpserted += n;
        indicesUpdated++;
      }
    }
  } catch (err) {
    if (isMissingDatabaseObject(err)) {
      skippedMissingTable = true;
      log(options, "→ chart_series absent (migration non appliquée) — skip refresh");
    } else {
      throw err;
    }
  }

  const finishedAt = new Date();
  log(
    options,
    `✔ chart_series sociétés=${companiesUpdated} indices=${indicesUpdated} lignes=${rowsUpserted}` +
      (incomplete ? ` · suite=${nextSymbol}` : "")
  );
  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAtMs,
    incomplete,
    nextSymbol,
    companiesUpdated,
    indicesUpdated,
    rowsUpserted,
    skippedMissingTable,
  };
}
