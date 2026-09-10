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

function weekKey(d: Date): string {
  // ISO week: Monday-start, key = Thursday's year-week for stability
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
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
    return weekKey(d);
  }
  // 1M
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function bucketDisplayTime(key: string, interval: CandleInterval): string {
  if (interval === "1H") return key.slice(0, 10); // LWC business day fallback if no intraday axis
  if (interval === "1D") return key;
  if (interval === "1W") {
    // Map week key to the Monday date approximation for chart axis
    const [y, w] = key.split("-W");
    const year = Number(y);
    const week = Number(w);
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const day = jan4.getUTCDay() || 7;
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7);
    return monday.toISOString().slice(0, 10);
  }
  // 1M → mid-month for axis
  return `${key}-01`;
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
