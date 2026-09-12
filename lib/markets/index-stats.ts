// Calculs purs sur une série d'indice (niveaux réels uniquement).

import { applyChartSeriesWindow } from "@/lib/charts/chart-window";
import type { ChartClosePoint, ChartRange } from "@/lib/charts/indicators";

export interface IndexHistoryPoint extends ChartClosePoint {
  changePercent?: number | null;
}

export interface IndexStats {
  lastValue: number | null;
  lastDate: string | null;
  prevValue: number | null;
  sessionChangePercent: number | null;
  change1MPercent: number | null;
  change3MPercent: number | null;
  changeYtdPercent: number | null;
  change1YPercent: number | null;
  high52w: number | null;
  low52w: number | null;
  historyPoints: number;
  firstDate: string | null;
}

function pctChange(from: number, to: number): number | null {
  if (!(from > 0) || !Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round(((to - from) / from) * 10000) / 100;
}

function valueAtOrBefore(series: IndexHistoryPoint[], iso: string): IndexHistoryPoint | null {
  let ref: IndexHistoryPoint | null = null;
  for (const point of series) {
    if (point.time <= iso) ref = point;
    else break;
  }
  return ref;
}

function shiftYears(iso: string, years: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function shiftMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function computeIndexStats(series: IndexHistoryPoint[]): IndexStats {
  const last = series[series.length - 1] ?? null;
  const prev = series.length >= 2 ? series[series.length - 2]! : null;
  const lastDate = last?.time ?? null;
  const lastValue = last && Number.isFinite(last.value) ? last.value : null;

  let sessionChangePercent: number | null = null;
  if (last && last.changePercent != null && Number.isFinite(last.changePercent)) {
    sessionChangePercent = last.changePercent;
  } else if (last && prev) {
    sessionChangePercent = pctChange(prev.value, last.value);
  }

  const changeVs = (targetIso: string | null): number | null => {
    if (!last || lastValue == null || !targetIso) return null;
    const ref = valueAtOrBefore(series, targetIso);
    if (!ref) return null;
    return pctChange(ref.value, lastValue);
  };

  let high52w: number | null = null;
  let low52w: number | null = null;
  if (lastDate) {
    const from52 = shiftYears(lastDate, -1);
    for (const point of series) {
      if (point.time < from52 || !Number.isFinite(point.value)) continue;
      high52w = high52w == null ? point.value : Math.max(high52w, point.value);
      low52w = low52w == null ? point.value : Math.min(low52w, point.value);
    }
  }

  return {
    lastValue,
    lastDate,
    prevValue: prev && Number.isFinite(prev.value) ? prev.value : null,
    sessionChangePercent,
    change1MPercent: lastDate ? changeVs(shiftMonths(lastDate, -1)) : null,
    change3MPercent: lastDate ? changeVs(shiftMonths(lastDate, -3)) : null,
    changeYtdPercent: lastDate ? changeVs(`${lastDate.slice(0, 4)}-01-01`) : null,
    change1YPercent: lastDate ? changeVs(shiftYears(lastDate, -1)) : null,
    high52w,
    low52w,
    historyPoints: series.length,
    firstDate: series[0]?.time ?? null,
  };
}

export function windowIndexSeries(
  series: IndexHistoryPoint[],
  range: ChartRange
): IndexHistoryPoint[] {
  return applyChartSeriesWindow(series, { range }).series;
}
