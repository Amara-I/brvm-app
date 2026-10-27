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
import { presentCompanyCloses } from "../corporate-actions/present-series";
import { adjustSeries, adjustmentFingerprint } from "../corporate-actions/adjust";
import { actionsByTicker } from "../corporate-actions/load";
import type { AdjustmentAction } from "../corporate-actions/types";

export interface RefreshChartSeriesOptions {
  symbols?: string[];
  kinds?: ChartSeriesKindCode[];
  /** Sans symboles explicites, seules les séries de cette place sont reconstruites (défaut BRVM). */
  exchange?: "BRVM" | "NGX";
  timeBudgetMs?: number;
  /** Ne traite que les symboles strictement après celui-ci (reprise). */
  after?: string;
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
  exchange?: "BRVM" | "NGX";
  full: ChartClosePoint[];
  sources: string[];
  adjustmentFingerprint?: string;
}): Promise<number> {
  const { db, kind, symbol, companyId, full, sources } = opts;
  const exchange = opts.exchange ?? "BRVM";
  const meta: ChartSeriesMetaPayload = {
    ...buildChartSeriesMeta(full, sources),
    ...(opts.adjustmentFingerprint ? { adjustmentFingerprint: opts.adjustmentFingerprint } : {}),
  };
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
        exchange,
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
        exchange,
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
      where: { kind: "COMPANY", rangeKey: "SPARK", company: { exchange: "BRVM" } },
      select: { symbol: true, points: true, pointCount: true, meta: true },
    });
    if (rows.length === 0) return null;
    const byTicker = await actionsByTicker();
    const out: Record<string, ChartClosePoint[]> = {};
    for (const row of rows) {
      if (row.pointCount === 0) continue;
      const actions = byTicker.get(row.symbol) ?? [];
      const fp = adjustmentFingerprint(actions);
      const meta = (row.meta ?? null) as ChartSeriesMetaPayload | null;
      const points = fromCompactPoints(row.points);
      out[row.symbol] = meta?.adjustmentFingerprint === fp ? points : adjustSeries(points, actions);
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch (err) {
    if (isMissingDatabaseObject(err)) return null;
    throw err;
  }
}

/** Série à reconstruire : cache absent, plus vieux que la clôture, ou fractionnement non appliqué. */
export function chartSeriesNeedsRebuild(input: {
  cacheLastDate: string | null;
  latestCloseDate: string | null;
  cacheFingerprint: string | null | undefined;
  actionsFingerprint: string;
}): boolean {
  if (!input.latestCloseDate) return !input.cacheLastDate;
  if (!input.cacheLastDate || input.latestCloseDate > input.cacheLastDate) return true;
  if (input.actionsFingerprint === "none") return false;
  return (input.cacheFingerprint ?? null) !== input.actionsFingerprint;
}

/**
 * Ajoute les dernières clôtures brutes à une série en cache.
 * Empreinte identique : les points déjà ajustés ne sont pas redivisés.
 * Empreinte absente ou différente : la série en cache est traitée comme brute.
 */
export function mergeTipPoints(opts: {
  cached: ChartClosePoint[];
  cachedFingerprint: string | null | undefined;
  newRaw: ChartClosePoint[];
  contextRaw: ChartClosePoint[];
  actions: AdjustmentAction[];
}): { points: ChartClosePoint[]; fingerprint: string } {
  const fp = adjustmentFingerprint(opts.actions);
  const matches = opts.cachedFingerprint === fp || (opts.cachedFingerprint == null && fp === "none");
  if (!matches) {
    return {
      points: adjustSeries(dedupeChartPointsByDay([...opts.cached, ...opts.newRaw]), opts.actions),
      fingerprint: fp,
    };
  }
  const adjusted = adjustSeries(dedupeChartPointsByDay([...opts.contextRaw, ...opts.newRaw]), opts.actions);
  const last = opts.cached[opts.cached.length - 1]?.time ?? "";
  const byDay = new Map(opts.cached.map((point) => [point.time.slice(0, 10), point]));
  for (const point of adjusted) {
    if (!last || point.time >= last) byDay.set(point.time.slice(0, 10), point);
  }
  return {
    points: [...byDay.values()].sort((a, b) => a.time.localeCompare(b.time)),
    fingerprint: fp,
  };
}

function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function loadClosesSince(
  db: PrismaClient,
  kind: ChartSeriesKindCode,
  id: string,
  sinceIso: string
): Promise<ChartClosePoint[]> {
  const since = new Date(`${sinceIso}T00:00:00.000Z`);
  const now = new Date();
  if (kind === "COMPANY") {
    const rows = await db.priceHistory.findMany({
      where: { companyId: id, isCanonical: true, date: { gte: since, lte: now } },
      orderBy: { date: "asc" },
      select: { date: true, closePrice: true, volume: true },
    });
    return rows.map((row) => ({
      time: isoDate(row.date),
      value: Number(row.closePrice),
      volume: row.volume != null ? Number(row.volume) : null,
    }));
  }
  const rows = await db.marketIndexValue.findMany({
    where: { marketIndexId: id, isCanonical: true, date: { gte: since, lte: now } },
    orderBy: { date: "asc" },
    select: { date: true, value: true, volume: true },
  });
  return rows.map((row) => ({
    time: isoDate(row.date),
    value: Number(row.value),
    volume: row.volume != null ? Number(row.volume) : null,
  }));
}

export interface TipChartSeriesOptions {
  companyTickers?: string[];
  indexCodes?: string[];
  timeBudgetMs?: number;
  logger?: (msg: string) => void;
}

/** Incrémental : seules les séances après `lastDate` du cache, fractionnement appliqué. */
export async function tipLatestChartPoints(
  options: TipChartSeriesOptions = {},
  db: PrismaClient = prisma
): Promise<RefreshChartSeriesSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date();
  let companiesUpdated = 0;
  let indicesUpdated = 0;
  let rowsUpserted = 0;
  let incomplete = false;
  let nextSymbol: string | null = null;
  let skippedMissingTable = false;
  const logTip = (msg: string) => (options.logger ?? console.log)(msg);

  const companies = [...new Set((options.companyTickers ?? []).map((t) => t.toUpperCase()))].sort();
  const indices = [...new Set((options.indexCodes ?? []).map((t) => t.toUpperCase()))].sort();

  try {
    const actionMap = companies.length > 0 ? await actionsByTicker() : new Map();
    const companyRows = companies.length
      ? await db.company.findMany({
          where: { isActive: true, ticker: { in: companies } },
          select: { id: true, ticker: true, exchange: true },
        })
      : [];
    const companyByTicker = new Map(companyRows.map((row) => [row.ticker, row]));

    for (const ticker of companies) {
      if (timeLeft(startedAtMs, options.timeBudgetMs) < 400) {
        incomplete = true;
        nextSymbol = ticker;
        break;
      }
      const company = companyByTicker.get(ticker);
      if (!company) continue;
      const actions = actionMap.get(ticker) ?? [];
      const cached = await readCachedChartSeries(db, "COMPANY", ticker, "MAX");
      if (!cached) {
        logTip(`[charts] ${ticker} sans cache — pas de rebuild complet dans le cron`);
        continue;
      }
      const last = cached.points[cached.points.length - 1]?.time ?? null;
      const since = last ? shiftIsoDate(last, -8) : "1990-01-01";
      const raw = dedupeChartPointsByDay(await loadClosesSince(db, "COMPANY", company.id, since));
      const newer = last ? raw.some((point) => point.time > last) : raw.length > 0;
      const fp = adjustmentFingerprint(actions);
      const fpMismatch = (cached.meta?.adjustmentFingerprint ?? null) !== fp && fp !== "none";
      if (!newer && !fpMismatch) continue;
      const contextRaw = last ? raw.filter((point) => point.time <= last) : [];
      const newRaw = last ? raw.filter((point) => point.time > last) : raw;
      const merged = mergeTipPoints({
        cached: cached.points,
        cachedFingerprint: cached.meta?.adjustmentFingerprint,
        newRaw,
        contextRaw,
        actions,
      });
      const n = await upsertRangeRows({
        db,
        kind: "COMPANY",
        symbol: ticker,
        companyId: company.id,
        exchange: company.exchange,
        full: merged.points,
        sources: cached.meta?.sources ?? [],
        adjustmentFingerprint: merged.fingerprint,
      });
      rowsUpserted += n;
      companiesUpdated++;
    }

    if (!incomplete && indices.length > 0) {
      const indexRows = await db.marketIndex.findMany({
        where: { code: { in: indices } },
        select: { id: true, code: true, exchange: true },
      });
      const indexByCode = new Map(indexRows.map((row) => [row.code, row]));
      for (const code of indices) {
        if (timeLeft(startedAtMs, options.timeBudgetMs) < 400) {
          incomplete = true;
          nextSymbol = code;
          break;
        }
        const index = indexByCode.get(code);
        if (!index) continue;
        const cached = await readCachedChartSeries(db, "INDEX", code, "MAX");
        if (!cached) continue;
        const last = cached.points[cached.points.length - 1]?.time ?? null;
        const since = last ? shiftIsoDate(last, -8) : "1990-01-01";
        const raw = dedupeChartPointsByDay(await loadClosesSince(db, "INDEX", index.id, since));
        const newer = last ? raw.some((point) => point.time > last) : raw.length > 0;
        if (!newer) continue;
        const merged = mergeTipPoints({
          cached: cached.points,
          cachedFingerprint: cached.meta?.adjustmentFingerprint ?? "none",
          newRaw: last ? raw.filter((point) => point.time > last) : raw,
          contextRaw: last ? raw.filter((point) => point.time <= last) : [],
          actions: [],
        });
        const n = await upsertRangeRows({
          db,
          kind: "INDEX",
          symbol: code,
          companyId: null,
          exchange: index.exchange,
          full: merged.points,
          sources: cached.meta?.sources ?? [],
          adjustmentFingerprint: merged.fingerprint,
        });
        rowsUpserted += n;
        indicesUpdated++;
      }
    }
  } catch (err) {
    if (isMissingDatabaseObject(err)) {
      skippedMissingTable = true;
      logTip("→ chart_series absent — skip tip");
    } else {
      throw err;
    }
  }

  const finishedAt = new Date();
  logTip(
    `✔ tip chart_series sociétés=${companiesUpdated} indices=${indicesUpdated} lignes=${rowsUpserted}` +
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

async function keepStaleSymbols(
  db: PrismaClient,
  kind: ChartSeriesKindCode,
  symbols: Array<{ id: string; symbol: string }>,
  actionsFor: (symbol: string) => AdjustmentAction[]
): Promise<Array<{ id: string; symbol: string }>> {
  if (symbols.length === 0) return symbols;
  const names = symbols.map((row) => row.symbol);
  const caches = await db.chartSeries.findMany({
    where: { kind, rangeKey: "MAX", symbol: { in: names } },
    select: { symbol: true, lastDate: true, meta: true },
  });
  const cacheBySymbol = new Map(caches.map((row) => [row.symbol, row]));
  let latest = new Map<string, string>();
  if (kind === "COMPANY") {
    const rows = await db.$queryRaw<Array<{ symbol: string; last_date: Date }>>`
      SELECT c.ticker AS symbol, MAX(ph.date) AS last_date
      FROM "companies" c
      JOIN "price_history" ph ON ph.company_id = c.id
      WHERE ph.is_canonical = true
        AND ph.date <= CURRENT_DATE
        AND c.ticker IN (${Prisma.join(names)})
      GROUP BY c.ticker
    `;
    latest = new Map(rows.map((row) => [row.symbol, isoDate(row.last_date)]));
  } else {
    const rows = await db.$queryRaw<Array<{ symbol: string; last_date: Date }>>`
      SELECT mi.code AS symbol, MAX(v.date) AS last_date
      FROM "market_indices" mi
      JOIN "market_index_values" v ON v.market_index_id = mi.id
      WHERE v.is_canonical = true
        AND v.date <= CURRENT_DATE
        AND mi.code IN (${Prisma.join(names)})
      GROUP BY mi.code
    `;
    latest = new Map(rows.map((row) => [row.symbol, isoDate(row.last_date)]));
  }
  return symbols.filter((row) => {
    const cache = cacheBySymbol.get(row.symbol);
    const meta = (cache?.meta ?? null) as ChartSeriesMetaPayload | null;
    return chartSeriesNeedsRebuild({
      cacheLastDate: cache?.lastDate ? isoDate(cache.lastDate) : null,
      latestCloseDate: latest.get(row.symbol) ?? null,
      cacheFingerprint: meta?.adjustmentFingerprint,
      actionsFingerprint: adjustmentFingerprint(actionsFor(row.symbol)),
    });
  });
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

  const exchangeScope = options.exchange ?? (only?.length ? undefined : "BRVM");

  try {
    if (kinds.has("COMPANY")) {
      const after = options.after?.toUpperCase() ?? "";
      let companies = await db.company.findMany({
        where: {
          isActive: true,
          ...(exchangeScope ? { exchange: exchangeScope } : {}),
          ...(only?.length ? { ticker: { in: only } } : {}),
        },
        select: { id: true, ticker: true, exchange: true },
        orderBy: { ticker: "asc" },
      });
      if (after) companies = companies.filter((row) => row.ticker > after);
      try {
        const actionMap = await actionsByTicker();
        const stale = await keepStaleSymbols(
          db,
          "COMPANY",
          companies.map((row) => ({ id: row.id, symbol: row.ticker })),
          (symbol) => actionMap.get(symbol) ?? []
        );
        const staleTickers = new Set(stale.map((row) => row.symbol));
        companies = companies.filter((row) => staleTickers.has(row.ticker));
      } catch (err) {
        if (!isMissingDatabaseObject(err)) {
          log(options, `fraîcheur chart_series ignorée : ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      log(options, `→ Refresh chart_series — ${companies.length} société(s) à reconstruire`);
      for (const co of companies) {
        if (timeLeft(startedAtMs, options.timeBudgetMs) < 4_000) {
          incomplete = true;
          nextSymbol = co.ticker;
          log(options, `⏱ Budget atteint avant ${co.ticker}`);
          break;
        }
        const { points, sources } = await loadCanonicalCompanyCloses(db, co.id);
        const presented = await presentCompanyCloses(db, co.id, co.ticker, dedupeChartPointsByDay(points));
        const n = await upsertRangeRows({
          db,
          kind: "COMPANY",
          symbol: co.ticker,
          companyId: co.id,
          exchange: co.exchange,
          full: presented.points,
          sources,
          adjustmentFingerprint: presented.fingerprint,
        });
        rowsUpserted += n;
        companiesUpdated++;
      }
    }

    if (!incomplete && kinds.has("INDEX")) {
      const after = options.after?.toUpperCase() ?? "";
      let indices = await db.marketIndex.findMany({
        where: {
          ...(exchangeScope ? { exchange: exchangeScope } : {}),
          ...(only?.length ? { code: { in: only } } : {}),
        },
        select: { id: true, code: true, exchange: true },
        orderBy: { code: "asc" },
      });
      if (after && !kinds.has("COMPANY")) indices = indices.filter((row) => row.code > after);
      try {
        const stale = await keepStaleSymbols(
          db,
          "INDEX",
          indices.map((row) => ({ id: row.id, symbol: row.code })),
          () => []
        );
        const staleCodes = new Set(stale.map((row) => row.symbol));
        indices = indices.filter((row) => staleCodes.has(row.code));
      } catch (err) {
        if (!isMissingDatabaseObject(err)) {
          log(options, `fraîcheur indices ignorée : ${err instanceof Error ? err.message : String(err)}`);
        }
      }
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
          exchange: idx.exchange,
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
