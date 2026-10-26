import type { RiskPillarKey } from "@/lib/calc/risk-analysis";
import type { Locale } from "@/lib/i18n/config";
import type { TFunc } from "@/lib/i18n/create-i18n";
import type { LabelsApi } from "@/lib/i18n/labels";

const PILLAR_SHORT_EN: Record<RiskPillarKey, string> = {
  marche: "market",
  liquidite: "liquidity",
  fondamental: "fundamental",
  operationnel: "operational",
};

/** Résumé de risque : le français reste la phrase calculée, l'anglais est reconstruit. */
export function displayRiskSummary(
  analysis: {
    riskTier: string;
    riskScore: number;
    summary: string;
    pillars: Array<{ key: string; score: number | null }>;
  },
  locale: Locale,
  labels: LabelsApi
): string {
  if (locale !== "en") return analysis.summary;
  const tier = labels.riskTier(analysis.riskTier);
  const head = `${tier} risk (score ${analysis.riskScore}/100).`;
  const scored = analysis.pillars.filter((p) => p.score != null).slice(0, 3);
  if (scored.length === 0) return `${head} Insufficient data for a pillar breakdown.`;
  const parts = scored.map((p) => `${PILLAR_SHORT_EN[p.key as RiskPillarKey] ?? p.key} ${p.score}`);
  return `${head} Pillars: ${parts.join(", ")}.`;
}

export function displayPillarNote(note: string, locale: Locale, labels: LabelsApi): string {
  const out = labels.riskNote(note);
  if (locale !== "en") return out;
  return out
    .replace(/\u202f/g, ",")
    .replace(/“([^”]+)”/g, (_, name: string) => `“${labels.sector(name)}”`);
}

export function translateDataSourceLabel(label: string, t: TFunc): string {
  if (label === "BRVM officiel") return t("market.sources.brvm");
  if (label === "Saisie manuelle") return t("market.sources.manual");
  return label;
}

export function translateExchangeName(code: string, fallback: string, t: TFunc): string {
  if (code === "BRVM") return t("market.exchange.brvmName");
  if (code === "BVMAC") return t("market.exchange.bvmacName");
  return fallback;
}

export function translateExchangeRegion(code: string, fallback: string, t: TFunc): string {
  if (code === "BRVM") return t("market.exchange.brvmRegion");
  if (code === "JSE") return t("market.exchange.jseRegion");
  if (code === "TSE") return t("market.exchange.tseRegion");
  return fallback;
}
