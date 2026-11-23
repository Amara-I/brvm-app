import { applyChartSeriesWindow, parseChartRangeParam, parseIsoDateParam } from "@/lib/charts/chart-window";
import type { ChartClosePoint, ChartRange } from "@/lib/charts/indicators";
import type { ChartSeriesQuery } from "@/lib/api/query-schemas";
import { ANON_MAX_CHART_RANGE, ANON_MAX_CHART_YEARS, isAnonChartRangeAllowed } from "./plans";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ANON_SPAN_DAYS = ANON_MAX_CHART_YEARS * 366;

export type CappedChartQuery = {
  range?: string;
  from?: string;
  to?: string;
  interval?: ChartSeriesQuery["interval"];
  capped: boolean;
};

function isoDaysApart(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.abs(b - a) / DAY_MS;
}

function addUtcDays(iso: string, days: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`);
  const d = new Date(t + days * DAY_MS);
  return d.toISOString().slice(0, 10);
}

/**
 * Plafonne une requête de graphe à 5 ans pour un visiteur.
 * Les fenêtres courtes et intermédiaires (1M, 3M, 1A, 3A, 5A, YTD…) sont conservées.
 * `from`/`to` trop larges sont ramenés à 5A (les bornes custom sont retirées
 * pour éviter de servir plus de cinq ans).
 */
export function capChartQueryForVisitor(query: ChartSeriesQuery): CappedChartQuery {
  const interval = query.interval;
  const parsed = parseChartRangeParam(query.range);
  const from = parseIsoDateParam(query.from);
  const to = parseIsoDateParam(query.to);

  if (from || to) {
    if (from && to && isoDaysApart(from, to) <= MAX_ANON_SPAN_DAYS) {
      return { from, to, interval, capped: false };
    }
    return { range: ANON_MAX_CHART_RANGE, interval, capped: true };
  }

  const rangeKey = parsed ?? query.range?.trim().toUpperCase();
  if (rangeKey && !isAnonChartRangeAllowed(rangeKey)) {
    return { range: ANON_MAX_CHART_RANGE, interval, capped: true };
  }

  return { range: query.range ?? ANON_MAX_CHART_RANGE, interval, capped: false };
}

export function capSeriesToAnonWindow<T extends ChartClosePoint>(points: T[]): T[] {
  return applyChartSeriesWindow(points, { range: ANON_MAX_CHART_RANGE }).series as T[];
}

export function isLockedChartRange(range: ChartRange | string): boolean {
  const raw = String(range).trim().toUpperCase();
  const parsed = parseChartRangeParam(raw);
  if (parsed) return !isAnonChartRangeAllowed(parsed);
  return !isAnonChartRangeAllowed(raw);
}

/** Retire lookback, profondeur d'historique et analyse d'un payload graphe visiteur. */
export function redactChartPayloadForVisitor<T extends Record<string, unknown>>(payload: T): T {
  const series = Array.isArray(payload.series) ? (payload.series as Array<{ time?: string }>) : [];
  const stats = payload.stats && typeof payload.stats === "object" ? (payload.stats as Record<string, unknown>) : null;
  const fundamentals =
    payload.fundamentals && typeof payload.fundamentals === "object"
      ? { ...(payload.fundamentals as Record<string, unknown>), per: null }
      : payload.fundamentals;
  const index =
    payload.index && typeof payload.index === "object"
      ? { ...(payload.index as Record<string, unknown>), storedHistoryPoints: series.length }
      : payload.index;
  const next: Record<string, unknown> = {
    ...payload,
    lookback: [],
    fundamentals,
    stats: stats
      ? {
          ...stats,
          historyPoints: series.length,
          historyFirstDate: series[0]?.time ?? stats.historyFirstDate,
          lookbackExhausted: true,
        }
      : payload.stats,
    index,
  };
  delete next.analysis;
  return next as T;
}
