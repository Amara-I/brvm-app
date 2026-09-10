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
import { pricesSyncedToLatestClose } from "@/lib/calc/sync-prices-to-closes";
import type { CompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import type { ChartClosePoint } from "@/lib/charts/indicators";

export interface MarketSummaryStats {
  companiesCount: number;
  totalMarketCapBnFcfa: number;
  avgDividendYieldPercent: number | null;
  avgPerf5Percent: number | null;
  buySignalsCount: number;
  firstYear: number | null;
  lastYear: number | null;
}

export function computeMarketSummaryStats(
  dataset: CompaniesFullDataset,
  closesByTicker?: Record<string, ChartClosePoint[]>
): MarketSummaryStats {
  const { years, companies } = dataset;

  const metricsByTicker = new Map(
    companies.map((co) => {
      const closes = closesByTicker?.[co.ticker];
      return [
        co.ticker,
        calcMetrics({
          years,
          prices: pricesSyncedToLatestClose(co.prices, closes),
          dividends: co.dividends,
          per: co.per,
          mktcap: co.mktcap,
          sector: co.sector,
          closes: closes && closes.length > 0 ? closes : undefined,
        }),
      ] as const;
    })
  );

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
export function allCompaniesWithMetrics(
  dataset: CompaniesFullDataset,
  closesByTicker?: Record<string, ChartClosePoint[]>
): CompanyWithMetrics[] {
  const { years, companies } = dataset;
  return companies.map((co) => {
    const closes = closesByTicker?.[co.ticker];
    return {
      co,
      metrics: calcMetrics({
        years,
        prices: pricesSyncedToLatestClose(co.prices, closes),
        dividends: co.dividends,
        per: co.per,
        mktcap: co.mktcap,
        sector: co.sector,
        closes: closes && closes.length > 0 ? closes : undefined,
      }),
    };
  });
}

/// Sociétés les mieux notées (score `calcMetrics` décroissant), pour les
/// aperçus/cartes de la landing page — n'affiche jamais de donnée inventée :
/// si `limit` dépasse le nombre de sociétés disponibles, retourne simplement
/// tout ce qui existe.
export function topScoredCompanies(
  dataset: CompaniesFullDataset,
  limit: number,
  closesByTicker?: Record<string, ChartClosePoint[]>
): CompanyWithMetrics[] {
  return allCompaniesWithMetrics(dataset, closesByTicker)
    .sort((a, b) => b.metrics.score - a.metrics.score)
    .slice(0, limit);
}

export interface SectorGroupEntry {
  ticker: string;
  name: string;
  countryFlag: string;
  /// Dernier cours de clôture canonique disponible, ou `null` si aucune
  /// donnée (affiché "N/D" côté UI, jamais inventé).
  lastPrice: number | null;
}

export interface SectorGroup {
  sector: string;
  companies: SectorGroupEntry[];
}

/// Regroupe les sociétés par secteur (méga-menu "Sociétés cotées", structure
/// inspirée de ouestbourse.com — cf. AGENTS.md § Étape 11), triées par ordre
/// alphabétique de secteur puis de société. Utilise le dernier cours de
/// clôture CONNU (annuel) comme "dernier cours" affiché : le jeu de données
/// ne contient pas de variation intrajournalière réelle, donc la variation
/// n'est délibérément pas calculée ici (affichée "N/D" côté UI plutôt qu'un
/// chiffre inventé).
export function groupCompaniesBySector(dataset: CompaniesFullDataset): SectorGroup[] {
  const { years, companies } = dataset;

  const bySector = new Map<string, SectorGroupEntry[]>();
  for (const co of companies) {
    let lastPrice: number | null = null;
    for (let i = years.length - 1; i >= 0; i--) {
      const y = years[i]!;
      const p = co.prices[y];
      if (p != null && p > 0) {
        lastPrice = p;
        break;
      }
    }
    const entry: SectorGroupEntry = { ticker: co.ticker, name: co.name, countryFlag: co.countryFlag, lastPrice };
    const bucket = bySector.get(co.sector) ?? [];
    bucket.push(entry);
    bySector.set(co.sector, bucket);
  }

  return [...bySector.entries()]
    .map(([sector, list]) => ({ sector, companies: list.sort((a, b) => a.name.localeCompare(b.name, "fr")) }))
    .sort((a, b) => a.sector.localeCompare(b.sector, "fr"));
}
