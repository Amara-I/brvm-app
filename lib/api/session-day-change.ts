// Variation d'une séance : clôture de la séance de bourse précédente
// (même si elle n'est pas canonique) ou variation officielle publiée.
// Ne jamais sauter un jour seulement parce que `is_canonical` est faux.

import { sessionChangePercent } from "@/lib/corporate-actions/adjust";
import type { AdjustmentAction } from "@/lib/corporate-actions/types";
import { canonicalSourceForDay } from "@/lib/ingestion/reconciliation";
import type { DataSourceCode } from "@/lib/ingestion/types";

export interface SessionCloseRow {
  date: string;
  close: number;
  source: DataSourceCode;
  changePercent: number | null;
  isCanonical?: boolean;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Clôture retenue pour une séance : canonique s'il y en a une, sinon source prioritaire. */
export function closeForSession(rows: SessionCloseRow[], date: string): SessionCloseRow | null {
  const day = rows.filter((row) => dayKey(row.date) === dayKey(date) && row.close > 0);
  if (day.length === 0) return null;
  const canonical = day.filter((row) => row.isCanonical);
  const pool = canonical.length > 0 ? canonical : day;
  const winner = canonicalSourceForDay(pool.map((row) => row.source));
  return pool.find((row) => row.source === winner) ?? pool[0] ?? null;
}

/**
 * Variation du dernier jour de bourse présent dans `rows`.
 * Le jour précédent est la séance immédiatement antérieure, canonique ou non.
 * La variation officielle (`changePercent`) est conservée quand elle tient
 * dans le collier, y compris le jour d'un fractionnement (+7,18 % SNTS).
 */
export function sessionDayChangePercent(
  rows: SessionCloseRow[],
  actions: AdjustmentAction[]
): number | null {
  const dates = [...new Set(rows.map((row) => dayKey(row.date)))].sort();
  if (dates.length === 0) return null;
  const lastDate = dates[dates.length - 1]!;
  const prevDate = dates.length >= 2 ? dates[dates.length - 2]! : null;
  const last = closeForSession(rows, lastDate);
  if (!last) return null;
  const prev = prevDate ? closeForSession(rows, prevDate) : null;
  const stored =
    last.changePercent ??
    rows.find((row) => dayKey(row.date) === lastDate && row.changePercent != null)?.changePercent ??
    null;
  return sessionChangePercent(
    prev ? { date: dayKey(prev.date), close: prev.close } : null,
    { date: dayKey(last.date), close: last.close },
    stored,
    actions
  );
}
