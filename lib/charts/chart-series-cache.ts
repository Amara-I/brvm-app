/**
 * Cache disque (table `chart_series`) : séries compactes par ticker / indice
 * et par fenêtre (1M, 3M, 1A, 5A, MAX, SPARK).
 */

import {
  applyChartSeriesWindow,
  chartRangeCutoffIso,
  lastPointAsOf,
  parseChartRangeParam,
  type AppliedChartWindow,
} from "./chart-window";
import { downsampleLttb } from "./downsample";
import { chartDbFingerprint } from "./chart-densify-cache";
import { dedupeChartPointsByDay, type ChartClosePoint, type ChartRange } from "./indicators";

export const CHART_SERIES_RANGE_KEYS = ["1M", "3M", "6M", "1A", "5A", "MAX", "SPARK"] as const;
export type ChartSeriesRangeKey = (typeof CHART_SERIES_RANGE_KEYS)[number];

/** Padding lookback (SMA 200 j) stocké avec les fenêtres ≤ 5A. */
export const CHART_CACHE_LOOKBACK_PAD_DAYS = 420;

export type ChartSeriesKindCode = "COMPANY" | "INDEX";

export interface ChartSeriesMetaPayload {
  lastClose: number | null;
  lastDate: string | null;
  firstDate: string | null;
  historyPoints: number;
  historyFirstDate: string | null;
  historyLastDate: string | null;
  dayChangePercent: number | null;
  dayChangeAbs: number | null;
  change1YPercent: number | null;
  lastVolume: number | null;
  sources: string[];
  yearlyCloses: Record<string, number>;
}

export interface CompactChartPoint {
  t: string;
  v: number;
  q?: number;
}

export function toCompactPoints(points: ChartClosePoint[]): CompactChartPoint[] {
  return points.map((p) => {
    const row: CompactChartPoint = { t: p.time.slice(0, 10), v: p.value };
    if (p.volume != null && Number.isFinite(p.volume) && p.volume > 0) {
      row.q = p.volume;
    }
    return row;
  });
}

export function fromCompactPoints(raw: unknown): ChartClosePoint[] {
  if (!Array.isArray(raw)) return [];
  const out: ChartClosePoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const time = typeof rec.t === "string" ? rec.t : typeof rec.time === "string" ? rec.time : "";
    const value = typeof rec.v === "number" ? rec.v : typeof rec.value === "number" ? rec.value : NaN;
    if (!time || !(value > 0)) continue;
    const volume =
      typeof rec.q === "number" ? rec.q : typeof rec.volume === "number" ? rec.volume : null;
    out.push({ time: time.slice(0, 10), value, volume });
  }
  return dedupeChartPointsByDay(out);
}

export function cacheRangeKeyForQuery(range: ChartRange | "CUSTOM" | string | undefined): ChartSeriesRangeKey {
  const parsed = typeof range === "string" ? parseChartRangeParam(range) ?? range : range;
  if (parsed === "MAX") return "MAX";
  if (parsed === "5A") return "5A";
  if (parsed === "3M") return "3M";
  if (parsed === "1M" || parsed === "1J" || parsed === "5J") return "1M";
  if (parsed === "6M") return "6M";
  return "1A";
}

export function extendCutoffIso(cutoffIso: string, padDays: number): string {
  const d = new Date(`${cutoffIso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - padDays);
  return d.toISOString().slice(0, 10);
}

export function sliceForCacheRange(
  full: ChartClosePoint[],
  rangeKey: ChartSeriesRangeKey
): ChartClosePoint[] {
  if (full.length === 0) return [];
  if (rangeKey === "MAX") return full;
  if (rangeKey === "SPARK") {
    const year = applyChartSeriesWindow(full, { range: "1A" }).series;
    const shape = downsampleLttb(full, 64);
    const recent = applyChartSeriesWindow(full, { range: "3M" }).series;
    return dedupeChartPointsByDay([...shape, ...year.slice(-80), ...recent]);
  }
  const asOf = lastPointAsOf(full);
  const cutoff = chartRangeCutoffIso(rangeKey, asOf);
  const from = extendCutoffIso(cutoff, CHART_CACHE_LOOKBACK_PAD_DAYS);
  return full.filter((p) => p.time >= from);
}

export function buildChartSeriesMeta(
  full: ChartClosePoint[],
  sources: string[] = []
): ChartSeriesMetaPayload {
  const last = full[full.length - 1] ?? null;
  const prev = full.length >= 2 ? full[full.length - 2]! : null;
  const historyFirstDate = full[0]?.time ?? null;
  const historyLastDate = last?.time ?? null;
  const dayChangePercent =
    last && prev && prev.value > 0
      ? Math.round(((last.value - prev.value) / prev.value) * 10000) / 100
      : null;
  const dayChangeAbs = last && prev ? Math.round((last.value - prev.value) * 100) / 100 : null;
  let change1YPercent: number | null = null;
  if (last) {
    const target = new Date(last.time);
    target.setUTCFullYear(target.getUTCFullYear() - 1);
    const targetIso = target.toISOString().slice(0, 10);
    let ref = full[0]!;
    for (const p of full) {
      if (p.time <= targetIso) ref = p;
      else break;
    }
    if (ref.value > 0) {
      change1YPercent = Math.round(((last.value - ref.value) / ref.value) * 10000) / 100;
    }
  }
  const yearlyCloses: Record<string, number> = {};
  for (const p of full) {
    yearlyCloses[p.time.slice(0, 4)] = p.value;
  }
  return {
    lastClose: last?.value ?? null,
    lastDate: last?.time ?? null,
    firstDate: historyFirstDate,
    historyPoints: full.length,
    historyFirstDate,
    historyLastDate,
    dayChangePercent,
    dayChangeAbs,
    change1YPercent,
    lastVolume: last?.volume ?? null,
    sources,
    yearlyCloses,
  };
}

export function windowCachedSeries(
  stored: ChartClosePoint[],
  query: { range?: string | null; from?: string | null; to?: string | null }
): AppliedChartWindow {
  return applyChartSeriesWindow(stored, query);
}

export function fingerprintForSeries(points: ChartClosePoint[]): string {
  return chartDbFingerprint(points);
}

export function isChartSeriesRangeKey(value: string): value is ChartSeriesRangeKey {
  return (CHART_SERIES_RANGE_KEYS as readonly string[]).includes(value);
}
