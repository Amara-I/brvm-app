// Jeu de données seed pour l'affichage LOCAL lorsque Postgres n'est pas
// joignable (`next dev` sans Docker / sans DATABASE_URL).
// Source : `prisma/seed-data/companies-full.ts` — jamais présenté comme
// cours live en production (repli vide + "N/D" à la place).

import { COMPANIES_FULL, YEARS } from "@/prisma/seed-data/companies-full";
import type { CompaniesFullDataset, CompanyFullDataset } from "@/lib/api/companies-full-dataset";
import type { NavCompany } from "@/lib/api/companies-nav-index";
import type { SectorGroup } from "@/lib/calc/market-summary-stats";
import {
  chartCatalogHref,
  chartCatalogKey,
  groupChartCatalog,
  hiddenCatalogCounts,
  INDEX_COLOR,
  type ChartCatalog,
  type ChartCatalogEntry,
} from "@/lib/charts/chart-catalog-core";

function lastListedPrice(prices: Record<number, number>): number | null {
  const years = Object.keys(prices)
    .map(Number)
    .sort((a, b) => a - b);
  for (let i = years.length - 1; i >= 0; i--) {
    const v = prices[years[i]!];
    if (v != null && v > 0) return v;
  }
  return null;
}

export function seedCompaniesFullDataset(): CompaniesFullDataset {
  const yearsSet = new Set<number>();
  const companies: CompanyFullDataset[] = COMPANIES_FULL.map((co) => {
    for (const y of YEARS) {
      if ((co.prices[y] ?? 0) > 0 || (co.dividends[y] ?? 0) > 0) yearsSet.add(y);
    }
    return {
      ticker: co.ticker,
      name: co.name,
      country: co.country,
      countryFlag: co.flag,
      sector: co.sector,
      per: co.per,
      mktcap: co.mktcap,
      roe: null,
      netMargin: null,
      debtRatio: null,
      pbRatio: null,
      revenueGrowth: null,
      fcf: null,
      prevPer: null,
      prevMktcap: null,
      prevRoe: null,
      prevNetMargin: null,
      prevDebtRatio: null,
      prevPbRatio: null,
      prevRevenueGrowth: null,
      prevFcf: null,
      prices: { ...co.prices },
      dividends: { ...co.dividends },
      color: co.color,
      dataSource: "MANUEL",
      lastSyncedAt: null,
    };
  });

  return {
    years: [...yearsSet].sort((a, b) => a - b),
    companies,
    generatedAt: new Date().toISOString(),
  };
}

export function seedCompaniesNavIndex(): {
  companies: NavCompany[];
  sectorGroups: SectorGroup[];
} {
  const navCompanies: NavCompany[] = COMPANIES_FULL.map((co) => ({
    ticker: co.ticker,
    name: co.name,
    sector: co.sector,
    countryFlag: co.flag,
    lastPrice: lastListedPrice(co.prices),
  }));

  const bySector = new Map<string, SectorGroup["companies"]>();
  for (const co of navCompanies) {
    const list = bySector.get(co.sector) ?? [];
    list.push({
      ticker: co.ticker,
      name: co.name,
      countryFlag: co.countryFlag,
      lastPrice: co.lastPrice,
    });
    bySector.set(co.sector, list);
  }

  const sectorGroups = [...bySector.entries()]
    .map(([sector, list]) => ({
      sector,
      companies: list.sort((a, b) => a.name.localeCompare(b.name, "fr")),
    }))
    .sort((a, b) => a.sector.localeCompare(b.sector, "fr"));

  return { companies: navCompanies, sectorGroups };
}

const SEED_BRVM_INDICES: Array<{ code: string; name: string }> = [
  { code: "BRVM_COMPOSITE", name: "BRVM Composite" },
  { code: "BRVM_30", name: "BRVM 30" },
];

const SEED_NGX_COMPANIES: Array<{ ticker: string; name: string; sector: string }> = [
  { ticker: "MTNN", name: "MTN Nigeria", sector: "Télécoms" },
  { ticker: "GTCO", name: "Guaranty Trust Holding", sector: "Banques" },
];

const SEED_NGX_INDICES: Array<{ code: string; name: string }> = [
  { code: "NGX_ASI", name: "NGX All-Share Index" },
  { code: "NGX30", name: "NGX 30" },
];

/** Catalogue de graphes pour l'affichage local sans Postgres. */
export function seedChartCatalog(): ChartCatalog {
  const companies: ChartCatalogEntry[] = [
    ...COMPANIES_FULL.map((co) => {
      const base = { kind: "company" as const, symbol: co.ticker, exchange: "BRVM" };
      return {
        key: chartCatalogKey(base),
        symbol: co.ticker,
        name: co.name,
        exchange: "BRVM",
        kind: "company" as const,
        sector: co.sector,
        countryFlag: co.flag,
        color: co.color || INDEX_COLOR,
        href: chartCatalogHref(base),
      };
    }),
    ...SEED_NGX_COMPANIES.map((co) => {
      const base = { kind: "company" as const, symbol: co.ticker, exchange: "NGX" };
      return {
        key: chartCatalogKey(base),
        symbol: co.ticker,
        name: co.name,
        exchange: "NGX",
        kind: "company" as const,
        sector: co.sector,
        countryFlag: "🇳🇬",
        color: INDEX_COLOR,
        href: chartCatalogHref(base),
      };
    }),
  ];
  const indices: ChartCatalogEntry[] = [
    ...SEED_BRVM_INDICES.map((row) => {
      const base = { kind: "index" as const, symbol: row.code, exchange: "BRVM" };
      return {
        key: chartCatalogKey(base),
        symbol: row.code,
        name: row.name,
        exchange: "BRVM",
        kind: "index" as const,
        sector: null,
        countryFlag: "",
        color: INDEX_COLOR,
        href: chartCatalogHref(base),
      };
    }),
    ...SEED_NGX_INDICES.map((row) => {
      const base = { kind: "index" as const, symbol: row.code, exchange: "NGX" };
      return {
        key: chartCatalogKey(base),
        symbol: row.code,
        name: row.name,
        exchange: "NGX",
        kind: "index" as const,
        sector: null,
        countryFlag: "🇳🇬",
        color: INDEX_COLOR,
        href: chartCatalogHref(base),
      };
    }),
  ];
  const hidden = hiddenCatalogCounts(
    { companies: companies.length, indices: indices.length },
    { companies: companies.length, indices: indices.length }
  );
  return {
    entries: [...companies, ...indices],
    groups: groupChartCatalog([...companies, ...indices]),
    visibleCompanies: companies.length,
    visibleIndices: indices.length,
    ...hidden,
  };
}
