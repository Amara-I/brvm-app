// Charge la série graphe : cache `chart_series` d'abord, sinon agrégation live.

import { prisma } from "@/lib/prisma";
import { isMissingDatabaseObject } from "@/lib/db/is-database-unavailable";
import type { ChartClosePoint } from "./indicators";
import {
  cacheRangeKeyForQuery,
  CHART_CACHE_LOOKBACK_PAD_DAYS,
  extendCutoffIso,
  type ChartSeriesMetaPayload,
  type ChartSeriesRangeKey,
} from "./chart-series-cache";
import { chartRangeCutoffIso, parseChartRangeParam, DEFAULT_CHART_RANGE } from "./chart-window";
import { isChartSeriesStale } from "./chart-series-cache";
import { readCachedChartSeries } from "./refresh-chart-series";

export interface LoadedCompanyChartSeries {
  series: ChartClosePoint[];
  dbSeries: Array<ChartClosePoint & { source: string }>;
  fromCache: boolean;
  /** Vrai seulement si le cache existe et qu'une clôture canonique est plus récente. */
  stale: boolean;
  /** Variation officielle (`change_percent`) de la dernière clôture canonique. */
  officialDayChangePercent: number | null;
  cacheRangeKey: ChartSeriesRangeKey;
  meta: ChartSeriesMetaPayload | null;
}

interface LatestCanonicalClose {
  date: string;
  changePercent: number | null;
}

function toDbSeries(
  points: ChartClosePoint[],
  sources: string[]
): Array<ChartClosePoint & { source: string }> {
  const src = sources[0] ?? "BRVM_OFFICIEL";
  return points.map((p) => ({ ...p, source: src }));
}

async function loadLiveCanonical(opts: {
  companyId: string;
  rangeKey: ChartSeriesRangeKey;
}): Promise<{ points: ChartClosePoint[]; dbSeries: Array<ChartClosePoint & { source: string }> }> {
  const now = new Date();
  const dateFilter =
    opts.rangeKey === "MAX"
      ? { lte: now }
      : {
          lte: now,
          gte: new Date(
            `${extendCutoffIso(chartRangeCutoffIso(opts.rangeKey === "SPARK" ? "1A" : opts.rangeKey, now), CHART_CACHE_LOOKBACK_PAD_DAYS)}T00:00:00.000Z`
          ),
        };

  const prices = await prisma.priceHistory.findMany({
    where: { companyId: opts.companyId, isCanonical: true, date: dateFilter },
    orderBy: { date: "asc" },
    select: { date: true, closePrice: true, volume: true, source: true },
  });

  const dbByDay = new Map<string, ChartClosePoint & { source: string }>();
  const nowMs = now.getTime();
  for (const p of prices) {
    if (p.date.getTime() > nowMs) continue;
    const time = p.date.toISOString().slice(0, 10);
    dbByDay.set(time, {
      time,
      value: Number(p.closePrice),
      volume: p.volume !== null ? Number(p.volume) : null,
      source: p.source,
    });
  }
  const dbSeries = [...dbByDay.values()].sort((a, b) => a.time.localeCompare(b.time));
  return {
    points: dbSeries.map(({ time, value, volume }) => ({ time, value, volume })),
    dbSeries,
  };
}

async function readLatestCanonicalClose(companyId: string): Promise<LatestCanonicalClose | null> {
  try {
    const row = await prisma.priceHistory.findFirst({
      where: { companyId, isCanonical: true, date: { lte: new Date() } },
      orderBy: { date: "desc" },
      select: { date: true, changePercent: true },
    });
    if (!row) return null;
    return {
      date: row.date.toISOString().slice(0, 10),
      changePercent:
        row.changePercent != null ? Math.round(Number(row.changePercent) * 100) / 100 : null,
    };
  } catch (err) {
    if (isMissingDatabaseObject(err)) return null;
    throw err;
  }
}

function withFreshness(
  base: Omit<LoadedCompanyChartSeries, "stale" | "officialDayChangePercent">,
  latest: LatestCanonicalClose | null
): LoadedCompanyChartSeries {
  const last = base.series[base.series.length - 1]?.time ?? null;
  return {
    ...base,
    stale: base.fromCache && isChartSeriesStale(last, latest?.date ?? null),
    officialDayChangePercent: latest?.changePercent ?? null,
  };
}

export async function loadCompanyChartSeries(opts: {
  companyId: string;
  ticker: string;
  rangeParam?: string | null;
}): Promise<LoadedCompanyChartSeries> {
  const parsed = parseChartRangeParam(opts.rangeParam ?? undefined) ?? DEFAULT_CHART_RANGE;
  const cacheRangeKey = cacheRangeKeyForQuery(parsed);

  const [cached, latest] = await Promise.all([
    readCachedChartSeries(prisma, "COMPANY", opts.ticker, cacheRangeKey),
    readLatestCanonicalClose(opts.companyId),
  ]);

  if (cached && cached.points.length > 0) {
    const sources = cached.meta?.sources ?? [];
    return withFreshness(
      {
        series: cached.points,
        dbSeries: toDbSeries(cached.points, sources),
        fromCache: true,
        cacheRangeKey,
        meta: cached.meta,
      },
      latest
    );
  }

  if (cacheRangeKey !== "MAX") {
    const maxCached = await readCachedChartSeries(prisma, "COMPANY", opts.ticker, "MAX");
    if (maxCached && maxCached.points.length > 0) {
      const sources = maxCached.meta?.sources ?? [];
      return withFreshness(
        {
          series: maxCached.points,
          dbSeries: toDbSeries(maxCached.points, sources),
          fromCache: true,
          cacheRangeKey: "MAX",
          meta: maxCached.meta,
        },
        latest
      );
    }
  }

  try {
    const live = await loadLiveCanonical({ companyId: opts.companyId, rangeKey: cacheRangeKey });
    return withFreshness(
      {
        series: live.points,
        dbSeries: live.dbSeries,
        fromCache: false,
        cacheRangeKey,
        meta: null,
      },
      latest
    );
  } catch (err) {
    if (isMissingDatabaseObject(err)) {
      return withFreshness(
        {
          series: [],
          dbSeries: [],
          fromCache: false,
          cacheRangeKey,
          meta: null,
        },
        latest
      );
    }
    throw err;
  }
}
