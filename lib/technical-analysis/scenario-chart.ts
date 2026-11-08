// Géométrie d'un graphique annoté (SVG maison). Pas de capture externe.

import type { PriceBar, ScenarioPlan, SrZone } from "./types";

export interface ScenarioChartBox {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "support" | "resistance" | "entry" | "gap";
}

export interface ScenarioChartMark {
  y: number;
  label: string;
  kind: "stop" | "target" | "last";
}

export interface ScenarioChartModel {
  width: number;
  height: number;
  polyline: string;
  zones: ScenarioChartBox[];
  marks: ScenarioChartMark[];
  arrow: { x1: number; y1: number; x2: number; y2: number } | null;
  title: string;
}

const WIDTH = 640;
const HEIGHT = 280;
const PAD_X = 16;
const PAD_Y = 28;

function yOf(price: number, min: number, max: number): number {
  const span = max - min || 1;
  return PAD_Y + ((max - price) / span) * (HEIGHT - PAD_Y * 2);
}

export function scenarioChartModel(
  bars: PriceBar[],
  scenario: ScenarioPlan,
  zones: SrZone[],
  title: string
): ScenarioChartModel {
  const window = bars.slice(-70);
  const prices = window.flatMap((bar) => [bar.low, bar.high, bar.close]);
  for (const level of [scenario.entryLow, scenario.entryHigh, scenario.invalidation, ...scenario.targets]) {
    if (level != null) prices.push(level);
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const plotW = WIDTH - PAD_X * 2 - 88;
  const step = window.length > 1 ? plotW / (window.length - 1) : plotW;
  const points = window.map((bar, index) => {
    const x = PAD_X + index * step;
    const y = yOf(bar.close, min, max);
    return `${Math.round(x)},${Math.round(y)}`;
  });
  const boxes: ScenarioChartBox[] = [];
  for (const zone of zones.filter((z) => z.kind === "support" || z.kind === "resistance").slice(0, 4)) {
    const y1 = yOf(zone.high, min, max);
    const y2 = yOf(zone.low, min, max);
    boxes.push({
      x: PAD_X,
      y: Math.min(y1, y2),
      w: plotW,
      h: Math.max(2, Math.abs(y2 - y1)),
      kind: zone.kind === "support" ? "support" : "resistance",
    });
  }
  if (scenario.entryLow != null && scenario.entryHigh != null) {
    const y1 = yOf(scenario.entryHigh, min, max);
    const y2 = yOf(scenario.entryLow, min, max);
    boxes.push({
      x: PAD_X,
      y: Math.min(y1, y2),
      w: plotW,
      h: Math.max(2, Math.abs(y2 - y1)),
      kind: "entry",
    });
  }
  const marks: ScenarioChartMark[] = [];
  if (scenario.invalidation != null) marks.push({ y: yOf(scenario.invalidation, min, max), label: "Invalidation", kind: "stop" });
  scenario.targets.forEach((target, index) => {
    marks.push({ y: yOf(target, min, max), label: index === 0 ? "Objectif" : `Objectif ${index + 1}`, kind: "target" });
  });
  const last = window[window.length - 1];
  let arrow: ScenarioChartModel["arrow"] = null;
  const target = scenario.targets[0];
  if (last && target != null && window.length > 0) {
    const x1 = PAD_X + (window.length - 1) * step;
    const y1 = yOf(last.close, min, max);
    const x2 = Math.min(WIDTH - 96, x1 + 42);
    const y2 = yOf(target, min, max);
    arrow = { x1, y1, x2, y2 };
    marks.push({ y: y1, label: "Cours", kind: "last" });
  }
  return {
    width: WIDTH,
    height: HEIGHT,
    polyline: points.join(" "),
    zones: boxes,
    marks,
    arrow,
    title,
  };
}
