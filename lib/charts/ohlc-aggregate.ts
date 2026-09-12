// Agrégation OHLC multi-timeframe pour le workbench graphique.

import type { ChartCandle, ChartClosePoint } from "./indicators";
import { closesToCandles } from "./indicators";

export type CandleInterval = "1H" | "1D" | "1W" | "1M";

export const CANDLE_INTERVALS: Array<{ key: CandleInterval; label: string; title: string }> = [
  { key: "1H", label: "1h", title: "Bougies horaires" },
  { key: "1D", label: "1j", title: "Bougies journalières" },
  { key: "1W", label: "1S", title: "Bougies hebdomadaires" },
  { key: "1M", label: "1M", title: "Bougies mensuelles" },
];

function parseTime(iso: string): Date {
  // YYYY-MM-DD or ISO datetime
  if (iso.length === 10) return new Date(`${iso}T00:00:00.000Z`);
  return new Date(iso);
}

function hasIntraday(points: ChartClosePoint[]): boolean {
  return points.some((p) => p.time.length > 10);
}

/** Lundi ISO (UTC) de la semaine contenant `d`. */
export function isoWeekMonday(d: Date): Date {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() - (day - 1));
  return t;
}

function bucketKey(time: string, interval: CandleInterval): string {
  const d = parseTime(time);
  if (interval === "1H") {
    return `${d.toISOString().slice(0, 13)}:00:00.000Z`;
  }
  if (interval === "1D") {
    return d.toISOString().slice(0, 10);
  }
  if (interval === "1W") {
    return isoWeekMonday(d).toISOString().slice(0, 10);
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function bucketDisplayTime(key: string, interval: CandleInterval): string {
  if (interval === "1H") return key.slice(0, 10);
  if (interval === "1D" || interval === "1W") return key;
  return `${key}-01`;
}

/** Dernier jour calendaire couvert par une bougie (pour tester l'intersection avec la plage). */
export function barPeriodEnd(time: string, interval: CandleInterval): string {
  const day = time.slice(0, 10);
  if (interval === "1H" || interval === "1D") return day;
  if (interval === "1W") {
    const d = parseTime(day);
    d.setUTCDate(d.getUTCDate() + 6);
    return d.toISOString().slice(0, 10);
  }
  const d = parseTime(day);
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return end.toISOString().slice(0, 10);
}

export interface AggregateResult {
  candles: ChartCandle[];
  /** true si l'intervalle demandé n'a pas de données horaires réelles. */
  hourlyUnavailable: boolean;
  note: string | null;
}

/**
 * Agrège une série de clôtures en bougies selon l'intervalle.
 * Horaire : uniquement si la série contient des timestamps intraday ; sinon
 * retourne les bougies journalières avec `hourlyUnavailable: true` (N/D honnête).
 */
export function aggregateCandles(
  points: ChartClosePoint[],
  interval: CandleInterval
): AggregateResult {
  if (points.length === 0) {
    return { candles: [], hourlyUnavailable: interval === "1H", note: "Aucune donnée (N/D)." };
  }

  if (interval === "1H" && !hasIntraday(points)) {
    const daily = closesToCandles(points);
    return {
      candles: daily,
      hourlyUnavailable: true,
      note: "Bougies horaires N/D — historique disponible en journalier uniquement.",
    };
  }

  if (interval === "1D") {
    return {
      candles: closesToCandles(points),
      hourlyUnavailable: false,
      note: null,
    };
  }

  const base = closesToCandles(points);
  const map = new Map<string, ChartCandle>();

  for (const c of base) {
    const key = bucketKey(c.time, interval);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        time: bucketDisplayTime(key, interval),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
      if (c.volume != null && c.volume > 0) {
        existing.volume = (existing.volume ?? 0) + c.volume;
      }
    }
  }

  const candles = [...map.values()].sort((a, b) => a.time.localeCompare(b.time));
  return {
    candles,
    hourlyUnavailable: false,
    note:
      interval === "1W"
        ? "Agrégation hebdomadaire (O=ouverture semaine, C=clôture)."
        : interval === "1M"
          ? "Agrégation mensuelle (O=ouverture mois, C=clôture)."
          : null,
  };
}

/** Convertit des bougies en points de clôture (pour SMA/RSI sur timeframe agrégé). */
export function candlesToCloses(candles: ChartCandle[]): ChartClosePoint[] {
  return candles.map((c) => ({
    time: c.time,
    value: c.close,
    volume: c.volume,
  }));
}
