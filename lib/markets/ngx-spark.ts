// Séries d'aperçu de la liste NGX : les mêmes séries `chart_series` « SPARK » que la BRVM (forme sur toute la
// vie du titre + dernières séances journalières), ajustées des opérations sur titres. Elles sont transmises au
// navigateur sous forme compacte (jours depuis 1970 + cours) pour que le sélecteur de période (Jour … Tout)
// filtre côté client avec le même code que la BRVM (`filterSeriesByHorizon`).

import type { ChartClosePoint } from "@/lib/charts/indicators";

const DAY_MS = 24 * 3600 * 1000;

export interface NgxSparkPacked {
  /** Jours depuis 1970-01-01 (UTC), croissants. */
  d: number[];
  /** Clôtures ajustées, même longueur que `d`. */
  v: number[];
}

const round = (v: number) => Math.round(v * 100) / 100;

/** Compacte une série (clôtures > 0, une par jour, triées). Moins de 2 points → null (N/D). */
export function packNgxSpark(points: ChartClosePoint[]): NgxSparkPacked | null {
  const byDay = new Map<number, number>();
  for (const p of points) {
    if (!(p.value > 0)) continue;
    const day = Math.floor(Date.parse(`${p.time}T00:00:00Z`) / DAY_MS);
    if (Number.isFinite(day)) byDay.set(day, round(p.value));
  }
  if (byDay.size < 2) return null;
  const days = [...byDay.keys()].sort((a, b) => a - b);
  return { d: days, v: days.map((day) => byDay.get(day)!) };
}

export function unpackNgxSpark(packed: NgxSparkPacked | null | undefined): ChartClosePoint[] {
  if (!packed) return [];
  const n = Math.min(packed.d.length, packed.v.length);
  const out: ChartClosePoint[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push({ time: new Date(packed.d[i]! * DAY_MS).toISOString().slice(0, 10), value: packed.v[i]!, volume: null });
  }
  return out;
}
