import { PLAN_RANK, type ViewerPlan } from "./plans";

/**
 * Fonctionnalités gated et palier minimum *futur*.
 * Aujourd'hui `can()` ignore ce palier pour tout utilisateur connecté
 * (accès effectif = PREMIUM). La carte sert de contrat pour Light / Premium.
 */
export const FEATURES = [
  "chart.range.5A",
  "chart.range.MAX",
  "chart.indicators.advanced",
  "chart.drawings",
  "chart.saveAnalysis",
  "signal.badges",
  "signal.reasons",
  "signal.scenarios",
  "fundamental.teaser",
  "fundamental.full",
  "fundamentals.accounts",
  "sheet.projection",
  "sheet.comparison",
  "screener.advancedFilters",
  "dividends.history",
  "export.marketExcel",
  "news.full",
] as const;

export type Feature = (typeof FEATURES)[number];

export const FEATURE_MIN_PLAN: Record<Feature, ViewerPlan> = {
  "chart.range.5A": "ANON",
  "chart.range.MAX": "PREMIUM",
  "chart.indicators.advanced": "LIGHT",
  "chart.drawings": "PREMIUM",
  "chart.saveAnalysis": "FREE",
  "signal.badges": "FREE",
  "signal.reasons": "PREMIUM",
  "signal.scenarios": "PREMIUM",
  "fundamental.teaser": "ANON",
  "fundamental.full": "LIGHT",
  "fundamentals.accounts": "LIGHT",
  "sheet.projection": "PREMIUM",
  "sheet.comparison": "LIGHT",
  "screener.advancedFilters": "LIGHT",
  "dividends.history": "FREE",
  "export.marketExcel": "PREMIUM",
  "news.full": "FREE",
};

export function planAllows(accessPlan: ViewerPlan, feature: Feature): boolean {
  return PLAN_RANK[accessPlan] >= PLAN_RANK[FEATURE_MIN_PLAN[feature]];
}
