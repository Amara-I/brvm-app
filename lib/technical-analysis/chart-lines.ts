// Traits de prix pour le graphe existant (supports, résistances, FVG ouverts).

import type { TechnicalAnalysis } from "./types";

export interface ChartLevelLine {
  id: string;
  price: number;
  color: string;
  title: string;
  dashed?: boolean;
}

export function chartLevelLines(analysis: TechnicalAnalysis): ChartLevelLine[] {
  const last = analysis.structure.lastClose;
  const ranked = [...analysis.zones]
    .filter((zone) => zone.kind !== "pivot")
    .sort((a, b) => {
      if (last == null) return b.strength - a.strength;
      return Math.abs(a.mid - last) - Math.abs(b.mid - last);
    })
    .slice(0, 4);
  const lines: ChartLevelLine[] = [];
  for (const zone of ranked) {
    const color = zone.kind === "support" ? "#26a69a" : "#ef5350";
    const tag = zone.kind === "support" ? "S" : "R";
    lines.push({ id: `${zone.id}-low`, price: zone.low, color, title: "", dashed: true });
    lines.push({ id: `${zone.id}-high`, price: zone.high, color, title: `${tag} ${zone.touches}`, dashed: true });
  }
  for (const gap of analysis.gaps.filter((g) => g.status !== "filled").slice(-3)) {
    const color = gap.side === "bullish" ? "#26a69a" : "#ef5350";
    const tag = gap.side === "bullish" ? "FVG+" : "FVG−";
    lines.push({ id: `${gap.id}-low`, price: gap.low, color, title: "", dashed: true });
    lines.push({ id: `${gap.id}-high`, price: gap.high, color, title: tag, dashed: true });
  }
  return lines;
}
