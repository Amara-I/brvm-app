// Jeu de données seed pour l'affichage LOCAL lorsque Postgres n'est pas
// joignable (`next dev` sans Docker / sans DATABASE_URL).
// Source : `prisma/seed-data/companies-full.ts` — jamais présenté comme
// cours live en production (repli vide + "N/D" à la place).

import { COMPANIES_FULL, YEARS } from "@/prisma/seed-data/companies-full";
import type { CompaniesFullDataset, CompanyFullDataset } from "@/lib/api/companies-full-dataset";
import type { NavCompany } from "@/lib/api/companies-nav-index";
import type { SectorGroup } from "@/lib/calc/market-summary-stats";

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
