/**
 * Contrat du module d'analyse technique (autre PR, BRVM d'abord).
 *
 * Le module doit remplir `TechnicalSetup` par titre :
 *   - `invalidation` : niveau qui invalide l'idée (long : sous le cours)
 *   - `target` : objectif de cours (long : au-dessus du cours)
 *   - `riskReward` : (objectif − cours) / (cours − invalidation), facultatif
 *   - `source` : toujours `"technical"`
 *
 * Point de branchement des données : `loadTechnicalSetups` dans
 * `lib/analysis/load-technical-setups.ts`. Tant qu'il retourne `[]`,
 * `resolveTechnicalPlan` calcule un repli :
 *   1. stop / objectif saisis sur la ligne de portefeuille
 *   2. ATR(14) si des hauts/bas sont fournis : stop = entrée − 2×ATR,
 *      objectif = entrée + 3×ATR
 *   3. sinon la même formule sur le range |clôture − clôture précédente|
 *      (volatilité des clôtures — la base ne stocke pas d'OHLC)
 *
 * Le ratio utilisé pour la taille est toujours recalculé depuis l'entrée
 * courante et les niveaux retenus, pas recopié depuis `riskReward`.
 */

export const TECHNICAL_PLAN_CONTRACT_VERSION = 1;

export const ATR_PERIOD = 14;
export const ATR_STOP_MULTIPLE = 2;
export const ATR_TARGET_MULTIPLE = 3;

export interface TechnicalSetup {
  ticker: string;
  /** Cours de référence du module, dans la devise du titre. */
  referencePrice: number;
  /** Invalidation / stop. Long : strictement sous le cours d'entrée. */
  invalidation: number | null;
  /** Objectif. Long : strictement au-dessus du cours d'entrée. */
  target: number | null;
  /** Pré-calcul du module. Ignoré si les niveaux sont réappliqués à l'entrée courante. */
  riskReward: number | null;
  source: "technical";
  asOf?: string | null;
}

export interface PriceBar {
  date: string;
  close: number;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
}

export type TechnicalPlanSource = "technical" | "holding" | "atr" | "volatility" | "unavailable";

export interface ResolvedTechnicalPlan {
  ticker: string;
  entry: number;
  stop: number | null;
  target: number | null;
  /** (objectif − entrée) / (entrée − stop), ou null si un niveau manque. */
  riskReward: number | null;
  atr: number | null;
  /** (entrée − stop) / entrée, en %. */
  stopDistancePct: number | null;
  /** Origine du stop. L'objectif peut venir d'une source plus faible. */
  source: TechnicalPlanSource;
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** ATR simple (moyenne des `period` derniers true ranges), pas le lissage de Wilder. */
export function averageTrueRange(bars: readonly PriceBar[], period = ATR_PERIOD): number | null {
  const ordered = [...bars]
    .filter((bar) => positive(bar.close))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (ordered.length < period + 1) return null;

  const ranges: number[] = [];
  for (let i = 1; i < ordered.length; i += 1) {
    const prev = ordered[i - 1].close;
    const close = ordered[i].close;
    const high = positive(ordered[i].high) ? (ordered[i].high as number) : Math.max(close, prev);
    const low = positive(ordered[i].low) ? (ordered[i].low as number) : Math.min(close, prev);
    const tr = Math.max(high - low, Math.abs(high - prev), Math.abs(low - prev));
    if (Number.isFinite(tr) && tr >= 0) ranges.push(tr);
  }
  if (ranges.length < period) return null;
  const slice = ranges.slice(-period);
  const sum = slice.reduce((total, value) => total + value, 0);
  return sum / slice.length;
}

function hasOhlc(bars: readonly PriceBar[]): boolean {
  return bars.some(
    (bar) => positive(bar.high) && positive(bar.low) && (bar.high as number) >= (bar.low as number) && (bar.high as number) > (bar.low as number)
  );
}

export function resolveTechnicalPlan(input: {
  ticker: string;
  entry: number;
  setup?: TechnicalSetup | null;
  holdingStop?: number | null;
  holdingTarget?: number | null;
  bars?: readonly PriceBar[];
}): ResolvedTechnicalPlan {
  const ticker = input.ticker.toUpperCase();
  const entry = input.entry;
  const empty: ResolvedTechnicalPlan = {
    ticker,
    entry,
    stop: null,
    target: null,
    riskReward: null,
    atr: null,
    stopDistancePct: null,
    source: "unavailable",
  };
  if (!positive(entry)) return empty;

  const setup =
    input.setup && input.setup.ticker.toUpperCase() === ticker && input.setup.source === "technical"
      ? input.setup
      : null;

  let stop: number | null = null;
  let target: number | null = null;
  let source: TechnicalPlanSource = "unavailable";

  // Une invalidation déjà au-dessus du cours (long) est conservée : le niveau est touché.
  if (setup && positive(setup.invalidation)) {
    stop = setup.invalidation;
    source = "technical";
  }
  if (setup && positive(setup.target) && setup.target > entry) {
    target = setup.target;
  }

  if (stop == null && positive(input.holdingStop)) {
    stop = input.holdingStop;
    source = "holding";
  }
  if (target == null && positive(input.holdingTarget) && input.holdingTarget > entry) {
    target = input.holdingTarget;
    if (source === "unavailable") source = "holding";
  }

  const bars = input.bars ?? [];
  const atr = averageTrueRange(bars, ATR_PERIOD);
  const ranged = hasOhlc(bars);
  const fallbackSource: TechnicalPlanSource = ranged ? "atr" : "volatility";

  if (stop == null && atr != null && atr > 0) {
    const candidate = entry - ATR_STOP_MULTIPLE * atr;
    if (candidate > 0 && candidate < entry) {
      stop = candidate;
      source = fallbackSource;
    }
  }
  if (target == null && atr != null && atr > 0) {
    const candidate = entry + ATR_TARGET_MULTIPLE * atr;
    if (candidate > entry) target = candidate;
  }

  const riskReward =
    stop != null && target != null && stop < entry ? (target - entry) / (entry - stop) : null;

  return {
    ticker,
    entry,
    stop,
    target,
    riskReward,
    atr,
    stopDistancePct: stop != null && stop < entry ? ((entry - stop) / entry) * 100 : null,
    source: stop == null ? "unavailable" : source,
  };
}
