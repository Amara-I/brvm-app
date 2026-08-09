// ═══════════════════════════════════════════════════════════════════════════
// Statistiques agrégées de marché — étape 10 (landing page + pages du menu)
// ═══════════════════════════════════════════════════════════════════════════
// Factorise le calcul des KPI agrégés déjà affichés dans
// `components/BrvmDashboardClient.tsx` (bandeau "SOCIÉTÉS COTÉES / CAPITALISATION
// TOTALE / REND. MOYEN MARCHÉ / PERF. MOY. 5 ANS / SIGNAUX ACHAT / HORIZON
// DONNÉES") pour pouvoir les réutiliser sur la landing page et le Screener
// SANS dupliquer la formule ni risquer une divergence de chiffres entre pages
// — même philosophie "zéro duplication de logique métier" que le reste du
// projet (cf. AGENTS.md § Étape 5).
//
// ⚠️ Ne modifie PAS `BrvmDashboardClient.tsx` (qui garde son propre calcul
// inline, contrainte non-négociable "ne jamais casser un onglet déjà
// fonctionnel") — ce module est utilisé uniquement par les NOUVELLES pages.
// ═══════════════════════════════════════════════════════════════════════════

import { calcMetrics } from "@/lib/calc/calc-metrics";
import type { CompaniesFullDataset } from "@/lib/api/companies-full-dataset";

export interface MarketSummaryStats {
  companiesCount: number;
  totalMarketCapBnFcfa: number;
  avgDividendYieldPercent: number | null;
  avgPerf5Percent: number | null;
  buySignalsCount: number;
  firstYear: number | null;
  lastYear: number | null;
}

export function computeMarketSummaryStats(dataset: CompaniesFullDataset): MarketSummaryStats {
  const { years, companies } = dataset;

  const metricsByTicker = new Map(companies.map((co) => [co.ticker, calcMetrics({ years, prices: co.prices, dividends: co.dividends, per: co.per })]));

  const totalMarketCapBnFcfa = companies.reduce((a, b) => a + b.mktcap, 0);

  const yields = companies.map((c) => parseFloat(String(metricsByTicker.get(c.ticker)!.dividendYieldPercent))).filter((v) => !Number.isNaN(v));
  const avgDividendYieldPercent = yields.length ? yields.reduce((a, b) => a + b, 0) / yields.length : null;

  const perf5Values = companies
    .map((c) => metricsByTicker.get(c.ticker)!.perf5Percent)
    .filter((v) => v !== "N/D")
    .map((v) => parseFloat(v));
  const avgPerf5Percent = perf5Values.length ? perf5Values.reduce((a, b) => a + b, 0) / perf5Values.length : null;

  const buySignalsCount = companies.filter((c) => metricsByTicker.get(c.ticker)!.score >= 65).length;

  return {
    companiesCount: companies.length,
    totalMarketCapBnFcfa,
    avgDividendYieldPercent,
    avgPerf5Percent,
    buySignalsCount,
    firstYear: years[0] ?? null,
    lastYear: years[years.length - 1] ?? null,
  };
}

export interface CompanyWithMetrics {
  co: CompaniesFullDataset["companies"][number];
  metrics: ReturnType<typeof calcMetrics>;
}

/// Toutes les sociétés avec leurs métriques `calcMetrics` déjà calculées —
/// utilisé par le Screener (`app/screener/page.tsx`) pour permettre un tri
////filtrage instantané côté client SANS recalculer les métriques (déjà
/// calculées côté serveur, même fonction que le dashboard et l'export Excel).
export function allCompaniesWithMetrics(dataset: CompaniesFullDataset): CompanyWithMetrics[] {
  const { years, companies } = dataset;
  return companies.map((co) => ({ co, metrics: calcMetrics({ years, prices: co.prices, dividends: co.dividends, per: co.per }) }));
}

/// Sociétés les mieux notées (score `calcMetrics` décroissant), pour les
/// aperçus/cartes de la landing page — n'affiche jamais de donnée inventée :
/// si `limit` dépasse le nombre de sociétés disponibles, retourne simplement
/// tout ce qui existe.
export function topScoredCompanies(dataset: CompaniesFullDataset, limit: number): CompanyWithMetrics[] {
  return allCompaniesWithMetrics(dataset)
    .sort((a, b) => b.metrics.score - a.metrics.score)
    .slice(0, limit);
}
