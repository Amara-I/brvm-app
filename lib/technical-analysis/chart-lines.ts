// Traits de prix pour le graphe existant.
// Le titre porte le cours en FCFA et, pour l'objectif et l'invalidation, l'écart en %.

import { formatDistancePct, formatFcfa, formatFcfaRange, levelNearPrice } from "./level-label";
import { technicalLevels } from "./levels";
import type { TechnicalAnalysis } from "./types";

export interface ChartLevelLine {
  id: string;
  price: number;
  color: string;
  /** Vide : trait sans pastille (l'autre borne de la zone porte le libellé). */
  title: string;
  dashed?: boolean;
}

const COLORS = {
  support: "#26a69a",
  resistance: "#ef5350",
  target: "#26a69a",
  stop: "#ef5350",
  entry: "#D4A843",
  last: "#d1d4dc",
  fvg: "#D4A843",
};

function words(locale: "fr" | "en") {
  if (locale === "en") {
    return {
      support: "Support",
      resistance: "Resistance",
      entry: "Entry",
      invalidation: "Invalidation",
      target: "Target",
      last: "Price",
      fvgBull: "Bullish FVG",
      fvgBear: "Bearish FVG",
    };
  }
  return {
    support: "Support",
    resistance: "Résistance",
    entry: "Entrée",
    invalidation: "Invalidation",
    target: "Objectif",
    last: "Cours",
    fvgBull: "FVG haussier",
    fvgBear: "FVG baissier",
  };
}

export function chartLevelLines(analysis: TechnicalAnalysis, locale: "fr" | "en" = "fr"): ChartLevelLine[] {
  const copy = words(locale);
  const last = analysis.structure.lastClose;
  const lines: ChartLevelLine[] = [];
  const seen = new Set<string>();

  const add = (line: ChartLevelLine) => {
    if (!Number.isFinite(line.price) || line.price <= 0) return;
    if (last != null && !levelNearPrice(last, line.price)) return;
    const key = `${Math.round(line.price)}:${line.title}`;
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

  for (const zone of ranked) {
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
      title: `${name}  ${formatFcfaRange(zone.low, zone.high)}`,
      dashed: true,
    });
  }

  for (const gap of analysis.gaps.filter((gap) => gap.status !== "filled").slice(-2)) {
    const name = gap.side === "bullish" ? copy.fvgBull : copy.fvgBear;
    add({ id: `${gap.id}-low`, price: gap.low, color: COLORS.fvg, title: "", dashed: true });
    add({
      id: `${gap.id}-high`,
      price: gap.high,
      color: COLORS.fvg,
      title: `${name}  ${formatFcfaRange(gap.low, gap.high)}`,
      dashed: true,
    });
  }

  const plan = technicalLevels(analysis);
  if (plan.lastClose != null) {
    add({
      id: "last",
      price: plan.lastClose,
      color: COLORS.last,
      title: `${copy.last}  ${formatFcfa(plan.lastClose)}`,
      dashed: false,
    });
  }
  if (plan.entryLow != null && plan.entryHigh != null) {
    add({ id: "entry-low", price: plan.entryLow, color: COLORS.entry, title: "", dashed: true });
    add({
      id: "entry-high",
      price: plan.entryHigh,
      color: COLORS.entry,
      title: `${copy.entry}  ${formatFcfaRange(plan.entryLow, plan.entryHigh)}`,
      dashed: true,
    });
  }
  plan.targets.forEach((target, index) => {
    const distance = last != null ? formatDistancePct(last, target) : null;
    add({
      id: `target-${index + 1}`,
      price: target,
      color: COLORS.target,
      title: `${copy.target} ${index + 1}  ${formatFcfa(target)}${distance ? `  ${distance}` : ""}`,
      dashed: true,
    });
  });
  if (plan.invalidation != null) {
    const distance = last != null ? formatDistancePct(last, plan.invalidation) : null;
    add({
      id: "invalidation",
      price: plan.invalidation,
      color: COLORS.stop,
      title: `${copy.invalidation}  ${formatFcfa(plan.invalidation)}${distance ? `  ${distance}` : ""}`,
      dashed: true,
    });
  }

  return lines;
}
