// Un historique déjà ajusté n'a pas de saut ≈ 1/facteur à la date d'effet.
// On ne devine pas : sans point de part et d'autre, ou si le saut n'est
// ni ~1 ni ~1/facteur, on laisse l'ajustement désactivé.

import { calendarGapDays } from "./adjust";

export type SplitReflection = "unadjusted" | "already_adjusted" | "insufficient_history";

export function classifySplitReflection(
  points: Array<{ time: string; value: number }>,
  effectiveDate: string,
  factor: number
): SplitReflection {
  if (!(factor > 1)) return "insufficient_history";
  const ordered = points
    .filter((point) => point.value > 0 && point.time)
    .map((point) => ({ time: point.time.slice(0, 10), value: point.value }))
    .sort((a, b) => a.time.localeCompare(b.time));
  const before = ordered.filter((point) => point.time < effectiveDate);
  const after = ordered.filter((point) => point.time >= effectiveDate);
  if (before.length === 0 || after.length === 0) return "insufficient_history";

  const lastBefore = before[before.length - 1]!;
  const firstAfter = after[0]!;
  const jump = firstAfter.value / lastBefore.value;
  if (!(jump > 0)) return "insufficient_history";

  const expected = 1 / factor;
  const distUnadjusted = Math.abs(Math.log(jump / expected));
  const distAdjusted = Math.abs(Math.log(jump));
  const gap = calendarGapDays(lastBefore.time, firstAfter.time);

  if (distUnadjusted + 0.05 < distAdjusted && distUnadjusted < 0.35) return "unadjusted";
  if (distAdjusted < 0.25) return "already_adjusted";
  if (gap > 14) return "insufficient_history";
  return "insufficient_history";
}
