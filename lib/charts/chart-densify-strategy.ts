/**
 * Stratégie de densification graphes : réutiliser l'historique déjà connu,
 * ne demander aux sources externes que les séances nouvelles (ou les trous).
 */

import {
  seriesNeedsDensification,
  SPARSE_SERIES_THRESHOLD,
} from "@/lib/charts/fetch-richbourse-series";
import { SIKA_DETAILED_DAILY_FROM } from "@/lib/charts/fetch-sikafinance-series";
import type { ChartClosePoint } from "@/lib/charts/indicators";
import { shouldSkipLiveDensify } from "@/lib/charts/chart-densify-cache";

export function addCalendarDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Fusionne deux séries ; en cas de même jour, `preferred` gagne. */
export function mergeChartPointsPrefer(
  preferred: ChartClosePoint[],
  fallback: ChartClosePoint[]
): ChartClosePoint[] {
  const byDay = new Map<string, ChartClosePoint>();
  for (const p of fallback) byDay.set(p.time, p);
  for (const p of preferred) byDay.set(p.time, p);
  return [...byDay.values()].sort((a, b) => a.time.localeCompare(b.time));
}

export type ChartDensifyPlan =
  | { mode: "none" }
  /** Uniquement les séances après le dernier point connu. */
  | { mode: "tip"; dailyFrom: string }
  /** Premier remplissage / trous historiques. */
  | {
      mode: "fill";
      dailyFrom: string;
      fetchAnnual: boolean;
      fetchRich: boolean;
      fetchOuestbourse: boolean;
    };

/**
 * @param dbSeries série déjà en base
 * @param cachedLen longueur d'un cache densifié encore valide (0 si aucun)
 */
export function planChartDensify(
  dbSeries: Array<{ time: string }>,
  cachedLen = 0
): ChartDensifyPlan {
  if (shouldSkipLiveDensify()) return { mode: "none" };

  const today = todayIsoUtc();
  const lastDb = dbSeries.length > 0 ? dbSeries[dbSeries.length - 1]!.time : null;

  // Historique densifié déjà en mémoire → seulement le complément tip.
  if (cachedLen >= SPARSE_SERIES_THRESHOLD) {
    const tipFrom = lastDb ? addCalendarDays(lastDb, -3) : addCalendarDays(today, -14);
    if (lastDb && lastDb >= today) return { mode: "none" };
    return { mode: "tip", dailyFrom: tipFrom };
  }

  if (dbSeries.length === 0) {
    return {
      mode: "fill",
      dailyFrom: SIKA_DETAILED_DAILY_FROM,
      fetchAnnual: true,
      fetchRich: true,
      fetchOuestbourse: true,
    };
  }

  if (!seriesNeedsDensification(dbSeries)) {
    if (lastDb && lastDb >= today) return { mode: "none" };
    return { mode: "tip", dailyFrom: addCalendarDays(lastDb!, -3) };
  }

  // Trous / série courte : un fill est nécessaire, mais on évite l'annuel
  // si la base couvre déjà plusieurs années.
  const years = new Set(dbSeries.map((p) => p.time.slice(0, 4)));
  return {
    mode: "fill",
    dailyFrom: SIKA_DETAILED_DAILY_FROM,
    fetchAnnual: years.size < 6,
    fetchRich: true,
    fetchOuestbourse: true,
  };
}
