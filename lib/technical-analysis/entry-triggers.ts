// Déclencheurs d'entrée : le signal ACHAT / ALLÉGER naît d'un événement daté
// (repli terminé dans une tendance, cassure d'une base serrée, sortie de survente),
// pas de l'accumulation de moyennes déjà croisées. Il reste affiché `holdSessions`
// séances, sauf si le cours casse le niveau du déclencheur, si la tendance s'inverse,
// ou s'il s'étire trop loin de sa moyenne (« trop tard » : on attend un repli).
//
// Réglages validés par backtest sur l'historique BRVM et NGX
// (scripts/signals/backtest-signal-timing.ts).

import { computeEmaSeries } from "@/lib/charts/technical-indicators";
import type { PriceBar } from "./types";

export type EntryKind = "pullback" | "breakout" | "reversal";
export type EntryStage = "early" | "confirmed" | "extended" | "none";

export interface EntryParams {
  /** Séances pendant lesquelles un déclencheur reste valable. */
  holdSessions: number;
  /** Écart maximal à l'EMA20 (en ATR) pour entrer ; au-delà, c'est trop tard. */
  extensionAtr: number;
  /** RSI(14) minimal touché pendant le repli (achat) — symétrique pour la vente. */
  pullbackRsi: number;
  /** Amplitude maximale (en ATR) des 20 séances précédentes pour une « base serrée ». */
  baseRangeAtr: number;
}

export const DEFAULT_ENTRY_PARAMS: EntryParams = {
  holdSessions: 15,
  extensionAtr: 2,
  pullbackRsi: 40,
  baseRangeAtr: 6,
};

export interface EntryState {
  /** 1 = achat, −1 = vente, 0 = rien d'actionnable. */
  side: 1 | 0 | -1;
  kind: EntryKind | null;
  stage: EntryStage;
  /** Date de la séance déclencheuse. */
  triggeredAt: string | null;
  /** Séances écoulées depuis le déclencheur. */
  sessionsSince: number | null;
  /** (clôture − EMA20) / ATR14, signé. */
  extensionAtr: number | null;
  /** Tendance EMA20/EMA50 : 1 haussière, −1 baissière, 0 indécise. */
  trend: 1 | 0 | -1;
}

const NONE: EntryState = {
  side: 0,
  kind: null,
  stage: "none",
  triggeredAt: null,
  sessionsSince: null,
  extensionAtr: null,
  trend: 0,
};

/** RSI de Wilder en série (même calcul que `computeRsi`, sans arrondi). */
export function rsiSeries(values: number[], period = 14): Array<number | null> {
  const out: Array<number | null> = values.map(() => null);
  if (values.length < period + 1) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i]! - values[i - 1]!;
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i]! - values[i - 1]!;
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

/** ATR de Wilder en série sur les vrais ranges des bougies. */
export function atrSeries(bars: PriceBar[], period = 14): Array<number | null> {
  const out: Array<number | null> = bars.map(() => null);
  if (bars.length < period + 1) return out;
  const tr = (i: number) => {
    const cur = bars[i]!;
    const prev = bars[i - 1]!.close;
    return Math.max(cur.high - cur.low, Math.abs(cur.high - prev), Math.abs(cur.low - prev));
  };
  let atr = 0;
  for (let i = 1; i <= period; i++) atr += tr(i);
  atr /= period;
  out[period] = atr;
  for (let i = period + 1; i < bars.length; i++) {
    atr = (atr * (period - 1) + tr(i)) / period;
    out[i] = atr;
  }
  return out;
}

export function detectEntry(bars: PriceBar[], params: EntryParams = DEFAULT_ENTRY_PARAMS): EntryState {
  const n = bars.length;
  if (n < 60) return NONE;
  const c = bars.map((b) => b.close);
  const e20 = computeEmaSeries(c, 20);
  const e50 = computeEmaSeries(c, 50);
  const rsi = rsiSeries(c, 14);
  const atr = atrSeries(bars, 14);

  const trendAt = (t: number): 1 | 0 | -1 => {
    const a = e20[t];
    const b = e50[t];
    const b10 = e50[t - 10];
    if (a == null || b == null || b10 == null) return 0;
    if (a > b && b >= b10) return 1;
    if (a < b && b <= b10) return -1;
    return 0;
  };

  const triggerAt = (t: number): { side: 1 | -1; kind: EntryKind } | null => {
    const r = rsi[t];
    const rPrev = rsi[t - 1];
    const a = atr[t];
    if (r == null || rPrev == null || a == null || !(a > 0) || e50[t] == null) return null;
    const trend = trendAt(t);
    let found: { side: 1 | -1; kind: EntryKind } | null = null;
    // Repli terminé dans le sens de la tendance : le RSI a touché la zone basse puis remonte.
    let rMin = Infinity;
    let rMax = -Infinity;
    for (let k = Math.max(0, t - 5); k <= t; k++) {
      const v = rsi[k];
      if (v == null) continue;
      rMin = Math.min(rMin, v);
      rMax = Math.max(rMax, v);
    }
    if (trend === 1 && rMin < params.pullbackRsi && r > rPrev && c[t]! > c[t - 1]!) found = { side: 1, kind: "pullback" };
    if (trend === -1 && rMax > 100 - params.pullbackRsi && r < rPrev && c[t]! < c[t - 1]!)
      found = { side: -1, kind: "pullback" };
    // Cassure d'une base serrée (20 séances dans moins de `baseRangeAtr` ATR).
    if (t >= 20) {
      let hh = -Infinity;
      let ll = Infinity;
      for (let k = t - 20; k < t; k++) {
        hh = Math.max(hh, c[k]!);
        ll = Math.min(ll, c[k]!);
      }
      if ((hh - ll) / a <= params.baseRangeAtr) {
        if (c[t]! > hh) found = { side: 1, kind: "breakout" };
        else if (c[t]! < ll) found = { side: -1, kind: "breakout" };
      }
    }
    // Sortie de survente / surachat, hors tendance contraire.
    if (rPrev < 30 && r >= 30 && trend !== -1) found = { side: 1, kind: "reversal" };
    if (rPrev > 70 && r <= 70 && trend !== 1) found = { side: -1, kind: "reversal" };
    return found;
  };

  // Rejoue les dernières séances pour connaître l'état courant (sans état persistant).
  const startAt = Math.max(51, n - 1 - params.holdSessions * 4);
  let side: 1 | 0 | -1 = 0;
  let kind: EntryKind | null = null;
  let at = -1;
  let ref = 0;
  for (let t = startAt; t < n; t++) {
    const trig = triggerAt(t);
    if (trig && (trig.side !== side || t - at >= params.holdSessions)) {
      side = trig.side;
      kind = trig.kind;
      at = t;
      let extreme = c[t]!;
      for (let k = Math.max(0, t - 5); k <= t; k++) extreme = side === 1 ? Math.min(extreme, c[k]!) : Math.max(extreme, c[k]!);
      ref = extreme;
    } else if (trig && trig.side === side) {
      at = t;
      kind = trig.kind;
    }
    if (side !== 0 && t - at >= params.holdSessions) side = 0;
    // Invalidation : clôture au-delà du niveau qui précédait le déclencheur.
    if (side === 1 && c[t]! < ref) side = 0;
    if (side === -1 && c[t]! > ref) side = 0;
  }

  const last = n - 1;
  const trend = trendAt(last);
  const a = atr[last];
  const ema = e20[last];
  const extensionAtr = a != null && a > 0 && ema != null ? Math.round(((c[last]! - ema) / a) * 10) / 10 : null;
  const stretched = (dir: number) => extensionAtr != null && dir * extensionAtr > params.extensionAtr;
  // Pas de déclencheur actif : on signale seulement une tendance déjà étirée (« trop tard »).
  if (side === 0) return { ...NONE, extensionAtr, trend, stage: trend !== 0 && stretched(trend) ? "extended" : "none" };
  const base = {
    kind,
    triggeredAt: bars[at]?.time ?? null,
    sessionsSince: last - at,
    extensionAtr,
    trend,
  };
  // Tendance retournée contre le déclencheur : il ne vaut plus.
  if (trend === -side) return { ...NONE, extensionAtr, trend };
  if (stretched(side)) {
    return { ...base, side: 0, stage: "extended" };
  }
  return { ...base, side, stage: trend === side ? "confirmed" : "early" };
}
