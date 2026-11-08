/**
 * Situation de marché à partir de séries fournies.
 * Aucun chiffre n'est inventé : série absente → null / INCONNU / N/D.
 *
 * Tendance : variation sur 30 et 90 jours calendaires de l'indice de tête
 * (BRVM Composite, NGX ASI, sinon la première série).
 * Volatilité : écart-type des variations quotidiennes × √252, seulement si
 * l'écart médian entre points est ≤ 5 jours.
 * Largeur : hausses / (hausses + baisses). Une variation |Δ| < 0,05 point
 * est plate. `changePercent` est déjà en % (1,2 = +1,2 %).
 * Macro : si taux directeur ET inflation sont des nombres, un taux réel
 * ≤ −3 points ramène un régime favorable à neutre. Sinon le régime ne change pas.
 */

export const TREND_THRESHOLD = 0.03;
export const HIGH_VOL_PCT = 25;
export const BREADTH_RISK_OFF = 0.4;
export const BREADTH_RISK_ON = 0.55;
export const MIN_BREADTH_SIDES = 5;
export const MIN_VOL_RETURNS = 15;
export const FLAT_CHANGE_PCT = 0.05;
export const REAL_RATE_RISK_ON_CUTOFF = -3;

export type TrendDirection = "HAUSSE" | "BAISSE" | "NEUTRE" | "INCONNU";
export type MarketRegime = "RISK_ON" | "NEUTRE" | "RISK_OFF" | "INCONNU";
export type MacroNote = "incomplete" | "real_rate_negative" | "real_rate_positive" | "real_rate_mixed";

export const MACRO_SLOT_IDS = [
  "bceao_policy_rate",
  "uemoa_inflation",
  "cbn_policy_rate",
  "nigeria_inflation",
  "xof_per_ngn",
] as const;
export type MacroSlotId = (typeof MACRO_SLOT_IDS)[number];

export interface MacroReading {
  id: MacroSlotId;
  /** Null = série non branchée. */
  value: number | null;
  asOf: string | null;
  source: string | null;
  unit: "percent" | "xof";
}

export interface IndexPoint {
  date: string;
  value: number;
}

export interface IndexSeries {
  code: string;
  name: string;
  points: IndexPoint[];
}

export interface MarketAssessment {
  indexCode: string | null;
  indexName: string | null;
  asOf: string | null;
  last: number | null;
  change1mPct: number | null;
  change3mPct: number | null;
  realizedVolPct: number | null;
  direction: TrendDirection;
  breadthRising: number;
  breadthFalling: number;
  breadthFlat: number;
  breadthUnknown: number;
  /** Hausses / (hausses + baisses). Null si moins de 5 titres orientés. */
  breadthRatio: number | null;
  /** Régime avant le taux réel. */
  baseRegime: MarketRegime;
  regime: MarketRegime;
  macroNote: MacroNote;
}

export function emptyMacroReadings(): MacroReading[] {
  return [
    { id: "bceao_policy_rate", value: null, asOf: null, source: null, unit: "percent" },
    { id: "uemoa_inflation", value: null, asOf: null, source: null, unit: "percent" },
    { id: "cbn_policy_rate", value: null, asOf: null, source: null, unit: "percent" },
    { id: "nigeria_inflation", value: null, asOf: null, source: null, unit: "percent" },
    { id: "xof_per_ngn", value: null, asOf: null, source: null, unit: "xof" },
  ];
}

function iso(date: string): string {
  return date.slice(0, 10);
}

function addDays(date: string, days: number): string {
  const value = new Date(`${iso(date)}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function closestOnOrBefore(points: IndexPoint[], target: string): IndexPoint | null {
  let best: IndexPoint | null = null;
  for (const point of points) {
    if (iso(point.date) <= target) best = point;
  }
  return best;
}

function sampleStdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function changeOver(points: IndexPoint[], last: IndexPoint, calendarDays: number, slackDays: number): number | null {
  const target = addDays(iso(last.date), -calendarDays);
  const then = closestOnOrBefore(points, target);
  if (!then || iso(then.date) === iso(last.date) || !(then.value > 0)) return null;
  const age = (Date.parse(`${target}T00:00:00.000Z`) - Date.parse(`${iso(then.date)}T00:00:00.000Z`)) / 86_400_000;
  // Un point trop ancien ne représente pas la fenêtre (ex. une clôture annuelle).
  if (age > slackDays) return null;
  return last.value / then.value - 1;
}

export function indexTrend(points: readonly IndexPoint[]): {
  asOf: string | null;
  last: number | null;
  change1mPct: number | null;
  change3mPct: number | null;
  realizedVolPct: number | null;
  direction: TrendDirection;
} {
  const ordered = [...points]
    .filter((point) => Number.isFinite(point.value) && point.value > 0 && point.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const last = ordered[ordered.length - 1];
  if (!last) {
    return {
      asOf: null,
      last: null,
      change1mPct: null,
      change3mPct: null,
      realizedVolPct: null,
      direction: "INCONNU",
    };
  }

  const change1m = changeOver(ordered, last, 30, 7);
  const change3m = changeOver(ordered, last, 90, 15);
  const primary = change3m ?? change1m;
  const confirm = change1m;
  let direction: TrendDirection = "NEUTRE";
  if (primary == null) direction = "INCONNU";
  else if (primary > TREND_THRESHOLD && (confirm == null || confirm > 0)) direction = "HAUSSE";
  else if (primary < -TREND_THRESHOLD && (confirm == null || confirm < 0)) direction = "BAISSE";

  let realizedVolPct: number | null = null;
  const gaps: number[] = [];
  for (let i = 1; i < ordered.length; i += 1) {
    const ms =
      Date.parse(`${iso(ordered[i].date)}T00:00:00.000Z`) -
      Date.parse(`${iso(ordered[i - 1].date)}T00:00:00.000Z`);
    gaps.push(ms / 86_400_000);
  }
  const recentGaps = gaps.slice(-40);
  const medianGap = median(recentGaps);
  if (medianGap != null && medianGap <= 5) {
    const returns: number[] = [];
    const start = Math.max(1, ordered.length - 60);
    for (let i = start; i < ordered.length; i += 1) {
      const prev = ordered[i - 1].value;
      if (prev > 0) returns.push(ordered[i].value / prev - 1);
    }
    const stdev = returns.length >= MIN_VOL_RETURNS ? sampleStdev(returns) : null;
    if (stdev != null) realizedVolPct = stdev * Math.sqrt(252) * 100;
  }

  return {
    asOf: iso(last.date),
    last: last.value,
    change1mPct: change1m == null ? null : change1m * 100,
    change3mPct: change3m == null ? null : change3m * 100,
    realizedVolPct,
    direction,
  };
}

export function marketBreadth(changes: readonly (number | null)[]): {
  rising: number;
  falling: number;
  flat: number;
  unknown: number;
  ratio: number | null;
} {
  let rising = 0;
  let falling = 0;
  let flat = 0;
  let unknown = 0;
  for (const change of changes) {
    if (change == null || !Number.isFinite(change)) {
      unknown += 1;
      continue;
    }
    if (Math.abs(change) < FLAT_CHANGE_PCT) flat += 1;
    else if (change > 0) rising += 1;
    else falling += 1;
  }
  const sided = rising + falling;
  return {
    rising,
    falling,
    flat,
    unknown,
    ratio: sided >= MIN_BREADTH_SIDES ? rising / sided : null,
  };
}

export function combineRegime(input: {
  direction: TrendDirection;
  realizedVolPct: number | null;
  breadthRatio: number | null;
}): MarketRegime {
  if (input.direction === "INCONNU" && input.breadthRatio == null) return "INCONNU";
  const highVol = input.realizedVolPct != null && input.realizedVolPct >= HIGH_VOL_PCT;
  if (input.direction === "BAISSE" || (input.breadthRatio != null && input.breadthRatio < BREADTH_RISK_OFF)) {
    return "RISK_OFF";
  }
  if (
    input.direction === "HAUSSE" &&
    (input.breadthRatio == null || input.breadthRatio >= BREADTH_RISK_ON) &&
    !highVol
  ) {
    return "RISK_ON";
  }
  return "NEUTRE";
}

export function applyMacro(regime: MarketRegime, policyRate: number | null, inflation: number | null): {
  regime: MarketRegime;
  note: MacroNote;
} {
  if (policyRate == null || inflation == null || !Number.isFinite(policyRate) || !Number.isFinite(inflation)) {
    return { regime, note: "incomplete" };
  }
  const real = policyRate - inflation;
  if (real <= REAL_RATE_RISK_ON_CUTOFF) {
    return {
      regime: regime === "RISK_ON" ? "NEUTRE" : regime,
      note: "real_rate_negative",
    };
  }
  if (real >= 1) return { regime, note: "real_rate_positive" };
  return { regime, note: "real_rate_mixed" };
}

const HEADLINE: Record<"BRVM" | "NGX", string> = {
  BRVM: "BRVM_COMPOSITE",
  NGX: "NGX_ASI",
};

export function assessMarket(input: {
  market: "BRVM" | "NGX";
  series: readonly IndexSeries[];
  breadthChanges: readonly (number | null)[];
  policyRate: number | null;
  inflation: number | null;
}): MarketAssessment {
  const preferred = input.series.find((series) => series.code === HEADLINE[input.market]) ?? input.series[0] ?? null;
  const trend = indexTrend(preferred?.points ?? []);
  const breadth = marketBreadth(input.breadthChanges);
  const baseRegime = combineRegime({
    direction: trend.direction,
    realizedVolPct: trend.realizedVolPct,
    breadthRatio: breadth.ratio,
  });
  const macro = applyMacro(baseRegime, input.policyRate, input.inflation);
  return {
    indexCode: preferred?.code ?? null,
    indexName: preferred?.name ?? null,
    asOf: trend.asOf,
    last: trend.last,
    change1mPct: trend.change1mPct,
    change3mPct: trend.change3mPct,
    realizedVolPct: trend.realizedVolPct,
    direction: trend.direction,
    breadthRising: breadth.rising,
    breadthFalling: breadth.falling,
    breadthFlat: breadth.flat,
    breadthUnknown: breadth.unknown,
    breadthRatio: breadth.ratio,
    baseRegime,
    regime: macro.regime,
    macroNote: macro.note,
  };
}
