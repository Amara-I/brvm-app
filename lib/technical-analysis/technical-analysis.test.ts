import { describe, expect, it } from "vitest";
import { applyTechnicalSignal } from "./apply-signal";
import { analyzePriceHistory } from "./analyze";
import { signalReasons } from "./signal";
import { detectFairValueGaps } from "./fvg";
import { technicalLevels } from "./levels";
import { chartLevelLines } from "./chart-lines";
import { formatDistancePct, formatFcfa, stackLabelBoxes, stackLabelYs } from "./level-label";
import { mostProbableScenarioIndex, projectionArrow, scenarioChartModel } from "./scenario-chart";
import { signalOf } from "@/lib/calc/calc-metrics";
import { detectSupportResistance } from "./support-resistance";
import type { CloseInput, PriceBar } from "./types";

function day(index: number): string {
  const date = new Date(Date.UTC(2022, 0, 3));
  date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString().slice(0, 10);
}

function candle(index: number, close: number, low: number, high: number, volume = 8000): PriceBar {
  return { time: day(index), open: close, close, high, low, volume };
}

function closes(values: number[], volume = 12000, step = 1): CloseInput[] {
  return values.map((value, index) => ({ time: day(index * step), value, volume }));
}

function trend(count: number, start: number, step: number): CloseInput[] {
  const values: number[] = [];
  let price = start;
  for (let i = 0; i < count; i++) {
    const phase = i % 12;
    price += phase < 8 ? step : step * -0.65;
    values.push(Math.round(price));
  }
  return closes(values);
}

/** Générateur déterministe (Mulberry32) : vol = amplitude quotidienne, drift = tendance. */
function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseSeries(seed: number, n: number, vol: number, drift: (i: number, n: number) => number): CloseInput[] {
  const rng = mulberry(seed);
  const values: number[] = [];
  let price = 1000;
  for (let i = 0; i < n; i++) {
    price = Math.max(10, price * (1 + drift(i, n) + (rng() - 0.5) * vol));
    values.push(Math.round(price * 100) / 100);
  }
  return values.map((value, index) => ({ time: day(index), value, volume: 20000 }));
}

describe("supports et résistances", () => {
  const bars: PriceBar[] = [];
  for (let i = 0; i < 40; i++) bars.push(candle(i, 120, 118, 122));
  for (const index of [8, 18, 28]) bars[index] = candle(index, 100, 100, 104);
  for (const index of [13, 23, 33]) bars[index] = candle(index, 140, 136, 140);

  const zones = detectSupportResistance(bars, 4);

  it("regroupe les swings bas en un support et les swings hauts en une résistance", () => {
    const support = zones.find((zone) => zone.kind === "support");
    const resistance = zones.find((zone) => zone.kind === "resistance");
    expect(support).toBeTruthy();
    expect(resistance).toBeTruthy();
    expect(support!.mid).toBeGreaterThan(90);
    expect(support!.mid).toBeLessThan(110);
    expect(support!.touches).toBeGreaterThanOrEqual(2);
    expect(resistance!.mid).toBeGreaterThan(130);
    expect(resistance!.mid).toBeLessThan(150);
    expect(resistance!.touches).toBeGreaterThanOrEqual(2);
    expect(support!.strength).toBeGreaterThan(0);
    expect(support!.recency).toBeGreaterThan(0);
  });
});

describe("fair value gaps", () => {
  it("détecte un FVG haussier ouvert puis un FVG comblé", () => {
    const bars: PriceBar[] = [];
    for (let i = 0; i < 12; i++) bars.push(candle(i, 100, 99, 101));
    bars[4] = candle(4, 100, 98, 102);
    bars[5] = candle(5, 130, 120, 132);
    bars[6] = candle(6, 128, 122, 130);
    bars[8] = candle(8, 90, 88, 96);
    bars[9] = candle(9, 70, 68, 80);
    bars[10] = candle(10, 72, 70, 74);

    const gaps = detectFairValueGaps(bars, 3);
    const bull = gaps.find((gap) => gap.side === "bullish");
    expect(bull).toBeTruthy();
    expect(bull!.low).toBeLessThan(bull!.high);
    expect(bull!.status === "open" || bull!.status === "partial" || bull!.status === "filled").toBe(true);

    const bear = gaps.find((gap) => gap.side === "bearish");
    expect(bear).toBeTruthy();
    expect(["open", "partial", "filled"]).toContain(bear!.status);
  });

  it("marque comblé un gap ensuite entièrement revisité", () => {
    const bars: PriceBar[] = [];
    for (let i = 0; i < 8; i++) bars.push(candle(i, 100, 99, 101));
    bars[2] = candle(2, 100, 98, 101);
    bars[3] = candle(3, 140, 130, 142);
    bars[4] = candle(4, 138, 136, 140);
    bars[6] = candle(6, 90, 90, 100);
    const gaps = detectFairValueGaps(bars, 2);
    const bull = gaps.find((gap) => gap.side === "bullish");
    expect(bull?.status).toBe("filled");
    expect(bull?.filledAt).toBeTruthy();
  });
});

describe("signal technique", () => {
  it("lit un ACHAT au début d'une hausse liquide, pas après une course déjà étirée", () => {
    const early = analyzePriceHistory(noiseSeries(15, 220, 0.02, (i, n) => (i < n - 8 ? 0 : 0.004)));
    expect(["ACHAT FORT", "ACHAT"]).toContain(early.signal.label);
    expect(early.signal.stage === "early" || early.signal.stage === "confirmed").toBe(true);
    expect(early.signal.confidence === "Faible").toBe(false);
    expect(early.liquidity.illiquid).toBe(false);
    expect(signalReasons(early).some((r) => r.code === "ta.extended")).toBe(false);

    const stretched = analyzePriceHistory(trend(180, 1000, 8));
    expect(stretched.signal.label).toBe("CONSERVER");
    expect(stretched.signal.stage).toBe("extended");
    expect(signalReasons(stretched).some((r) => r.code === "ta.extended")).toBe(true);
  });

  it("lit un ALLÉGER ou VENDRE au début d'une baisse liquide", () => {
    const analysis = analyzePriceHistory(noiseSeries(4, 260, 0.02, () => -0.0015));
    expect(["ALLÉGER", "VENDRE"]).toContain(analysis.signal.label);
    expect(analysis.signal.stage === "early" || analysis.signal.stage === "confirmed").toBe(true);
  });

  it("refuse un signal fort et baisse la confiance si le titre est illiquide", () => {
    const values: number[] = [];
    let price = 1000;
    for (let i = 0; i < 36; i++) {
      if (i % 2 === 0) values.push(price);
      else {
        price = Math.round(price * (i % 6 === 0 ? 1.18 : 1.01));
        values.push(price);
      }
    }
    const analysis = analyzePriceHistory(closes(values, 0, 8));
    expect(analysis.liquidity.illiquid).toBe(true);
    expect(analysis.liquidity.warningFr).toMatch(/Liquidité faible/);
    expect(analysis.signal.confidence).toBe("Faible");
    expect(analysis.signal.label).not.toBe("ACHAT FORT");
    expect(analysis.signal.label).not.toBe("VENDRE");
  });

  it("laisse le score qualité inchangé quand on remplace le signal", () => {
    const base = {
      score: 84,
      signal: signalOf("ACHAT FORT"),
      confidence: "Élevée" as const,
      signalSummary: "ancien signal composite",
      signalReasons: [],
    };
    const next = applyTechnicalSignal(base, trend(180, 5000, -8));
    expect(next.score).toBe(84);
    expect(["ALLÉGER", "VENDRE", "CONSERVER"]).toContain(next.signal.label);
    expect(next.signalSummary).toMatch(/timing de court terme/);
    expect(next.signal.label).not.toBe("ACHAT FORT");
  });
});

describe("scénarios", () => {
  const analysis = analyzePriceHistory(trend(160, 2000, 6));

  it("propose trois scénarios dont les probabilités somment à 100", () => {
    expect(analysis.scenarios.map((s) => s.bias)).toEqual(["bullish", "neutral", "bearish"]);
    const sum = analysis.scenarios.reduce((acc, scenario) => acc + scenario.probability, 0);
    expect(sum).toBe(100);
    for (const scenario of analysis.scenarios) {
      expect(scenario.explanationFr.length).toBeGreaterThan(40);
      expect(scenario.invalidation).not.toBeNull();
      expect(scenario.targets.length).toBeGreaterThan(0);
      expect(scenario.entryLow).not.toBeNull();
      expect(scenario.entryHigh).not.toBeNull();
    }
  });

  it("dessine une figure annotée avec les prix et des pastilles écartées", () => {
    expect(formatFcfa(4125)).toBe("4\u202f125\u00a0FCFA");
    expect(formatDistancePct(4000, 4320)).toBe("+8,0\u00a0%");
    expect(formatDistancePct(4000, 3792)).toBe("−5,2\u00a0%");
    const stacked = stackLabelYs([10, 14, 80], 20, 0, 200);
    expect(stacked[1]! - stacked[0]!).toBeGreaterThanOrEqual(20);
    const boxes = stackLabelBoxes([50, 55, 200], [40, 48, 40], 0, 400, 6);
    expect(boxes[1]! - boxes[0]!).toBeGreaterThanOrEqual(40 / 2 + 6 + 48 / 2);
    expect(boxes[0]! - 20).toBeGreaterThanOrEqual(0);
    expect(boxes[2]! + 20).toBeLessThanOrEqual(400);

    const bull = analysis.scenarios.find((scenario) => scenario.bias === "bullish") ?? analysis.scenarios[0]!;
    const model = scenarioChartModel(analysis.chartBars, bull, analysis.zones, "Haussier", analysis.gaps, {
      width: 380,
      height: 260,
      gutter: 120,
    });
    expect(model.polyline.split(" ").length).toBeGreaterThan(5);
    // Format compact (taille d'avant la PR #115).
    expect(model.width).toBe(380);
    expect(model.height).toBe(260);
    expect(model.gutter).toBe(120);
    expect(model.plotRight).toBe(model.width - model.gutter);
    expect(model.marks.some((mark) => mark.kind === "stop" && mark.price > 0 && mark.showDistance)).toBe(true);
    expect(model.marks.some((mark) => mark.kind === "target" && mark.showDistance)).toBe(true);
    expect(model.marks.some((mark) => mark.kind === "last")).toBe(true);
    const chartKinds = new Set(model.marks.map((mark) => mark.kind));
    expect(
      [...chartKinds].every((kind) => ["stop", "target", "last", "entry", "support", "resistance"].includes(kind))
    ).toBe(true);
    // Zone de projection réservée à droite de la dernière séance.
    const xs = model.polyline.split(" ").map((pt) => Number(pt.split(",")[0]));
    expect(Math.max(...xs)).toBeLessThanOrEqual(model.lastX + 0.5);
    expect(model.plotRight - model.lastX).toBeGreaterThanOrEqual(40);
    // Étiquettes sans chevauchement, dans le cadre.
    const ordered = [...model.marks].sort((a, b) => a.displayY - b.displayY);
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i]!.displayY - ordered[i - 1]!.displayY).toBeGreaterThanOrEqual(model.tagHeight);
    }
    for (const mark of model.marks) {
      expect(mark.displayY - model.tagHeight / 2).toBeGreaterThanOrEqual(0);
      expect(mark.displayY + model.tagHeight / 2).toBeLessThanOrEqual(model.height);
    }
    expect(model.leaders).toHaveLength(model.marks.length);
    for (const leader of model.leaders) {
      expect(leader.x1).toBe(model.plotRight);
      expect(leader.x3).toBeGreaterThan(model.plotRight);
    }
    // La flèche part de la dernière séance et va vers la droite.
    expect(model.arrow).not.toBeNull();
    expect(model.arrow!.x1).toBeGreaterThanOrEqual(model.lastX);
    expect(model.arrow!.x2).toBeGreaterThan(model.arrow!.x1);
    expect(model.arrow!.x2).toBeLessThanOrEqual(model.plotRight);
    if (model.zones.some((zone) => zone.kind === "gap")) {
      expect(model.tags.some((tag) => tag.kind === "fvg")).toBe(true);
      expect(model.marks.some((mark) => mark.kind === "fvg")).toBe(false);
    }
    const lines = chartLevelLines(analysis);
    expect(lines.some((line) => line.title.includes("FCFA") && line.title.startsWith("Objectif"))).toBe(true);
    expect(lines.some((line) => line.title.includes("Invalidation") && line.title.includes("%"))).toBe(true);
    expect(lines.some((line) => line.title.startsWith("Cours"))).toBe(true);
  });

  it("oriente la flèche de projection vers la droite selon le scénario", () => {
    const up = projectionArrow(200, 100, 260, 40, "bullish");
    expect(up.direction).toBe("up");
    expect(up.x2).toBeGreaterThan(up.x1);
    expect(up.y2).toBeLessThan(up.y1);
    const down = projectionArrow(200, 100, 260, 160, "bearish");
    expect(down.direction).toBe("down");
    expect(down.x2).toBeGreaterThan(down.x1);
    expect(down.y2).toBeGreaterThan(down.y1);
    const flat = projectionArrow(200, 100, 260, 160, "neutral");
    expect(flat.direction).toBe("flat");
    expect(flat.y2).toBe(flat.y1);
    expect(flat.x2).toBeGreaterThan(flat.x1);
    const headXs = up.head.split(" ").map((pt) => Number(pt.split(",")[0]));
    expect(headXs[0]).toBe(Math.max(...headXs));
  });

  it("désigne le scénario le plus probable, égalités départagées", () => {
    expect(
      mostProbableScenarioIndex([
        { bias: "bullish", probability: 30 },
        { bias: "neutral", probability: 45 },
        { bias: "bearish", probability: 25 },
      ])
    ).toBe(1);
    const tie = [
      { bias: "bullish" as const, probability: 40 },
      { bias: "neutral" as const, probability: 20 },
      { bias: "bearish" as const, probability: 40 },
    ];
    expect(mostProbableScenarioIndex(tie, "bearish")).toBe(2);
    expect(mostProbableScenarioIndex(tie, "neutral")).toBe(0);
    expect(mostProbableScenarioIndex(tie)).toBe(0);
    expect(mostProbableScenarioIndex([])).toBe(-1);
  });

  it("expose stop, cibles et risque/rendement pour le sizing", () => {
    const levels = technicalLevels(analysis);
    expect(levels.stop).toBe(levels.invalidation);
    expect(levels.stop).not.toBeNull();
    expect(levels.targets.length).toBeGreaterThan(0);
    expect(levels.entryLow).not.toBeNull();
    expect(levels.signal).toBe(analysis.signal.label);
    if (levels.riskReward != null) expect(levels.riskReward).toBeGreaterThan(0);
  });
});

describe("devise des libellés (FCFA BRVM, ₦ NGX)", () => {
  it("formate le naira avec 2 décimales et le FCFA en entier", async () => {
    const { formatPrice, formatPriceRange } = await import("./level-label");
    expect(formatPrice(4125, "XOF")).toBe("4\u202f125\u00a0FCFA");
    expect(formatPrice(1250.5, "NGN")).toBe("₦1\u202f250,50");
    expect(formatPrice(0.47, "NGN")).toBe("₦0,47");
    expect(formatPriceRange(13.1, 12.5, "NGN")).toBe("₦12,50 – ₦13,10");
    expect(formatPriceRange(4300, 4100, "XOF")).toBe("4\u202f100 – 4\u202f300\u00a0FCFA");
    expect(formatPrice(1250.5, "NGN", "en")).toBe("₦1,250.50");
    // Aucun espace sécable dans un prix : seul le tiret d'une fourchette peut couper la ligne.
    expect(formatPrice(246932.6, "PTS")).not.toMatch(/ /);
    expect(formatPriceRange(4100, 4300, "XOF").split(" ")).toEqual([`4${"\u202f"}100`, "–", `4${"\u202f"}300${"\u00a0"}FCFA`]);
  });

  it("analyse en naira : traits et scénarios sans FCFA ; défaut BRVM inchangé", () => {
    const points = trend(160, 20, 0.15);
    const ngx = analyzePriceHistory(points, { currency: "NGN" });
    const brvm = analyzePriceHistory(points);
    expect(ngx.currency).toBe("NGN");
    expect(brvm.currency).toBe("XOF");
    const ngxTitles = chartLevelLines(ngx).map((l) => l.title).join(" ");
    expect(ngxTitles).toContain("₦");
    expect(ngxTitles).not.toContain("FCFA");
    expect(chartLevelLines(brvm).some((l) => l.title.includes("FCFA"))).toBe(true);
    const copy = ngx.scenarios.map((s) => s.explanationFr).join(" ");
    expect(copy).not.toContain("FCFA");
    // Le signal ne dépend pas de la devise.
    expect(ngx.signal).toEqual(brvm.signal);
  });

  it("le cache distingue les devises", async () => {
    const { analyzePriceHistoryCached, clearTechnicalAnalysisCache } = await import("./cache");
    clearTechnicalAnalysisCache();
    const points = trend(120, 30, 0.1);
    expect(analyzePriceHistoryCached(points, { currency: "NGN" }).currency).toBe("NGN");
    expect(analyzePriceHistoryCached(points).currency).toBe("XOF");
  });
});
