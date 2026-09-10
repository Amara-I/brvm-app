// Construction OHLC + filtres de période pour le workbench TradingView-like.

export interface ChartClosePoint {
  time: string;
  value: number;
  volume?: number | null;
}

export interface ChartCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export type ChartRange = "1J" | "5J" | "1M" | "3M" | "6M" | "YTD" | "1A" | "5A" | "MAX";

export function computeSma(points: ChartClosePoint[], period: number): ChartClosePoint[] {
  if (period < 2 || points.length < period) return [];
  const out: ChartClosePoint[] = [];
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    sum += points[i]!.value;
    if (i >= period) sum -= points[i - period]!.value;
    if (i >= period - 1) {
      out.push({ time: points[i]!.time, value: Math.round((sum / period) * 100) / 100 });
    }
  }
  return out;
}

export function normalizeTo100(points: ChartClosePoint[]): ChartClosePoint[] {
  const first = points.find((p) => p.value > 0);
  if (!first) return [];
  return points.map((p) => ({
    time: p.time,
    value: Math.round((p.value / first.value) * 10000) / 100,
    volume: p.volume,
  }));
}

/**
 * Une seule clôture par jour calendaire (YYYY-MM-DD).
 * En cas de doublon (ex. deux sources canoniques le même jour),
 * on conserve le dernier point de la série (déjà triée / densifiée).
 * Nécessaire pour lightweight-charts (temps strictement croissants).
 */
export function dedupeChartPointsByDay(points: ChartClosePoint[]): ChartClosePoint[] {
  if (points.length === 0) return points;
  const byDay = new Map<string, ChartClosePoint>();
  for (const p of points) {
    if (!(p.value > 0) || !p.time) continue;
    const day = p.time.slice(0, 10);
    byDay.set(day, {
      time: day,
      value: p.value,
      volume: p.volume ?? null,
    });
  }
  return [...byDay.values()].sort((a, b) => a.time.localeCompare(b.time));
}

/** À partir de clôtures seules : OHLC synthétique (O = clôture précédente). */
export function closesToCandles(points: ChartClosePoint[]): ChartCandle[] {
  const unique = dedupeChartPointsByDay(points);
  return unique.map((p, i) => {
    const prev = i > 0 ? unique[i - 1]!.value : p.value;
    const open = prev;
    const close = p.value;
    const high = Math.max(open, close);
    const low = Math.min(open, close);
    return {
      time: p.time,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: p.volume ?? null,
    };
  });
}

export function rangeFilter(points: ChartClosePoint[], range: ChartRange, asOf = new Date()): ChartClosePoint[] {
  if (range === "MAX" || points.length === 0) return points;
  const isoAsOf = asOf.toISOString().slice(0, 10);
  if (range === "YTD") {
    const ytd = `${asOf.getUTCFullYear()}-01-01`;
    return points.filter((p) => p.time >= ytd && p.time <= isoAsOf);
  }
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
  const iso = cutoff.toISOString().slice(0, 10);
  const filtered = points.filter((p) => p.time >= iso && p.time <= isoAsOf);
  // Si trop peu de points (historique annuel sparse), élargir jusqu'à avoir ≥ 2 points.
  if (filtered.length >= 2) return filtered;
  return points.slice(-Math.max(2, Math.min(points.length, 24)));
}

/** Alias rétrocompat pour les anciens appels 1Y/5Y/MAX. */
export function rangeFilterLegacy(
  points: ChartClosePoint[],
  range: "1Y" | "5Y" | "MAX",
  asOf = new Date()
): ChartClosePoint[] {
  const map: Record<"1Y" | "5Y" | "MAX", ChartRange> = { "1Y": "1A", "5Y": "5A", MAX: "MAX" };
  return rangeFilter(points, map[range], asOf);
}
