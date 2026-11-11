import { describe, expect, it } from "vitest";
import { applyTechnicalSignal } from "./apply-signal";
import { analyzePriceHistory } from "./analyze";
import { detectFairValueGaps } from "./fvg";
import { technicalLevels } from "./levels";
import { chartLevelLines } from "./chart-lines";
import { formatDistancePct, formatFcfa, stackLabelYs } from "./level-label";
import { scenarioChartModel } from "./scenario-chart";
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
  it("lit un ACHAT sur une tendance haussière liquide", () => {
    const analysis = analyzePriceHistory(trend(180, 1000, 8));
    expect(["ACHAT FORT", "ACHAT"]).toContain(analysis.signal.label);
    expect(analysis.signal.confidence === "Faible").toBe(false);
    expect(analysis.liquidity.illiquid).toBe(false);
  });

  it("lit un ALLÉGER ou VENDRE sur une tendance baissière liquide", () => {
    const analysis = analyzePriceHistory(trend(180, 5000, -8));
    expect(["ALLÉGER", "VENDRE"]).toContain(analysis.signal.label);
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
    expect(formatFcfa(4125)).toBe("4 125 FCFA");
    expect(formatDistancePct(4000, 4320)).toBe("+8,0 %");
    expect(formatDistancePct(4000, 3792)).toBe("−5,2 %");
    const stacked = stackLabelYs([10, 14, 80], 20, 0, 200);
    expect(stacked[1]! - stacked[0]!).toBeGreaterThanOrEqual(20);

    const bull = analysis.scenarios[0]!;
    const model = scenarioChartModel(analysis.chartBars, bull, analysis.zones, "Haussier", analysis.gaps);
    expect(model.polyline.split(" ").length).toBeGreaterThan(5);
    expect(model.marks.some((mark) => mark.kind === "stop" && mark.price > 0 && mark.showDistance)).toBe(true);
    expect(model.marks.some((mark) => mark.kind === "target" && mark.showDistance)).toBe(true);
    expect(model.marks.some((mark) => mark.kind === "last")).toBe(true);
    const ordered = [...model.marks].sort((a, b) => a.displayY - b.displayY);
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i]!.displayY).toBeGreaterThan(ordered[i - 1]!.displayY);
    }
    const lines = chartLevelLines(analysis);
    expect(lines.some((line) => line.title.includes("FCFA") && line.title.startsWith("Objectif"))).toBe(true);
    expect(lines.some((line) => line.title.includes("Invalidation") && line.title.includes("%"))).toBe(true);
    expect(lines.some((line) => line.title.startsWith("Cours"))).toBe(true);
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
