// Géométrie d'un graphique annoté (SVG maison). Les pastilles de prix
// sont posées à part pour rester lisibles : displayY écarte les libellés proches.

import { levelNearPrice, stackLabelYs } from "./level-label";
import type { FairValueGap, PriceBar, ScenarioPlan, SrZone } from "./types";

export type ScenarioMarkKind = "stop" | "target" | "last" | "entry" | "support" | "resistance" | "fvg";

export interface ScenarioChartBox {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "support" | "resistance" | "entry" | "gap";
}

export interface ScenarioChartMark {
  y: number;
  /** Ordonnée après écartement, pour que les pastilles ne se chevauchent pas. */
  displayY: number;
  kind: ScenarioMarkKind;
  /** Prix principal, ou bas de zone. */
  price: number;
  /** Haut de zone (entrée, support, résistance, FVG). */
  priceHigh: number | null;
  /** Écart en % à afficher (objectifs et invalidation). */
  showDistance: boolean;
  /** Rang d'objectif, à partir de 1. */
  targetIndex: number | null;
}

export interface ScenarioChartModel {
  width: number;
  height: number;
  polyline: string;
  zones: ScenarioChartBox[];
  marks: ScenarioChartMark[];
  arrow: { x1: number; y1: number; x2: number; y2: number } | null;
  title: string;
  lastClose: number | null;
}

const WIDTH = 640;
const HEIGHT = 300;
const PAD_X = 12;
const PAD_Y = 22;
const LABEL_GAP = 28;

function yOf(price: number, min: number, max: number): number {
  const span = max - min || 1;
  return PAD_Y + ((max - price) / span) * (HEIGHT - PAD_Y * 2);
}

export function scenarioChartModel(
  bars: PriceBar[],
  scenario: ScenarioPlan,
  zones: SrZone[],
  title: string,
  gaps: FairValueGap[] = []
): ScenarioChartModel {
  const window = bars.slice(-70);
  const lastClose = window.length > 0 ? window[window.length - 1]!.close : null;
  const near = (price: number) => levelNearPrice(lastClose, price);

  const prices = window.flatMap((bar) => [bar.low, bar.high, bar.close]);
  const consider = (value: number | null | undefined) => {
    if (value != null && near(value)) prices.push(value);
  };
  consider(scenario.entryLow);
  consider(scenario.entryHigh);
  consider(scenario.invalidation);
  for (const target of scenario.targets) consider(target);

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const plotW = WIDTH - PAD_X * 2;
  const step = window.length > 1 ? plotW / (window.length - 1) : plotW;
  const points = window.map((bar, index) => {
    const x = PAD_X + index * step;
    const y = yOf(bar.close, min, max);
    return `${Math.round(x)},${Math.round(y)}`;
  });

  const boxes: ScenarioChartBox[] = [];
  const draft: Omit<ScenarioChartMark, "displayY">[] = [];

  const push = (mark: Omit<ScenarioChartMark, "displayY">) => {
    if (!near(mark.price) && (mark.priceHigh == null || !near(mark.priceHigh))) return;
    draft.push(mark);
  };

  for (const zone of zones.filter((z) => z.kind === "support" || z.kind === "resistance").slice(0, 3)) {
    if (!near(zone.mid) && !near(zone.low) && !near(zone.high)) continue;
    const y1 = yOf(zone.high, min, max);
    const y2 = yOf(zone.low, min, max);
    boxes.push({
      x: PAD_X,
      y: Math.min(y1, y2),
      w: plotW * 0.62,
      h: Math.max(2, Math.abs(y2 - y1)),
      kind: zone.kind === "support" ? "support" : "resistance",
    });
    push({
      y: yOf(zone.mid, min, max),
      kind: zone.kind === "support" ? "support" : "resistance",
      price: zone.low,
      priceHigh: zone.high,
      showDistance: false,
      targetIndex: null,
    });
  }

  for (const gap of gaps.filter((gap) => gap.status !== "filled").slice(-2)) {
    if (!near(gap.low) && !near(gap.high)) continue;
    const y1 = yOf(gap.high, min, max);
    const y2 = yOf(gap.low, min, max);
    boxes.push({
      x: PAD_X,
      y: Math.min(y1, y2),
      w: plotW * 0.62,
      h: Math.max(2, Math.abs(y2 - y1)),
      kind: "gap",
    });
    push({
      y: yOf((gap.low + gap.high) / 2, min, max),
      kind: "fvg",
      price: gap.low,
      priceHigh: gap.high,
      showDistance: false,
      targetIndex: null,
    });
  }

  if (scenario.entryLow != null && scenario.entryHigh != null && (near(scenario.entryLow) || near(scenario.entryHigh))) {
    const y1 = yOf(scenario.entryHigh, min, max);
    const y2 = yOf(scenario.entryLow, min, max);
    boxes.push({
      x: PAD_X,
      y: Math.min(y1, y2),
      w: plotW * 0.62,
      h: Math.max(2, Math.abs(y2 - y1)),
      kind: "entry",
    });
    push({
      y: (y1 + y2) / 2,
      kind: "entry",
      price: scenario.entryLow,
      priceHigh: scenario.entryHigh,
      showDistance: false,
      targetIndex: null,
    });
  }

  if (scenario.invalidation != null) {
    push({
      y: yOf(scenario.invalidation, min, max),
      kind: "stop",
      price: scenario.invalidation,
      priceHigh: null,
      showDistance: true,
      targetIndex: null,
    });
  }
  scenario.targets.forEach((target, index) => {
    push({
      y: yOf(target, min, max),
      kind: "target",
      price: target,
      priceHigh: null,
      showDistance: true,
      targetIndex: index + 1,
    });
  });

  const last = window[window.length - 1];
  let arrow: ScenarioChartModel["arrow"] = null;
  const target = scenario.targets.find((value) => near(value)) ?? null;
  if (last && target != null && window.length > 0) {
    const x1 = PAD_X + (window.length - 1) * step;
    const y1 = yOf(last.close, min, max);
    const x2 = Math.min(PAD_X + plotW * 0.7, x1 + 36);
    const y2 = yOf(target, min, max);
    arrow = { x1, y1, x2, y2 };
    push({
      y: y1,
      kind: "last",
      price: last.close,
      priceHigh: null,
      showDistance: false,
      targetIndex: null,
    });
  } else if (last) {
    push({
      y: yOf(last.close, min, max),
      kind: "last",
      price: last.close,
      priceHigh: null,
      showDistance: false,
      targetIndex: null,
    });
  }

  const display = stackLabelYs(
    draft.map((mark) => mark.y),
    LABEL_GAP,
    12,
    HEIGHT - 12
  );
  const marks: ScenarioChartMark[] = draft.map((mark, index) => ({
    ...mark,
    displayY: display[index] ?? mark.y,
  }));

  return {
    width: WIDTH,
    height: HEIGHT,
    polyline: points.join(" "),
    zones: boxes,
    marks,
    arrow,
    title,
    lastClose,
  };
}
