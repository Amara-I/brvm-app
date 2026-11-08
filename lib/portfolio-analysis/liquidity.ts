import type { PriceBar } from "@/lib/analysis/technical-plan";

export const LIQUIDITY_WINDOW = 20;
export const MIN_VOLUME_OBSERVATIONS = 8;
/** Part des séances à volume nul à partir de laquelle le titre est peu liquide. */
export const NO_TRADE_ILLIQUID = 0.4;
export const NO_TRADE_MODERATE = 0.2;
/** Turnover médian d'une séance, en FCFA. Repères pédagogiques, pas un seuil officiel. */
export const TURNOVER_ILLIQUID_FCFA = 1_000_000;
export const TURNOVER_MODERATE_FCFA = 10_000_000;
/** Jours de volume moyen qu'une sortie ne devrait pas dépasser. */
export const EXIT_DAYS = { LIQUIDE: 10, MOYENNE: 5, ILLIQUIDE: 2 } as const;
/** Au-delà, la série n'est pas traitée comme du quotidien (pas de volume inventé). */
export const DAILY_SERIES_MAX_MEDIAN_GAP = 5;

export type LiquidityBand = "LIQUIDE" | "MOYENNE" | "ILLIQUIDE" | "INCONNUE";

export interface LiquidityAssessment {
  band: LiquidityBand;
  /** Séances à volume 0 / séances dont le volume est connu. Null si inconnu. */
  noTradeRatio: number | null;
  medianDailyTurnoverFcfa: number | null;
  /** Volume moyen des séances avec des échanges. */
  advShares: number | null;
  /** Plafond de titres : ADV × jours de sortie. Null si la liquidité est inconnue. */
  maxShares: number | null;
  exitDays: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function gapDays(earlier: string, later: string): number {
  const ms =
    Date.parse(`${later.slice(0, 10)}T00:00:00.000Z`) - Date.parse(`${earlier.slice(0, 10)}T00:00:00.000Z`);
  return ms / 86_400_000;
}

function unknown(): LiquidityAssessment {
  return {
    band: "INCONNUE",
    noTradeRatio: null,
    medianDailyTurnoverFcfa: null,
    advShares: null,
    maxShares: null,
    exitDays: null,
  };
}

/**
 * `toFcfa` convertit un montant dans la devise du titre. S'il retourne null,
 * le turnover est ignoré et seule la part de séances sans échange classe le titre.
 * Une série non quotidienne (écarts médians > 5 jours) reste « N/D » : on n'invente
 * pas un volume à partir de clôtures annuelles.
 */
export function assessLiquidity(
  bars: readonly PriceBar[],
  toFcfa: (nativeAmount: number) => number | null
): LiquidityAssessment {
  const ordered = [...bars]
    .filter((bar) => Number.isFinite(bar.close) && bar.close > 0 && bar.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const window = ordered.slice(-LIQUIDITY_WINDOW);
  if (window.length < MIN_VOLUME_OBSERVATIONS) return unknown();

  const gaps: number[] = [];
  for (let i = 1; i < window.length; i += 1) gaps.push(gapDays(window[i - 1].date, window[i].date));
  const medianGap = median(gaps);
  if (medianGap == null || medianGap > DAILY_SERIES_MAX_MEDIAN_GAP) return unknown();

  let known = 0;
  let noTrade = 0;
  const positiveVolumes: number[] = [];
  const turnovers: number[] = [];
  for (const bar of window) {
    if (bar.volume == null || !Number.isFinite(bar.volume)) continue;
    known += 1;
    if (bar.volume <= 0) {
      noTrade += 1;
      continue;
    }
    positiveVolumes.push(bar.volume);
    const nativeTurnover = bar.volume * bar.close;
    const fcfa = toFcfa(nativeTurnover);
    if (fcfa != null && Number.isFinite(fcfa)) turnovers.push(fcfa);
  }
  if (known < MIN_VOLUME_OBSERVATIONS) return unknown();

  const noTradeRatio = noTrade / known;
  const medianTurnover = median(turnovers);
  const advShares =
    positiveVolumes.length > 0
      ? positiveVolumes.reduce((sum, value) => sum + value, 0) / positiveVolumes.length
      : 0;

  let band: LiquidityBand = "LIQUIDE";
  if (
    noTradeRatio >= NO_TRADE_ILLIQUID ||
    (medianTurnover != null && medianTurnover < TURNOVER_ILLIQUID_FCFA)
  ) {
    band = "ILLIQUIDE";
  } else if (
    noTradeRatio >= NO_TRADE_MODERATE ||
    (medianTurnover != null && medianTurnover < TURNOVER_MODERATE_FCFA)
  ) {
    band = "MOYENNE";
  }

  const exitDays = EXIT_DAYS[band];
  const maxShares = Math.max(0, Math.floor(advShares * exitDays + 1e-9));
  return {
    band,
    noTradeRatio,
    medianDailyTurnoverFcfa: medianTurnover,
    advShares,
    maxShares,
    exitDays,
  };
}
