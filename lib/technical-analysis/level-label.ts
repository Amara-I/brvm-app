// Libellés de prix : FCFA groupés à la française, écart en % depuis le cours.
// Les mots (Objectif, Cours…) sont choisis par l'appelant ; le format des nombres est fixe.

const NBSP = /[\u202f\u00a0]/g;

export function formatFcfa(value: number): string {
  const body = Math.round(value)
    .toLocaleString("fr-FR")
    .replace(NBSP, " ");
  return `${body} FCFA`;
}

export function formatFcfaRange(low: number, high: number): string {
  const a = Math.round(Math.min(low, high)).toLocaleString("fr-FR").replace(NBSP, " ");
  const b = Math.round(Math.max(low, high)).toLocaleString("fr-FR").replace(NBSP, " ");
  return `${a} – ${b} FCFA`;
}

/** Écart du niveau par rapport au cours. `+8,4 %` ou `−5,2 %` (signe moins typographique). */
export function formatDistancePct(last: number, level: number): string | null {
  if (!(last > 0) || !Number.isFinite(level)) return null;
  const pct = ((level - last) / last) * 100;
  const body = Math.abs(pct)
    .toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    .replace(NBSP, " ");
  if (pct > 0.05) return `+${body} %`;
  if (pct < -0.05) return `−${body} %`;
  return "0,0 %";
}

/** Niveau trop loin du cours : on le liste, on ne l'étire pas sur le graphe. */
export function levelNearPrice(last: number | null, price: number): boolean {
  if (last == null || !(last > 0) || !Number.isFinite(price)) return false;
  return Math.abs(price - last) / last <= 0.45;
}

/**
 * Écarte des ordonnées trop proches pour que les pastilles ne se recouvrent pas.
 * `gap` est l'écart minimum, dans la même unité que `ys` (pixels).
 */
export function stackLabelYs(ys: number[], gap: number, min: number, max: number): number[] {
  if (ys.length === 0) return [];
  const order = ys.map((y, index) => ({ index, y })).sort((a, b) => a.y - b.y || a.index - b.index);
  const placed = ys.slice();
  let cursor = min;
  for (const item of order) {
    const next = Math.max(min, Math.max(item.y, cursor));
    placed[item.index] = next;
    cursor = next + gap;
  }
  const bottom = cursor - gap;
  if (bottom <= max) return placed;
  const step = order.length === 1 ? 0 : (max - min) / (order.length - 1);
  for (let rank = 0; rank < order.length; rank++) {
    placed[order[rank]!.index] = min + rank * step;
  }
  return placed;
}

export function rewardRiskSentence(rr: number | null, locale: "fr" | "en"): string {
  if (rr == null || !Number.isFinite(rr) || rr <= 0) {
    return locale === "en"
      ? "N/D — entry and invalidation are too close to compare the aimed gain with the loss."
      : "N/D — l'entrée et l'invalidation sont trop proches pour comparer le gain visé et la perte.";
  }
  const shown = rr.toLocaleString(locale === "en" ? "en-GB" : "fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  if (locale === "en") {
    return rr >= 1
      ? `${shown} — the gain to the first target is ${shown} times the loss if price hits invalidation.`
      : `${shown} — the aimed gain is smaller than the loss if price hits invalidation.`;
  }
  return rr >= 1
    ? `${shown} — le gain visé jusqu'au premier objectif vaut ${shown} fois la perte si le cours touche l'invalidation.`
    : `${shown} — le gain visé est plus petit que la perte si le cours touche l'invalidation.`;
}
