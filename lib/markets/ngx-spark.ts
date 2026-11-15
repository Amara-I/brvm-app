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

const isoToDay = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS);

/**
 * Points d'aperçu de la vue d'ensemble NGX, pour un rendu aussi régulier que la BRVM.
 *
 * La série SPARK ne garde que 80 séances journalières plus une « forme » de toute la vie du titre.
 * Sur la NGX, où beaucoup de titres ne cotent pas chaque jour, ces 80 séances ne couvrent que
 * quelques semaines : le reste de l'année se réduit alors à 2 ou 3 points tassés à gauche de
 * l'aperçu « 1 an » (fausse chute verticale). On complète donc l'année avec la série 1A déjà
 * chargée pour la note (même ajustement) : journalier sur les 100 derniers jours, une clôture
 * tous les 3 jours avant, et la forme SPARK au-delà d'un an. ≈ 160 points par titre au plus.
 */
export function ngxBoardSparkPoints(spark: readonly ChartClosePoint[], window: readonly ChartClosePoint[]): ChartClosePoint[] {
  const valid = (p: ChartClosePoint) => p.value > 0 && /^\d{4}-\d{2}-\d{2}/.test(p.time);
  const year = window.filter(valid).sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  if (year.length < 2) return [...spark];
  const lastDay = isoToDay(year[year.length - 1]!.time);
  const yearFrom = lastDay - 366;
  const dailyFrom = lastDay - 100;
  const older = spark.filter((p) => valid(p) && isoToDay(p.time) < yearFrom);
  const kept: ChartClosePoint[] = [];
  let bucket: number | null = null;
  for (const p of year) {
    const day = isoToDay(p.time);
    if (day < yearFrom) continue;
    if (day >= dailyFrom) {
      kept.push(p);
      bucket = null;
      continue;
    }
    const b = Math.floor(day / 3);
    if (bucket === b) kept[kept.length - 1] = p;
    else kept.push(p);
    bucket = b;
  }
  return [...older, ...kept];
}
