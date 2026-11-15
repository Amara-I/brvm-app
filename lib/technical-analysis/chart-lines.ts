// Traits de prix pour le graphe existant.
// Le titre porte le cours dans la devise de la place (FCFA ou ₦) et, pour l'objectif
// et l'invalidation, l'écart en %.

import { formatDistancePct, formatPrice, formatPriceRange, hasDecimals, levelNearPrice } from "./level-label";
import { technicalLevels } from "./levels";
import type { TechnicalAnalysis } from "./types";

export interface ChartLevelLine {
  id: string;
  price: number;
  color: string;
  /** Vide : trait sans pastille (l'autre borne de la zone porte le libellé). */
  title: string;
  dashed?: boolean;
  /** Repère court affiché sur le graphe (R1, S1, FVG, E, O1, I, C). Vide pour la borne sans libellé. */
  short?: string;
  /** Libellé complet pour la légende sous le graphe (Résistance, Objectif 1…). */
  name?: string;
  /** Prix ou fourchette formatés, avec devise. */
  value?: string;
  /** Écart en % au cours (objectifs, invalidation). */
  distance?: string | null;
}

// Même code couleur que les scénarios (style Trading Central) : au-dessus du cours en vert
// (résistances, objectifs), en dessous en rouge (supports, invalidation), entrée en bleu.
const COLORS = {
  support: "#ef5350",
  resistance: "#26a69a",
  target: "#26a69a",
  stop: "#ef5350",
  entry: "#3b82f6",
  last: "#d1d4dc",
  fvg: "#D4A843",
};

function words(locale: "fr" | "en", index = false) {
  if (locale === "en") {
    return {
      support: "Support",
      resistance: "Resistance",
      entry: index ? "Key zone" : "Entry",
      invalidation: "Invalidation",
      target: "Target",
      last: index ? "Level" : "Price",
      fvgBull: "Bullish FVG",
      fvgBear: "Bearish FVG",
      supportShort: "S",
      resistanceShort: "R",
      entryShort: index ? "K" : "E",
      targetShort: "T",
      invalidationShort: "I",
      lastShort: index ? "L" : "P",
    };
  }
  return {
    support: "Support",
    resistance: "Résistance",
    entry: index ? "Zone clé" : "Entrée",
    invalidation: "Invalidation",
    target: "Objectif",
    last: index ? "Niveau" : "Cours",
    fvgBull: "FVG haussier",
    fvgBear: "FVG baissier",
    supportShort: "S",
    resistanceShort: "R",
    entryShort: index ? "Z" : "E",
    targetShort: "O",
    invalidationShort: "I",
    lastShort: index ? "N" : "C",
  };
}

export function chartLevelLines(analysis: TechnicalAnalysis, locale: "fr" | "en" = "fr"): ChartLevelLine[] {
  const currency = analysis.currency ?? "XOF";
  const copy = words(locale, currency === "PTS");
  const money = (value: number) => formatPrice(value, currency, locale);
  const range = (low: number, high: number) => formatPriceRange(low, high, currency, locale);
  const last = analysis.structure.lastClose;
  const lines: ChartLevelLine[] = [];
  const seen = new Set<string>();

  const add = (line: ChartLevelLine) => {
    if (!Number.isFinite(line.price) || line.price <= 0) return;
    if (last != null && !levelNearPrice(last, line.price)) return;
    const key = `${hasDecimals(currency) ? line.price.toFixed(2) : Math.round(line.price)}:${line.title}`;
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(line);
  };

  const ranked = [...analysis.zones]
    .filter((zone) => zone.kind === "support" || zone.kind === "resistance")
    .sort((a, b) => {
      if (last == null) return b.strength - a.strength;
      return Math.abs(a.mid - last) - Math.abs(b.mid - last);
    })
    .slice(0, 4);

  const rank = { support: 0, resistance: 0 };
  for (const zone of ranked) {
    const kind = zone.kind === "support" ? "support" : "resistance";
    rank[kind] += 1;
    const color = zone.kind === "support" ? COLORS.support : COLORS.resistance;
    const name = zone.kind === "support" ? copy.support : copy.resistance;
    add({
      id: `${zone.id}-low`,
      price: zone.low,
      color,
      title: "",
      dashed: true,
    });
    add({
      id: `${zone.id}-high`,
      price: zone.high,
      color,
      title: `${name}  ${range(zone.low, zone.high)}`,
      dashed: true,
      short: `${kind === "support" ? copy.supportShort : copy.resistanceShort}${rank[kind]}`,
      name,
      value: range(zone.low, zone.high),
    });
  }

  for (const gap of analysis.gaps.filter((gap) => gap.status !== "filled").slice(-2)) {
    const name = gap.side === "bullish" ? copy.fvgBull : copy.fvgBear;
    add({ id: `${gap.id}-low`, price: gap.low, color: COLORS.fvg, title: "", dashed: true });
    add({
      id: `${gap.id}-high`,
      price: gap.high,
      color: COLORS.fvg,
      title: `${name}  ${range(gap.low, gap.high)}`,
      dashed: true,
      short: "FVG",
      name,
      value: range(gap.low, gap.high),
    });
  }

  const plan = technicalLevels(analysis);
  if (plan.lastClose != null) {
    add({
      id: "last",
      price: plan.lastClose,
      color: COLORS.last,
      title: `${copy.last}  ${money(plan.lastClose)}`,
      dashed: false,
      short: copy.lastShort,
      name: copy.last,
      value: money(plan.lastClose),
    });
  }
  if (plan.entryLow != null && plan.entryHigh != null) {
    add({ id: "entry-low", price: plan.entryLow, color: COLORS.entry, title: "", dashed: true });
    add({
      id: "entry-high",
      price: plan.entryHigh,
      color: COLORS.entry,
      title: `${copy.entry}  ${range(plan.entryLow, plan.entryHigh)}`,
      dashed: true,
      short: copy.entryShort,
      name: copy.entry,
      value: range(plan.entryLow, plan.entryHigh),
    });
  }
  plan.targets.forEach((target, index) => {
    const distance = last != null ? formatDistancePct(last, target) : null;
    add({
      id: `target-${index + 1}`,
      price: target,
      color: COLORS.target,
      title: `${copy.target} ${index + 1}  ${money(target)}${distance ? `  ${distance}` : ""}`,
      dashed: true,
      short: `${copy.targetShort}${index + 1}`,
      name: `${copy.target} ${index + 1}`,
      value: money(target),
      distance,
    });
  });
  if (plan.invalidation != null) {
    const distance = last != null ? formatDistancePct(last, plan.invalidation) : null;
    add({
      id: "invalidation",
      price: plan.invalidation,
      color: COLORS.stop,
      title: `${copy.invalidation}  ${money(plan.invalidation)}${distance ? `  ${distance}` : ""}`,
      dashed: true,
      short: copy.invalidationShort,
      name: copy.invalidation,
      value: money(plan.invalidation),
      distance,
    });
  }

  return lines;
}
