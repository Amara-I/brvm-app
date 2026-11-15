// Géométrie d'un graphique de scénario (SVG maison), calculée en pixels réels
// pour un rendu net à toute largeur. Inspiré des graphes « Trading Central » :
// - lignes de niveau fines sur toute la largeur du tracé ;
// - étiquettes de prix pleines, collées sur l'axe des prix à droite, écartées
//   verticalement pour ne jamais se chevaucher ;
// - zone « future » réservée à droite de la dernière séance, où part la flèche
//   de projection (toujours vers la droite : haut-droite, bas-droite ou à plat).

import { levelNearPrice, stackLabelYs } from "./level-label";
import type { FairValueGap, PriceBar, ScenarioBias, ScenarioPlan, SrZone } from "./types";

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
  /** Ordonnée de l'étiquette après écartement, pour que les étiquettes ne se chevauchent pas. */
  displayY: number;
  kind: ScenarioMarkKind;
  /** Prix principal, ou bas de zone. */
  price: number;
  /** Haut de zone (entrée). */
  priceHigh: number | null;
  /** Écart en % à afficher (objectifs et invalidation). */
  showDistance: boolean;
  /** Rang d'objectif, à partir de 1. */
  targetIndex: number | null;
}

/** Trait de rappel entre la ligne de niveau (y) et son étiquette écartée (displayY). */
export interface ScenarioChartLeader {
  kind: ScenarioMarkKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
}

export interface ScenarioChartTag {
  kind: "fvg";
  x: number;
  y: number;
}

export interface ScenarioChartArrow {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Pointe de flèche (triangle) déjà orientée, en coordonnées du SVG. */
  head: string;
  /** "up" = haut-droite, "down" = bas-droite, "flat" = droite. */
  direction: "up" | "down" | "flat";
}

export interface ScenarioChartModel {
  width: number;
  height: number;
  plotLeft: number;
  /** Fin du tracé (début de l'axe des prix). Les lignes de niveau s'arrêtent ici. */
  plotRight: number;
  /** Largeur de l'axe des prix à droite (colonne des étiquettes). */
  gutter: number;
  plotTop: number;
  plotBottom: number;
  /** Abscisse de la dernière séance : à droite commence la zone de projection. */
  lastX: number;
  polyline: string;
  /** Aire sous la courbe (fond dégradé). */
  area: string;
  zones: ScenarioChartBox[];
  marks: ScenarioChartMark[];
  leaders: ScenarioChartLeader[];
  tags: ScenarioChartTag[];
  arrow: ScenarioChartArrow | null;
  /** Hauteur d'une étiquette de prix (px). */
  tagHeight: number;
  title: string;
  lastClose: number | null;
}

export interface ScenarioChartSize {
  /** Largeur rendue en pixels. */
  width?: number;
  /** Hauteur rendue en pixels. */
  height?: number;
  /** Largeur de l'axe des prix (étiquettes). */
  gutter?: number;
}

/** Valeurs par défaut (rendu serveur, avant la mesure du conteneur). Format compact. */
export const SCENARIO_CHART = {
  width: 380,
  height: 260,
  padLeft: 8,
  padY: 16,
  gutter: 72,
  /** Part du tracé réservée à la projection, à droite de la dernière séance. */
  futureShare: 0.26,
  futureMin: 44,
  tagHeight: 16,
  tagGap: 3,
  leaderBend: 8,
} as const;

/** Écart relatif sous lequel un support/résistance double un niveau du plan : on ne l'étiquette pas. */
const DUPLICATE_LEVEL = 0.006;

export function scenarioChartModel(
  bars: PriceBar[],
  scenario: ScenarioPlan,
  zones: SrZone[],
  title: string,
  gaps: FairValueGap[] = [],
  size: ScenarioChartSize = {}
): ScenarioChartModel {
  const width = Math.max(220, Math.round(size.width ?? SCENARIO_CHART.width));
  const height = Math.max(160, Math.round(size.height ?? SCENARIO_CHART.height));
  const gutter = Math.min(Math.round(size.gutter ?? SCENARIO_CHART.gutter), Math.round(width * 0.45));
  const padLeft = SCENARIO_CHART.padLeft;
  const padY = SCENARIO_CHART.padY;
  const tagH = SCENARIO_CHART.tagHeight;
  const plotRight = width - gutter;
  const plotTop = padY;
  const plotBottom = height - padY;
  const futureW = Math.max(SCENARIO_CHART.futureMin, (plotRight - padLeft) * SCENARIO_CHART.futureShare);
  const lastX = plotRight - futureW;
  const histW = lastX - padLeft;

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

  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 1;
  const span = max - min || Math.max(1, Math.abs(max) * 0.02);
  const yOf = (price: number) => plotTop + ((max - price) / span) * (plotBottom - plotTop);

  const step = window.length > 1 ? histW / (window.length - 1) : 0;
  const pts = window.map((bar, index) => [padLeft + index * step, yOf(bar.close)] as const);
  const r = (value: number) => Math.round(value * 10) / 10;
  const polyline = pts.map(([x, y]) => `${r(x)},${r(y)}`).join(" ");
  const area =
    pts.length > 1
      ? `M${r(pts[0]![0])},${r(plotBottom)} ${pts.map(([x, y]) => `L${r(x)},${r(y)}`).join(" ")} L${r(pts[pts.length - 1]![0])},${r(plotBottom)} Z`
      : "";

  const boxes: ScenarioChartBox[] = [];
  const tags: ScenarioChartTag[] = [];
  const draft: Omit<ScenarioChartMark, "displayY">[] = [];
  const planLevels: number[] = [];

  const push = (mark: Omit<ScenarioChartMark, "displayY">) => {
    if (!near(mark.price) && (mark.priceHigh == null || !near(mark.priceHigh))) return;
    draft.push(mark);
  };
  const band = (low: number, high: number, kind: ScenarioChartBox["kind"]) => {
    const y1 = yOf(high);
    const y2 = yOf(low);
    boxes.push({ x: padLeft, y: Math.min(y1, y2), w: plotRight - padLeft, h: Math.max(2, Math.abs(y2 - y1)), kind });
  };

  // FVG : bande + petit tag à gauche, pas d'étiquette sur l'axe.
  for (const gap of gaps.filter((gap) => gap.status !== "filled").slice(-1)) {
    if (!near(gap.low) && !near(gap.high)) continue;
    band(gap.low, gap.high, "gap");
    const top = Math.min(yOf(gap.high), yOf(gap.low));
    const h = Math.max(2, Math.abs(yOf(gap.low) - yOf(gap.high)));
    tags.push({ kind: "fvg", x: padLeft + 4, y: top + h / 2 });
  }

  if (scenario.entryLow != null && scenario.entryHigh != null && (near(scenario.entryLow) || near(scenario.entryHigh))) {
    band(scenario.entryLow, scenario.entryHigh, "entry");
    planLevels.push(scenario.entryLow, scenario.entryHigh);
    push({
      y: (yOf(scenario.entryLow) + yOf(scenario.entryHigh)) / 2,
      kind: "entry",
      price: scenario.entryLow,
      priceHigh: scenario.entryHigh,
      showDistance: false,
      targetIndex: null,
    });
  }

  if (scenario.invalidation != null) {
    planLevels.push(scenario.invalidation);
    push({
      y: yOf(scenario.invalidation),
      kind: "stop",
      price: scenario.invalidation,
      priceHigh: null,
      showDistance: true,
      targetIndex: null,
    });
  }
  scenario.targets.forEach((target, index) => {
    planLevels.push(target);
    push({
      y: yOf(target),
      kind: "target",
      price: target,
      priceHigh: null,
      showDistance: true,
      targetIndex: index + 1,
    });
  });

  // Support le plus proche sous le cours, résistance la plus proche au-dessus,
  // sauf s'ils doublent un niveau du plan (déjà étiqueté).
  if (lastClose != null) {
    const duplicate = (price: number) => planLevels.some((level) => Math.abs(level - price) / lastClose <= DUPLICATE_LEVEL);
    const support = zones
      .filter((zone) => zone.kind === "support" && zone.mid < lastClose && near(zone.mid))
      .sort((a, b) => b.mid - a.mid)[0];
    const resistance = zones
      .filter((zone) => zone.kind === "resistance" && zone.mid > lastClose && near(zone.mid))
      .sort((a, b) => a.mid - b.mid)[0];
    for (const zone of [resistance, support]) {
      if (!zone || duplicate(zone.mid)) continue;
      push({
        y: yOf(zone.mid),
        kind: zone.kind === "support" ? "support" : "resistance",
        price: zone.mid,
        priceHigh: null,
        showDistance: false,
        targetIndex: null,
      });
    }
  }

  const last = window[window.length - 1];
  let arrow: ScenarioChartArrow | null = null;
  if (last) {
    const y1 = yOf(last.close);
    push({ y: y1, kind: "last", price: last.close, priceHigh: null, showDistance: false, targetIndex: null });
    const target = scenario.targets.find((value) => near(value)) ?? null;
    if (target != null) arrow = projectionArrow(lastX, y1, plotRight, yOf(target), scenario.bias);
  }

  const half = tagH / 2;
  const display = stackLabelYs(
    draft.map((mark) => mark.y),
    tagH + SCENARIO_CHART.tagGap,
    half + 1,
    height - half - 1
  );
  const marks: ScenarioChartMark[] = draft.map((mark, index) => ({
    ...mark,
    displayY: display[index] ?? mark.y,
  }));

  const bend = plotRight + SCENARIO_CHART.leaderBend;
  const leaders: ScenarioChartLeader[] = marks.map((mark) => ({
    kind: mark.kind,
    x1: plotRight,
    y1: mark.y,
    x2: bend,
    y2: mark.displayY,
    x3: bend + 2,
    y3: mark.displayY,
  }));

  return {
    width,
    height,
    plotLeft: padLeft,
    plotRight,
    gutter,
    plotTop,
    plotBottom,
    lastX,
    polyline,
    area,
    zones: boxes,
    marks,
    leaders,
    tags,
    arrow,
    tagHeight: tagH,
    title,
    lastClose,
  };
}

/**
 * Flèche de projection : part de la dernière séance et file vers la droite,
 * dans la zone future, en direction de l'objectif. Jamais vers la gauche.
 */
export function projectionArrow(
  lastX: number,
  lastY: number,
  plotRight: number,
  targetY: number,
  bias: ScenarioBias
): ScenarioChartArrow {
  const futureW = Math.max(12, plotRight - lastX);
  const x1 = lastX + 3;
  const x2 = lastX + futureW * 0.78;
  let y2 = targetY;
  // Neutre (range) : à plat vers la droite. Sinon, pente visible même si l'objectif est très proche.
  if (bias === "neutral") y2 = lastY;
  else if (bias === "bullish" && y2 > lastY - 8) y2 = lastY - 8;
  else if (bias === "bearish" && y2 < lastY + 8) y2 = lastY + 8;
  const direction: ScenarioChartArrow["direction"] = Math.abs(y2 - lastY) < 1 ? "flat" : y2 < lastY ? "up" : "down";

  const angle = Math.atan2(y2 - lastY, x2 - x1);
  const len = 9;
  const spread = 0.5;
  const p = (a: number) => `${Math.round((x2 - len * Math.cos(a)) * 10) / 10},${Math.round((y2 - len * Math.sin(a)) * 10) / 10}`;
  const head = `${Math.round(x2 * 10) / 10},${Math.round(y2 * 10) / 10} ${p(angle - spread)} ${p(angle + spread)}`;
  // La ligne s'arrête à la base de la pointe pour un trait net.
  const shaft = len * 0.7;
  return {
    x1,
    y1: lastY,
    x2: x2 - shaft * Math.cos(angle),
    y2: y2 - shaft * Math.sin(angle),
    head,
    direction,
  };
}

/**
 * Index du scénario le plus probable. Égalité : celui qui suit la structure
 * du marché, puis l'ordre haussier → neutre → baissier. Déterministe.
 */
export function mostProbableScenarioIndex(
  scenarios: Pick<ScenarioPlan, "probability" | "bias">[],
  structureBias?: string | null
): number {
  if (scenarios.length === 0) return -1;
  const order: Record<string, number> = { bullish: 0, neutral: 1, bearish: 2 };
  let best = 0;
  for (let i = 1; i < scenarios.length; i++) {
    const a = scenarios[i]!;
    const b = scenarios[best]!;
    if (a.probability > b.probability) {
      best = i;
      continue;
    }
    if (a.probability < b.probability) continue;
    const aMatch = structureBias != null && a.bias === structureBias ? 0 : 1;
    const bMatch = structureBias != null && b.bias === structureBias ? 0 : 1;
    if (aMatch < bMatch || (aMatch === bMatch && (order[a.bias] ?? 9) < (order[b.bias] ?? 9))) best = i;
  }
  return best;
}
