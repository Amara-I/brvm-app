// Analyse technique BRVM — types sérialisables (props RSC, cache mémoire).
// Les cours manquants restent null / tableaux vides, jamais inventés.

import type { TradeSignal } from "@/lib/calc/calc-metrics";

export type ConfidenceLevel = "Élevée" | "Moyenne" | "Faible";
export type ZoneKind = "support" | "resistance" | "pivot";
export type GapSide = "bullish" | "bearish";
export type GapStatus = "open" | "partial" | "filled";
export type StructureBias = "bullish" | "bearish" | "neutral";
export type ScenarioBias = "bullish" | "neutral" | "bearish";

/** Bougie journalière. Si la base n'a que la clôture, O = clôture précédente. */
export interface PriceBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface CloseInput {
  time: string;
  value: number;
  volume?: number | null;
}

export interface SrZone {
  id: string;
  kind: ZoneKind;
  low: number;
  high: number;
  mid: number;
  /** Tests distincts (le cours quitte la zone entre deux tests). */
  touches: number;
  /** 0 = ancien, 1 = dernier barreau de la fenêtre. */
  recency: number;
  /** 0–100, touches pondérés par la récence. */
  strength: number;
  /** Réactions favorables après un test (rebond support / rejet résistance). */
  bounces: number;
  /** Clôtures au-delà de la zone après un test. */
  breaks: number;
  lastTouch: string | null;
}

export interface FairValueGap {
  id: string;
  side: GapSide;
  /** Date de la bougie d'impulsion (milieu du trio). */
  time: string;
  low: number;
  high: number;
  status: GapStatus;
  filledAt: string | null;
}

export interface StructureSnapshot {
  bias: StructureBias;
  /** Derniers swings : HH, HL, LH, LL. */
  swingLabels: string[];
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  macdHistogram: number | null;
  atr14: number | null;
  lastClose: number | null;
  asOf: string | null;
}

export interface LiquiditySnapshot {
  illiquid: boolean;
  /** 0 = liquide, 100 = très illiquide. */
  score: number;
  warningFr: string | null;
  warningEn: string | null;
  flatShare: number | null;
  zeroVolumeShare: number | null;
  wideGapShare: number | null;
  medianGapDays: number | null;
  bars: number;
  volumeKnown: boolean;
}

export interface ScenarioPlan {
  id: ScenarioBias;
  bias: ScenarioBias;
  /** Probabilité indicative 0–100. Les trois scénarios somment à 100. */
  probability: number;
  /** Une phrase : ce que le scénario suppose. */
  headlineFr: string;
  headlineEn: string;
  /** Pourquoi, à partir de l'historique (1–2 phrases). Conservé aussi dans explanation*. */
  explanationFr: string;
  explanationEn: string;
  entryLow: number | null;
  entryHigh: number | null;
  invalidation: number | null;
  targets: number[];
  /** Cible 1 vs milieu d'entrée / distance d'invalidation. Null si non chiffrable. */
  riskReward: number | null;
}

export interface TechnicalSignal {
  label: TradeSignal["label"];
  /** Score de timing −100…100 (pas le score qualité société). */
  timingScore: number;
  confidence: ConfidenceLevel;
}

export interface TechnicalAnalysis {
  /** Barres réellement lues (fenêtre récente plafonnée). */
  barsUsed: number;
  /** Dernières bougies pour les figures de scénario. */
  chartBars: PriceBar[];
  zones: SrZone[];
  gaps: FairValueGap[];
  structure: StructureSnapshot;
  liquidity: LiquiditySnapshot;
  scenarios: ScenarioPlan[];
  signal: TechnicalSignal;
}

/**
 * Niveaux du scénario retenu pour le sizing de position.
 * `stop` est l'invalidation : le module portefeuille peut l'importer tel quel.
 */
export interface TechnicalLevels {
  asOf: string | null;
  lastClose: number | null;
  atr14: number | null;
  bias: ScenarioBias;
  signal: TradeSignal["label"];
  confidence: ConfidenceLevel;
  entryLow: number | null;
  entryHigh: number | null;
  invalidation: number | null;
  stop: number | null;
  targets: number[];
  riskReward: number | null;
}
