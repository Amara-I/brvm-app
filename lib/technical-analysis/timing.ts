// Score de timing −100…100 : tendance (lente) + retournement de momentum (rapide)
// − pénalité d'extension. Il ne décide plus seul du libellé : l'entrée vient d'un
// déclencheur daté (entry-triggers.ts). Le score sert à réserver ACHAT FORT / VENDRE
// aux déclencheurs confirmés par la tendance, et aux probabilités des scénarios.
// Aucune donnée inventée : un indicateur absent ne compte pas.

import { computeEmaSeries, computeRsi } from "@/lib/charts/technical-indicators";
import type { PriceBar, StructureSnapshot } from "./types";

export interface TimingParams {
  /** Écart à l'EMA20 (en ATR) au-delà duquel le mouvement est jugé étiré. */
  extensionAtr: number;
  /** Course depuis l'extrême de 40 séances (en ATR) au-delà de laquelle c'est « tard ». */
  runupAtr: number;
  /** Pondération de la composante momentum (retournements). */
  momentumWeight: number;
  /** Pondération de la composante tendance. */
  trendWeight: number;
}

export const DEFAULT_TIMING_PARAMS: TimingParams = {
  extensionAtr: 2.5,
  runupAtr: 7,
  momentumWeight: 1,
  trendWeight: 1,
};

export interface TimingAssessment {
  /** −100…100. Positif = pression haussière. */
  score: number;
  /** Composante tendance (moyennes, structure). */
  trend: number;
  /** Composante momentum (retournements, cassures). */
  momentum: number;
  /** Pénalité d'extension appliquée (toujours ≥ 0, retirée dans le sens du score). */
  penalty: number;
  /** (clôture − EMA20) / ATR14, signé. */
  extensionAtr: number | null;
  /** Course depuis l'extrême opposé des 40 dernières séances, en ATR (≥ 0). */
  runupAtr: number | null;
  breakout: "up" | "down" | null;
}

function lastOf(series: Array<number | null>, back = 0): number | null {
  const v = series[series.length - 1 - back];
  return v == null || !Number.isFinite(v) ? null : v;
}

function macdHistogramSeries(values: number[]): number[] {
  const fast = computeEmaSeries(values, 12);
  const slow = computeEmaSeries(values, 26);
  const line: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (fast[i] == null || slow[i] == null) continue;
    line.push(fast[i]! - slow[i]!);
  }
  if (line.length < 9) return [];
  const signal = computeEmaSeries(line, 9);
  const out: number[] = [];
  for (let i = 0; i < line.length; i++) if (signal[i] != null) out.push(line[i]! - signal[i]!);
  return out;
}

function sign(n: number): number {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

export function assessTiming(
  bars: PriceBar[],
  structure: StructureSnapshot,
  params: TimingParams = DEFAULT_TIMING_PARAMS
): TimingAssessment {
  const empty: TimingAssessment = {
    score: 0,
    trend: 0,
    momentum: 0,
    penalty: 0,
    extensionAtr: null,
    runupAtr: null,
    breakout: null,
  };
  const last = structure.lastClose;
  if (last == null || bars.length < 8) return empty;
  const values = bars.map((b) => b.close);
  const n = values.length;

  const ema10 = computeEmaSeries(values, 10);
  const ema20 = computeEmaSeries(values, 20);
  const ema50 = computeEmaSeries(values, 50);
  const e10 = lastOf(ema10);
  const e10p = lastOf(ema10, 3);
  const e20 = lastOf(ema20);
  const e50 = lastOf(ema50);
  const e50p = lastOf(ema50, 5);
  const atr = structure.atr14 != null && structure.atr14 > 0 ? structure.atr14 : null;

  // ── Tendance (lente) ────────────────────────────────────────────────────
  let trend = 0;
  if (structure.bias === "bullish") trend += 14;
  else if (structure.bias === "bearish") trend -= 14;
  else {
    const lastLabel = structure.swingLabels[structure.swingLabels.length - 1];
    if (lastLabel === "HL" || lastLabel === "HH") trend += 6;
    else if (lastLabel === "LL" || lastLabel === "LH") trend -= 6;
  }
  if (e20 != null && e50 != null) trend += e20 > e50 ? 10 : e20 < e50 ? -10 : 0;
  else if (e20 != null) trend += last > e20 ? 6 : -6;
  if (e50 != null) trend += last > e50 ? 8 : last < e50 ? -8 : 0;
  if (e50 != null && e50p != null) trend += e50 > e50p ? 6 : e50 < e50p ? -6 : 0;
  if (structure.sma200 != null) trend += last > structure.sma200 ? 6 : -6;

  // ── Momentum (rapide) ───────────────────────────────────────────────────
  let momentum = 0;
  const hist = macdHistogramSeries(values);
  const h0 = hist[hist.length - 1];
  const h1 = hist[hist.length - 2];
  const h2 = hist[hist.length - 3];
  if (h0 != null) momentum += sign(h0) * 8;
  if (h0 != null && h1 != null && h2 != null) {
    if (h0 > h1 && h1 > h2) momentum += 8;
    else if (h0 < h1 && h1 < h2) momentum -= 8;
  }

  const rsi = structure.rsi14;
  const rsiPrev = n > 20 ? computeRsi(values.slice(0, -5), 14) : null;
  if (rsi != null && rsiPrev != null) {
    if (rsi >= 50 && rsi > rsiPrev) momentum += 8;
    else if (rsi < 50 && rsi < rsiPrev) momentum -= 8;
    if (rsiPrev < 50 && rsi >= 50) momentum += 4;
    else if (rsiPrev > 50 && rsi <= 50) momentum -= 4;
  }
  if (rsi != null) {
    if (rsi > 75) momentum -= 8;
    else if (rsi < 25) momentum += 8;
  }

  if (e10 != null && e10p != null) {
    if (last > e10 && e10 > e10p) momentum += 6;
    else if (last < e10 && e10 < e10p) momentum -= 6;
  }

  let breakout: TimingAssessment["breakout"] = null;
  if (n >= 22) {
    const prior = values.slice(n - 21, n - 1);
    const hh = Math.max(...prior);
    const ll = Math.min(...prior);
    const vols = bars
      .slice(n - 21, n - 1)
      .map((b) => b.volume)
      .filter((v): v is number => v != null && v > 0)
      .sort((a, b) => a - b);
    const medVol = vols.length >= 10 ? vols[vols.length >> 1]! : null;
    const vol = bars[n - 1]!.volume;
    const volBoost = medVol != null && vol != null && vol >= 1.5 * medVol ? 4 : 0;
    if (last > hh) {
      breakout = "up";
      momentum += 12 + volBoost;
    } else if (last < ll) {
      breakout = "down";
      momentum -= 12 + volBoost;
    }
  }

  const raw = params.trendWeight * trend + params.momentumWeight * momentum;

  // ── Extension (« trop tard ») ───────────────────────────────────────────
  let extensionAtr: number | null = null;
  let runupAtr: number | null = null;
  let penalty = 0;
  if (atr != null && e20 != null) {
    extensionAtr = Math.round(((last - e20) / atr) * 10) / 10;
    const window = values.slice(Math.max(0, n - 40));
    const ref = raw >= 0 ? Math.min(...window) : Math.max(...window);
    runupAtr = Math.round((Math.abs(last - ref) / atr) * 10) / 10;
    const dir = sign(raw);
    const stretch = dir * extensionAtr;
    if (stretch > params.extensionAtr) penalty += Math.min(30, (stretch - params.extensionAtr) * 12);
    if (dir !== 0 && runupAtr > params.runupAtr) penalty += Math.min(20, (runupAtr - params.runupAtr) * 5);
  }

  const dir = sign(raw);
  let score = raw - dir * penalty;
  if (dir !== 0 && sign(score) !== dir) score = 0;
  score = Math.max(-100, Math.min(100, Math.round(score)));

  return { score, trend, momentum, penalty: Math.round(penalty), extensionAtr, runupAtr, breakout };
}
