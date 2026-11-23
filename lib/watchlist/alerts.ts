// Logique pure des alertes watchlist (testée sans base de données).

import { civilDateInTimeZone } from "@/lib/notifications/logic";
import { WATCHLIST_DIVIDEND_WINDOW_DAYS } from "@/lib/notifications/types";

const DAY_MS = 86_400_000;

/** Jours entre deux dates civiles YYYY-MM-DD (to - from). */
export function civilDaysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
  return Math.round((b - a) / DAY_MS);
}

/**
 * Jours restants avant le détachement si celui-ci tombe dans la fenêtre
 * [aujourd'hui, aujourd'hui + windowDays] (fuseau marché) ; sinon null.
 */
export function daysUntilExDate(
  exDate: Date | null | undefined,
  now: Date,
  windowDays = WATCHLIST_DIVIDEND_WINDOW_DAYS
): number | null {
  if (!exDate) return null;
  const days = civilDaysBetween(civilDateInTimeZone(now), exDate.toISOString().slice(0, 10));
  if (!Number.isFinite(days) || days < 0 || days > windowDays) return null;
  return days;
}

/** Phrase de délai : « aujourd'hui », « demain », « dans 3 jours ». */
export function exDateDelayLabel(days: number): string {
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  return `dans ${days} jours`;
}
