// Complétude d'une séance NGX en base.
//
// L'ancien critère (≥ 80 clôtures canoniques) laissait pour « complète » une
// séance repliée sur le Daily Summary où seuls 87 titres sur ~124 avaient été
// appariés : le backfill la sautait ensuite indéfiniment. On compare désormais
// au volume habituel des séances voisines (médiane sur ±21 jours).

import { shiftIsoDate } from "./dates";

/** Seuil historique, gardé quand aucune séance voisine ne sert de référence. */
export const NGX_SESSION_DONE_FLOOR = 80;
/** Part minimale du volume habituel pour tenir une séance pour complète. */
export const NGX_SESSION_MIN_RATIO = 0.9;
/** Demi-fenêtre (jours calendaires) des séances voisines de référence. */
export const NGX_SESSION_WINDOW_DAYS = 21;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Nombre de clôtures attendu pour `iso` : médiane des séances voisines
 * (hors `iso`, hors jours vides). null s'il n'y a aucune voisine.
 */
export function expectedSessionCount(
  counts: ReadonlyMap<string, number>,
  iso: string,
  windowDays = NGX_SESSION_WINDOW_DAYS
): number | null {
  const lo = shiftIsoDate(iso, -windowDays);
  const hi = shiftIsoDate(iso, windowDays);
  const around: number[] = [];
  for (const [day, n] of counts) {
    if (day === iso || day < lo || day > hi || !(n > 0)) continue;
    around.push(n);
  }
  return median(around);
}

/** Vrai si la séance a au moins 90 % du volume habituel (repli : ≥ 80 clôtures). */
export function isNgxSessionComplete(count: number, expected: number | null): boolean {
  if (!(count > 0)) return false;
  if (expected == null || !(expected > 0)) return count >= NGX_SESSION_DONE_FLOOR;
  return count >= Math.ceil(expected * NGX_SESSION_MIN_RATIO);
}

/** Raccourci : complétude de `iso` d'après la carte des comptes par date. */
export function sessionCompleteIn(counts: ReadonlyMap<string, number>, iso: string): boolean {
  return isNgxSessionComplete(counts.get(iso) ?? 0, expectedSessionCount(counts, iso));
}
