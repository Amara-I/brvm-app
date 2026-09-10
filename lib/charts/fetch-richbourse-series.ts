// Historique journalier Richbourse pour densifier le workbench /graphes
// lorsque la base ne contient que peu de clôtures (seed annuel / 1-2 jours)
// OU lorsqu'il reste de grands trous calendaires (ex. 2022 → 2026).

import { fetchHtml } from "@/lib/ingestion/http-client";
import { extractCloseSeriesFromHighcharts } from "@/lib/ingestion/connectors/richbourse_connector";
import type { ChartClosePoint } from "./indicators";

const BASE = "https://www.richbourse.com/common/mouvements/index";

/** Sous ce nombre de points, on densifie systématiquement. */
export const SPARSE_SERIES_THRESHOLD = 60;

/**
 * Au-delà de cet écart (jours calendaires) entre deux clôtures consécutives,
 * l'historique est considéré lacunaire — densification Sika / Richbourse.
 * ~14 j : laisse passer weekends/fériés courts ; un historique mensuel
 * (~28–31 j) déclenche bien le complément journalier 2024+.
 */
export const MAX_ACCEPTABLE_GAP_DAYS = 14;

function dayMs(iso: string): number {
  return Date.parse(iso.length === 10 ? `${iso}T00:00:00.000Z` : iso);
}

/** Écart max (jours) entre deux points consécutifs triés. */
export function maxSeriesGapDays(points: Array<{ time: string }>): number {
  if (points.length < 2) return 0;
  let max = 0;
  for (let i = 1; i < points.length; i++) {
    const gap = (dayMs(points[i]!.time) - dayMs(points[i - 1]!.time)) / 86_400_000;
    if (gap > max) max = gap;
  }
  return max;
}

/**
 * True si la série est trop courte OU présente un trou > MAX_ACCEPTABLE_GAP_DAYS.
 * Cas typique : cotations journalières 2026 + seed annuel → n ≥ 60 mais trou 2023–2025.
 */
export function seriesNeedsDensification(points: Array<{ time: string }>): boolean {
  if (points.length === 0) return true;
  if (points.length < SPARSE_SERIES_THRESHOLD) return true;
  return maxSeriesGapDays(points) > MAX_ACCEPTABLE_GAP_DAYS;
}

/** Récupère la série de clôtures (FCFA) embarquée dans le Highcharts Richbourse. */
export async function fetchRichbourseCloseSeries(ticker: string): Promise<ChartClosePoint[]> {
  const url = `${BASE}/${ticker.toUpperCase()}`;
  try {
    const html = await fetchHtml(url, { cacheTtlMs: 30 * 60 * 1000 });
    const points = extractCloseSeriesFromHighcharts(html);
    const now = Date.now();
    return points
      .filter((p) => p.ts <= now && p.value > 0)
      .map((p) => ({
        time: new Date(p.ts).toISOString().slice(0, 10),
        value: Math.round(p.value * 100) / 100,
        volume: null,
      }));
  } catch (err) {
    console.warn(`[charts] Richbourse series ${ticker}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Fusionne base locale + série Richbourse.
 * Priorité : densifier l'historique ; en cas de même date, garder le cours
 * de la base (souvent BRVM officiel après ingestion).
 */
export function mergeChartSeries(
  primary: ChartClosePoint[],
  denser: ChartClosePoint[]
): ChartClosePoint[] {
  if (denser.length === 0) return primary;
  if (primary.length === 0) return denser;

  const byDay = new Map<string, ChartClosePoint>();
  for (const p of denser) {
    byDay.set(p.time, { time: p.time, value: p.value, volume: p.volume ?? null });
  }
  for (const p of primary) {
    const prev = byDay.get(p.time);
    byDay.set(p.time, {
      time: p.time,
      value: p.value,
      volume: p.volume ?? prev?.volume ?? null,
    });
  }
  return [...byDay.values()].sort((a, b) => a.time.localeCompare(b.time));
}
