/**
 * Densification / croisement multi-source pour les graphes.
 * Règle alignée sur `lib/ingestion/reconciliation.ts` :
 * BRVM_OFFICIEL > SIKAFINANCE > OUESTBOURSE > RICHBOURSE > MANUEL.
 * Un point déjà présent en base (canonique) n'est JAMAIS écrasé.
 */

import {
  DISCREPANCY_THRESHOLD_PERCENT,
  SOURCE_PRIORITY,
} from "@/lib/ingestion/reconciliation";
import type { DataSourceCode } from "@/lib/ingestion/types";
import type { ChartClosePoint } from "./indicators";

export type ChartPointSource = DataSourceCode | "DB_CANONICAL";

export interface SourcedChartPoint extends ChartClosePoint {
  source: ChartPointSource;
}

export interface ChartSeriesDiscrepancy {
  date: string;
  field: "close_price";
  retainedSource: ChartPointSource;
  retainedValue: number;
  rejectedSource: ChartPointSource;
  rejectedValue: number;
  deltaPercent: number;
}

export interface ReconcileChartSeriesResult {
  series: ChartClosePoint[];
  discrepancies: ChartSeriesDiscrepancy[];
  /** Sources ayant contribué au moins un point retenu. */
  sourcesUsed: ChartPointSource[];
}

function sourceRank(source: ChartPointSource): number {
  if (source === "DB_CANONICAL") return -1; // toujours au-dessus
  const idx = SOURCE_PRIORITY.indexOf(source);
  return idx === -1 ? SOURCE_PRIORITY.length : idx;
}

function deltaPercent(a: number, b: number): number {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  if (min === 0) return max === 0 ? 0 : 100;
  return Math.abs((max - min) / min) * 100;
}

function toSourced(
  points: ChartClosePoint[],
  source: ChartPointSource
): SourcedChartPoint[] {
  return points
    .filter((p) => p.value > 0 && Boolean(p.time))
    .map((p) => ({
      time: p.time,
      value: p.value,
      volume: p.volume ?? null,
      source,
    }));
}

/**
 * Fusionne série canonique (base) + densifications Sika / Richbourse.
 * - Dates en base : valeur base conservée ; écart > seuil vs secondaire → rapport.
 * - Dates absentes de la base : priorité Sika > Rich ; écart entre secondaires → rapport.
 */
export function reconcileChartSeries(input: {
  canonical: ChartClosePoint[];
  sikafinance?: ChartClosePoint[];
  ouestbourse?: ChartClosePoint[];
  richbourse?: ChartClosePoint[];
  /** Source déclarée des points canoniques (pour les rapports). Défaut DB_CANONICAL. */
  canonicalSource?: ChartPointSource;
  thresholdPercent?: number;
}): ReconcileChartSeriesResult {
  const threshold = input.thresholdPercent ?? DISCREPANCY_THRESHOLD_PERCENT;
  const canonicalSource = input.canonicalSource ?? "DB_CANONICAL";

  const byDay = new Map<string, SourcedChartPoint>();
  const discrepancies: ChartSeriesDiscrepancy[] = [];

  for (const p of toSourced(input.canonical, canonicalSource)) {
    byDay.set(p.time, p);
  }

  const secondaries: SourcedChartPoint[] = [
    ...toSourced(input.sikafinance ?? [], "SIKAFINANCE"),
    ...toSourced(input.ouestbourse ?? [], "OUESTBOURSE"),
    ...toSourced(input.richbourse ?? [], "RICHBOURSE"),
  ].sort((a, b) => sourceRank(a.source) - sourceRank(b.source));

  for (const cand of secondaries) {
    const existing = byDay.get(cand.time);
    if (!existing) {
      byDay.set(cand.time, cand);
      continue;
    }

    // Ne jamais écraser la base / une source plus prioritaire.
    if (sourceRank(existing.source) <= sourceRank(cand.source)) {
      const delta = deltaPercent(existing.value, cand.value);
      if (delta > threshold) {
        discrepancies.push({
          date: cand.time,
          field: "close_price",
          retainedSource: existing.source,
          retainedValue: existing.value,
          rejectedSource: cand.source,
          rejectedValue: cand.value,
          deltaPercent: Math.round(delta * 100) / 100,
        });
      }
      continue;
    }

    // Candidat plus prioritaire que l'existant (ex. Sika remplace Rich sur un trou).
    const delta = deltaPercent(existing.value, cand.value);
    if (delta > threshold) {
      discrepancies.push({
        date: cand.time,
        field: "close_price",
        retainedSource: cand.source,
        retainedValue: cand.value,
        rejectedSource: existing.source,
        rejectedValue: existing.value,
        deltaPercent: Math.round(delta * 100) / 100,
      });
    }
    byDay.set(cand.time, {
      ...cand,
      volume: cand.volume ?? existing.volume ?? null,
    });
  }

  const ordered = [...byDay.values()].sort((a, b) => a.time.localeCompare(b.time));
  const sourcesUsed = [...new Set(ordered.map((p) => p.source))];

  return {
    series: ordered.map(({ time, value, volume }) => ({
      time,
      value,
      volume: volume ?? null,
    })),
    discrepancies,
    sourcesUsed,
  };
}
