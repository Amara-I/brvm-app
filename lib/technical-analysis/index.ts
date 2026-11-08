// API publique de l'analyse technique BRVM.
// Le portefeuille importe `technicalLevels` pour le stop, les cibles et le R/R.

export { analyzePriceHistory } from "./analyze";
export { analyzePriceHistoryCached, clearTechnicalAnalysisCache, seriesFingerprint } from "./cache";
export { applyTechnicalSignal, patchFromAnalysis, technicalSignalPatch } from "./apply-signal";
export type { TechnicalSignalPatch } from "./apply-signal";
export { chartLevelLines } from "./chart-lines";
export type { ChartLevelLine } from "./chart-lines";
export { technicalLevels } from "./levels";
export { detectSupportResistance, detectSwings } from "./support-resistance";
export { detectFairValueGaps } from "./fvg";
export { assessLiquidity } from "./liquidity";
export { buildScenarios } from "./scenarios";
export { decideSignal } from "./signal";
export { scenarioChartModel } from "./scenario-chart";
export type {
  CloseInput,
  ConfidenceLevel,
  FairValueGap,
  PriceBar,
  ScenarioPlan,
  SrZone,
  TechnicalAnalysis,
  TechnicalLevels,
} from "./types";
