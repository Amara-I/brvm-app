// Ajustement des cours / volumes / données par action pour un fractionnement.
// Convention : `factor` = titres nouveaux / titres anciens.
// Un cours de date D est divisé par le produit des facteurs dont la date
// d'effet est STRICTEMENT postérieure à D. Les volumes sont multipliés
// par le même produit. La capitalisation (prix × titres) est inchangée.

import type { ChartClosePoint } from "@/lib/charts/indicators";
import type { AdjustmentAction } from "./types";

export function calendarGapDays(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso.slice(0, 10)}T00:00:00.000Z`);
  const b = Date.parse(`${toIso.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 9999;
  return Math.round((b - a) / 86_400_000);
}

export function activeActions(actions: AdjustmentAction[]): AdjustmentAction[] {
  return actions.filter((a) => a.adjustPrices && a.factor > 0 && a.factor !== 1);
}

/** Produit des facteurs à appliquer à un cours brut de cette date. */
export function priceDivisor(actions: AdjustmentAction[], date: string): number {
  const iso = date.slice(0, 10);
  let factor = 1;
  for (const action of activeActions(actions)) {
    if (iso < action.effectiveDate) factor *= action.factor;
  }
  return factor;
}

export function adjustmentFingerprint(actions: AdjustmentAction[]): string {
  const parts = activeActions(actions)
    .map((a) => `${a.effectiveDate}:${a.factor}`)
    .sort();
  return parts.length > 0 ? parts.join("|") : "none";
}

export function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundVolume(value: number): number {
  return Math.round(value);
}

/**
 * Réécrit une série brute sur une base comparable.
 * Dans les 7 jours qui suivent l'effet, un cours encore imprimé sur
 * l'ancienne échelle (≈ × facteur) est ramené aussi — le collier ou une
 * source peuvent avoir conservé l'ancien niveau le jour J.
 */
export function adjustSeries(points: ChartClosePoint[], actions: AdjustmentAction[]): ChartClosePoint[] {
  const active = activeActions(actions).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  if (active.length === 0 || points.length === 0) return points;

  const lastRawBefore = new Map<string, number>();
  for (const action of active) {
    let raw: number | null = null;
    for (const point of points) {
      if (point.time.slice(0, 10) < action.effectiveDate && point.value > 0) raw = point.value;
    }
    if (raw != null) lastRawBefore.set(action.effectiveDate, raw);
  }

  return points.map((point) => {
    const time = point.time.slice(0, 10);
    const divisor = priceDivisor(active, time);
    let value = point.value / divisor;
    let volumeFactor = divisor;

    if (divisor === 1) {
      const split = [...active].reverse().find((action) => time >= action.effectiveDate);
      const rawBefore = split ? lastRawBefore.get(split.effectiveDate) : undefined;
      if (split && rawBefore && rawBefore > 0 && calendarGapDays(split.effectiveDate, time) <= 7) {
        const adjustedPrev = rawBefore / priceDivisor(active, shiftIso(split.effectiveDate, -1));
        if (adjustedPrev > 0 && point.value > 0) {
          const distKeep = Math.abs(Math.log(point.value / adjustedPrev));
          const scaled = point.value / split.factor;
          const distScale = Math.abs(Math.log(scaled / adjustedPrev));
          if (distScale + 0.05 < distKeep && distScale < 0.55) {
            value = scaled;
            volumeFactor = split.factor;
          }
        }
      }
    }

    const volume =
      point.volume == null || !Number.isFinite(point.volume)
        ? null
        : roundVolume(point.volume * volumeFactor);
    return { time, value: roundPrice(value), volume };
  });
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface SessionQuote {
  time: string;
  value: number;
  volume?: number | null;
  canonical?: boolean;
  sourceRank?: number;
}

/**
 * Même séance, deux impressions (ancienne échelle canonique + cours post-split
 * non canonique) : on garde la plus petite quand le rapport ≈ facteur.
 */
export function mergeSplitSessionQuotes(
  canonical: ChartClosePoint[],
  extras: SessionQuote[],
  actions: AdjustmentAction[]
): ChartClosePoint[] {
  const active = activeActions(actions);
  if (active.length === 0 || extras.length === 0) return canonical;
  const byDay = new Map<string, ChartClosePoint>();
  for (const point of canonical) {
    if (point.value > 0) byDay.set(point.time.slice(0, 10), { ...point, time: point.time.slice(0, 10) });
  }
  const sortedExtras = [...extras].sort((a, b) => (a.sourceRank ?? 9) - (b.sourceRank ?? 9));
  for (const extra of sortedExtras) {
    if (!(extra.value > 0)) continue;
    const time = extra.time.slice(0, 10);
    const existing = byDay.get(time);
    if (!existing) {
      byDay.set(time, { time, value: extra.value, volume: extra.volume ?? null });
      continue;
    }
    const jump = splitJumpFactor(active, time);
    if (jump <= 1) continue;
    const ratio = existing.value / extra.value;
    if (extra.value < existing.value && Math.abs(ratio / jump - 1) < 0.25) {
      byDay.set(time, { time, value: extra.value, volume: extra.volume ?? existing.volume ?? null });
    }
  }
  return [...byDay.values()].sort((a, b) => a.time.localeCompare(b.time));
}

/** Facteur du fractionnement dont la séance d'effet est dans les 7 jours précédant `date`. */
export function splitJumpFactor(actions: AdjustmentAction[], date: string): number {
  const iso = date.slice(0, 10);
  let factor = 1;
  for (const action of activeActions(actions)) {
    if (iso >= action.effectiveDate && calendarGapDays(action.effectiveDate, iso) <= 7) {
      factor *= action.factor;
    }
  }
  return factor;
}

export function splitBetween(actions: AdjustmentAction[], prevDate: string, lastDate: string): boolean {
  const prev = prevDate.slice(0, 10);
  const last = lastDate.slice(0, 10);
  return activeActions(actions).some((action) => prev < action.effectiveDate && last >= action.effectiveDate);
}

export function sessionChangePercent(
  prev: { date: string; close: number } | null,
  last: { date: string; close: number },
  storedPercent: number | null,
  actions: AdjustmentAction[]
): number | null {
  if (!prev || !(prev.close > 0) || !(last.close > 0)) {
    return storedPercent != null && Number.isFinite(storedPercent) ? storedPercent : null;
  }
  const adjusted = adjustSeries(
    [
      { time: prev.date.slice(0, 10), value: prev.close, volume: null },
      { time: last.date.slice(0, 10), value: last.close, volume: null },
    ],
    actions
  );
  const aPrev = adjusted[0]?.value ?? 0;
  const aLast = adjusted[1]?.value ?? 0;
  const computed = aPrev > 0 ? Math.round(((aLast - aPrev) / aPrev) * 10000) / 100 : null;
  if (splitBetween(actions, prev.date, last.date)) {
    // La BRVM publie déjà la variation contre la clôture ajustée (+7,18 %).
    // On ne la garde que si elle tient dans le collier : un −89 % est le
    // décrochage non ajusté, pas la séance.
    if (storedPercent != null && Number.isFinite(storedPercent) && Math.abs(storedPercent) <= 8) {
      return storedPercent;
    }
    return computed;
  }
  if (storedPercent != null && Number.isFinite(storedPercent)) return storedPercent;
  return computed;
}

/**
 * Date de référence d'un dividende par action.
 * Avec date de détachement : cette date.
 * Sinon, si un fractionnement tombe dans l'exercice, le 1er janvier
 * (le DPS reporté est encore sur l'ancienne base). Sinon le 31/12.
 */
export function dividendBasisDate(
  year: number,
  exDate: string | null | undefined,
  actions: AdjustmentAction[]
): string {
  if (exDate && /^\d{4}-\d{2}-\d{2}/.test(exDate)) return exDate.slice(0, 10);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const splitInYear = activeActions(actions).some(
    (action) => action.effectiveDate > yearStart && action.effectiveDate <= yearEnd
  );
  return splitInYear ? yearStart : yearEnd;
}

export function adjustPerShareAmount(
  amount: number,
  basisDate: string,
  actions: AdjustmentAction[]
): number {
  if (!(amount > 0)) return amount;
  return roundPrice(amount / priceDivisor(actions, basisDate));
}

/**
 * Nombre de titres : × facteur seulement si le chiffre stocké est encore
 * proche de `sharesOutstandingBefore` (100 M → 1 Md, pas 1 Md → 10 Md).
 */
export function restateSharesOutstanding(
  raw: number | null | undefined,
  actions: AdjustmentAction[]
): number | null {
  if (raw == null || !(raw > 0) || !Number.isFinite(raw)) return null;
  let shares = raw;
  const ordered = activeActions(actions).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  for (const action of ordered) {
    const before = action.sharesOutstandingBefore;
    if (before == null || !(before > 0)) continue;
    const after = before * action.factor;
    const distBefore = Math.abs(Math.log(shares / before));
    const distAfter = Math.abs(Math.log(shares / after));
    if (distBefore + 0.02 < distAfter && distBefore < 0.2) {
      shares *= action.factor;
    }
  }
  return Math.round(shares);
}

export function splitSessionMissing(
  points: Array<{ time: string }>,
  actions: AdjustmentAction[],
  todayIso: string
): boolean {
  const last = points.length > 0 ? points[points.length - 1]!.time.slice(0, 10) : "";
  return activeActions(actions).some(
    (action) => action.effectiveDate <= todayIso && last < action.effectiveDate
  );
}

export function markersFor(actions: AdjustmentAction[]): Array<{ effectiveDate: string; label: string }> {
  return activeActions(actions)
    .map((action) => ({ effectiveDate: action.effectiveDate, label: action.label }))
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
}
