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
import { adjustSeries, adjustmentFingerprint, splitSessionMissing } from "@/lib/corporate-actions/adjust";
import { actionsForTicker } from "@/lib/corporate-actions/load";
import { presentCompanyCloses } from "@/lib/corporate-actions/present-series";
import type { AdjustmentAction } from "@/lib/corporate-actions/types";
import { closeForSession, sessionDayChangePercent, type SessionCloseRow } from "@/lib/api/session-day-change";
import type { DataSourceCode } from "@/lib/ingestion/types";
import { dedupeChartPointsByDay } from "./indicators";

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
  /** Fractionnements actifs de ce titre (série déjà ramenée sur la nouvelle base). */
  corporateActions: AdjustmentAction[];
}

interface LatestCanonicalClose {
  date: string;
  close: number;
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

async function readRecentSessions(companyId: string): Promise<SessionCloseRow[]> {
  try {
    const rows = await prisma.priceHistory.findMany({
      where: { companyId, date: { lte: new Date() } },
      orderBy: { date: "desc" },
      take: 40,
      select: { date: true, closePrice: true, changePercent: true, source: true, isCanonical: true },
    });
    return rows
      .map((row) => ({
        date: row.date.toISOString().slice(0, 10),
        close: Number(row.closePrice),
        source: row.source as DataSourceCode,
        changePercent: row.changePercent != null ? Number(row.changePercent) : null,
        isCanonical: row.isCanonical,
      }))
      .filter((row) => row.close > 0);
  } catch (err) {
    if (isMissingDatabaseObject(err)) return [];
    throw err;
  }
}

function latestShownClose(sessions: SessionCloseRow[]): LatestCanonicalClose | null {
  const dates = [...new Set(sessions.map((row) => row.date))].sort();
  const date = dates[dates.length - 1];
  if (!date) return null;
  const row = closeForSession(sessions, date);
  if (!row) return null;
  return {
    date: row.date,
    close: row.close,
    changePercent: row.changePercent,
  };
}

function withFreshness(
  base: Omit<LoadedCompanyChartSeries, "stale" | "officialDayChangePercent">,
  latest: LatestCanonicalClose | null,
  sessionChange: number | null,
  forceStale = false
): LoadedCompanyChartSeries {
  const last = base.series[base.series.length - 1]?.time ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const splitPending = splitSessionMissing(base.series, base.corporateActions, today);
  return {
    ...base,
    stale: forceStale || splitPending || (base.fromCache && isChartSeriesStale(last, latest?.date ?? null)),
    officialDayChangePercent:
      sessionChange ?? (latest && last === latest.date ? (latest.changePercent ?? null) : null),
  };
}

/** Ajoute la dernière séance de price_history si le cache s'arrête avant. */
function overlayFreshClose(
  series: ChartClosePoint[],
  actions: AdjustmentAction[],
  latest: LatestCanonicalClose | null
): ChartClosePoint[] {
  if (!latest || !(latest.close > 0)) return series;
  const last = series[series.length - 1]?.time ?? "";
  if (last >= latest.date) return series;
  const adjusted = adjustSeries([{ time: latest.date, value: latest.close, volume: null }], actions);
  const point = adjusted[adjusted.length - 1];
  if (!point || !(point.value > 0)) return series;
  return dedupeChartPointsByDay([...series, point]);
}

export async function loadCompanyChartSeries(opts: {
  companyId: string;
  ticker: string;
  rangeParam?: string | null;
}): Promise<LoadedCompanyChartSeries> {
  const parsed = parseChartRangeParam(opts.rangeParam ?? undefined) ?? DEFAULT_CHART_RANGE;
  const cacheRangeKey = cacheRangeKeyForQuery(parsed);

  const [cached, sessions, actions] = await Promise.all([
    readCachedChartSeries(prisma, "COMPANY", opts.ticker, cacheRangeKey),
    readRecentSessions(opts.companyId),
    actionsForTicker(opts.ticker),
  ]);
  const latest = latestShownClose(sessions);
  const sessionChange = sessions.length > 0 ? sessionDayChangePercent(sessions, actions) : null;

  async function asPresented(
    points: ChartClosePoint[],
    meta: ChartSeriesMetaPayload | null,
    fromCache: boolean,
    rangeKey: ChartSeriesRangeKey
  ): Promise<LoadedCompanyChartSeries> {
    const fp = adjustmentFingerprint(actions);
    const already = meta?.adjustmentFingerprint === fp;
    const presented = already
      ? { points, actions, fingerprint: fp }
      : await presentCompanyCloses(prisma, opts.companyId, opts.ticker, points);
    const rawLast = presented.points[presented.points.length - 1]?.time ?? null;
    const cacheWasBehind = fromCache && isChartSeriesStale(rawLast, latest?.date ?? null);
    const series = overlayFreshClose(presented.points, presented.actions, latest);
    const sources = meta?.sources ?? [];
    return withFreshness(
      {
        series,
        dbSeries: toDbSeries(series, sources),
        fromCache,
        cacheRangeKey: rangeKey,
        // Meta recalculée sur la série brute : ne pas réutiliser les variations.
        meta: already && !cacheWasBehind ? meta : null,
        corporateActions: presented.actions,
      },
      latest,
      sessionChange,
      cacheWasBehind
    );
  }

  if (cached && cached.points.length > 0) {
    return asPresented(cached.points, cached.meta, true, cacheRangeKey);
  }

  if (cacheRangeKey !== "MAX") {
    const maxCached = await readCachedChartSeries(prisma, "COMPANY", opts.ticker, "MAX");
    if (maxCached && maxCached.points.length > 0) {
      return asPresented(maxCached.points, maxCached.meta, true, "MAX");
    }
  }

  try {
    const live = await loadLiveCanonical({ companyId: opts.companyId, rangeKey: cacheRangeKey });
    return asPresented(
      live.points,
      null,
      false,
      cacheRangeKey
    );
  } catch (err) {
    if (isMissingDatabaseObject(err)) {
      return withFreshness(
        {
          series: overlayFreshClose([], actions, latest),
          dbSeries: [],
          fromCache: false,
          cacheRangeKey,
          meta: null,
          corporateActions: actions,
        },
        latest,
        sessionChange
      );
    }
    throw err;
  }
}
