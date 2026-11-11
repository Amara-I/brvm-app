// Libellés de prix selon la place : FCFA (BRVM) ou naira ₦ (NGX), groupés à la française,
// écart en % depuis le cours. Les mots (Objectif, Cours…) sont choisis par l'appelant.

const NBSP = /[\u202f\u00a0]/g;

/** Devise de cotation : XOF = FCFA (BRVM), NGN = naira (NGX). */
export type PriceCurrency = "XOF" | "NGN";

export const DEFAULT_PRICE_CURRENCY: PriceCurrency = "XOF";

/** Montant sans unité. FCFA : entier. Naira : 2 décimales (beaucoup de titres NGX cotent sous ₦10). */
export function formatPriceNumber(value: number, currency: PriceCurrency = DEFAULT_PRICE_CURRENCY, locale: "fr" | "en" = "fr"): string {
  const tag = locale === "en" ? "en-GB" : "fr-FR";
  if (currency === "NGN") {
    return value
      .toLocaleString(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .replace(NBSP, " ");
  }
  return Math.round(value).toLocaleString(tag).replace(NBSP, " ");
}

/** `4 125 FCFA` ou `₦1 250,50`. */
export function formatPrice(value: number, currency: PriceCurrency = DEFAULT_PRICE_CURRENCY, locale: "fr" | "en" = "fr"): string {
  const body = formatPriceNumber(value, currency, locale);
  return currency === "NGN" ? `₦${body}` : `${body} FCFA`;
}

/** `4 100 – 4 300 FCFA` ou `₦12,50 – ₦13,10`. */
export function formatPriceRange(
  low: number,
  high: number,
  currency: PriceCurrency = DEFAULT_PRICE_CURRENCY,
  locale: "fr" | "en" = "fr",
): string {
  const a = Math.min(low, high);
  const b = Math.max(low, high);
  if (currency === "NGN") return `${formatPrice(a, currency, locale)} – ${formatPrice(b, currency, locale)}`;
  return `${formatPriceNumber(a, currency, locale)} – ${formatPriceNumber(b, currency, locale)} FCFA`;
}

export function formatFcfa(value: number): string {
  return formatPrice(value, "XOF");
}

export function formatFcfaRange(low: number, high: number): string {
  return formatPriceRange(low, high, "XOF");
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


/**
 * Place des pastilles de hauteurs variables : `ys` sont les centres souhaités,
 * `heights` les hauteurs en pixels. Les boîtes restent dans [min, max] et
 * gardent au moins `gap` pixels entre elles.
 */
export function stackLabelBoxes(
  ys: number[],
  heights: number[],
  min: number,
  max: number,
  gap = 4
): number[] {
  if (ys.length === 0) return [];
  const order = ys
    .map((y, index) => ({ index, y, h: Math.max(0, heights[index] ?? 0) }))
    .sort((a, b) => a.y - b.y || a.index - b.index);
  const placed = ys.slice();
  let prevBottom = min;
  for (const item of order) {
    const half = item.h / 2;
    const center = Math.max(item.y, prevBottom + gap + half, min + half);
    placed[item.index] = center;
    prevBottom = center + half;
  }
  const last = order[order.length - 1]!;
  const bottom = placed[last.index]! + last.h / 2;
  if (bottom <= max) return placed;

  const totalH = order.reduce((sum, item) => sum + item.h, 0);
  const span = Math.max(0, max - min);
  const gaps = Math.max(0, order.length - 1);
  const packedGap = gaps === 0 ? 0 : Math.max(0, (span - totalH) / gaps);
  let cursor = min;
  for (const item of order) {
    placed[item.index] = cursor + item.h / 2;
    cursor += item.h + packedGap;
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
