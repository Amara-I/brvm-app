/**
 * Fenêtrage des séries graphiques (API + UI).
 * Corrige le fait que GET /api/charts/[ticker] ignorait `range` / `from`
 * et renvoyait systématiquement tout l'historique densifié (20 ans).
 */

import {
  rangeFilter,
  type ChartClosePoint,
  type ChartRange,
} from "./indicators";

export const DEFAULT_CHART_RANGE: ChartRange = "1A";

const CHART_RANGES: readonly ChartRange[] = [
  "1J",
  "5J",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1A",
  "5A",
  "MAX",
];

const RANGE_ALIASES: Record<string, ChartRange> = {
  "1Y": "1A",
  "5Y": "5A",
  TOUT: "MAX",
  ALL: "MAX",
  MAX: "MAX",
};

const ISO_DAY = /^(\d{4}-\d{2}-\d{2})/;

export function isChartRange(value: string): value is ChartRange {
  return (CHART_RANGES as readonly string[]).includes(value);
}

/** Accepte 1A/1Y, 5A/5Y, MAX/TOUT/ALL, etc. */
export function parseChartRangeParam(raw: string | null | undefined): ChartRange | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toUpperCase();
  if (RANGE_ALIASES[key]) return RANGE_ALIASES[key];
  return isChartRange(key) ? key : undefined;
}

export function parseIsoDateParam(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const match = raw.trim().match(ISO_DAY);
  return match?.[1];
}

export function chartRangeCutoffIso(range: Exclude<ChartRange, "MAX">, asOf: Date): string {
  if (range === "YTD") return `${asOf.getUTCFullYear()}-01-01`;
  const cutoff = new Date(asOf);
  switch (range) {
    case "1J":
      cutoff.setUTCDate(cutoff.getUTCDate() - 1);
      break;
    case "5J":
      cutoff.setUTCDate(cutoff.getUTCDate() - 5);
      break;
    case "1M":
      cutoff.setUTCMonth(cutoff.getUTCMonth() - 1);
      break;
    case "3M":
      cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
      break;
    case "6M":
      cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
      break;
    case "1A":
      cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
      break;
    case "5A":
      cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 5);
      break;
  }
  return cutoff.toISOString().slice(0, 10);
}

export function lastPointAsOf(points: ChartClosePoint[], fallback = new Date()): Date {
  const last = points[points.length - 1]?.time;
  if (!last) return fallback;
  const iso = last.slice(0, 10);
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export interface ChartWindowQuery {
  range?: string | null;
  from?: string | null;
  to?: string | null;
  /** Si true (défaut), une requête sans range/from/to → 1A, pas tout l'historique. */
  defaultTo1A?: boolean;
}

export interface AppliedChartWindow {
  series: ChartClosePoint[];
  range: ChartRange | "CUSTOM";
  from: string | null;
  to: string | null;
}

/**
 * Applique `range` (1Y/1A/MAX…) et/ou `from`/`to` (YYYY-MM-DD).
 * - `from`/`to` définissent la fenêtre si présents (intersection si les deux).
 * - Sinon `range` (défaut 1A) — ancré sur le dernier point, pas l'horloge murale.
 */
export function applyChartSeriesWindow(
  points: ChartClosePoint[],
  query: ChartWindowQuery = {}
): AppliedChartWindow {
  if (points.length === 0) {
    return { series: points, range: DEFAULT_CHART_RANGE, from: null, to: null };
  }

  const from = parseIsoDateParam(query.from);
  const to = parseIsoDateParam(query.to);
  const parsedRange = parseChartRangeParam(query.range);
  const asOf = lastPointAsOf(points);
  const isoAsOf = asOf.toISOString().slice(0, 10);

  if (from || to) {
    const start = from ?? points[0]!.time;
    const end = to ?? isoAsOf;
    const lo = start <= end ? start : end;
    const hi = start <= end ? end : start;
    const series = points.filter((p) => p.time >= lo && p.time <= hi);
    return {
      series: series.length > 0 ? series : points.slice(-2),
      range: parsedRange && !from && !to ? parsedRange : "CUSTOM",
      from: lo,
      to: hi,
    };
  }

  const range =
    parsedRange ?? (query.defaultTo1A === false ? "MAX" : DEFAULT_CHART_RANGE);
  const series = rangeFilter(points, range, asOf);
  return {
    series,
    range,
    from: series[0]?.time ?? null,
    to: series[series.length - 1]?.time ?? null,
  };
}

/** Plage à demander à l'API : les fenêtres ≤ 1A partagent le même fetch. */
export function apiRangeForChartRange(range: ChartRange): ChartRange {
  if (range === "MAX") return "MAX";
  if (range === "5A") return "5A";
  return "1A";
}

/** La série déjà chargée suffit-elle à couvrir la fenêtre demandée (sans refetch) ? */
export function seriesCoversChartRange(
  points: ChartClosePoint[],
  range: ChartRange,
  historyComplete: boolean
): boolean {
  if (points.length === 0) return false;
  if (range === "MAX") return historyComplete;
  if (historyComplete) return true;
  const asOf = lastPointAsOf(points);
  const cutoff = chartRangeCutoffIso(range, asOf);
  return points[0]!.time <= cutoff;
}
