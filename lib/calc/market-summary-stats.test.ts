import { describe, expect, it } from "vitest";
import { computeMarketSummaryStats, topScoredCompanies, allCompaniesWithMetrics } from "./market-summary-stats";
import type { CompaniesFullDataset } from "@/lib/api/companies-full-dataset";

const dataset: CompaniesFullDataset = {
  years: [2020, 2021, 2022, 2023, 2024, 2025],
  companies: [
    {
      ticker: "AAA",
      name: "Société A",
      country: "Côte d'Ivoire",
      countryFlag: "🇨🇮",
      sector: "Banques",
      per: 8,
      mktcap: 100,
      prices: { 2020: 1000, 2021: 1100, 2022: 1200, 2023: 1300, 2024: 1400, 2025: 1500 },
      dividends: { 2020: 50, 2021: 50, 2022: 60, 2023: 60, 2024: 70, 2025: 70 },
      color: "#000",
      dataSource: null,
      lastSyncedAt: null,
    },
    {
      ticker: "BBB",
      name: "Société B",
      country: "Sénégal",
      countryFlag: "🇸🇳",
      sector: "Télécoms",
      per: 12,
      mktcap: 200,
      prices: { 2020: 500, 2021: 480, 2022: 460, 2023: 440, 2024: 420, 2025: 400 },
      dividends: {},
      color: "#111",
      dataSource: null,
      lastSyncedAt: null,
    },
  ],
  generatedAt: new Date().toISOString(),
};

describe("computeMarketSummaryStats", () => {
  it("calcule des agrégats cohérents à partir d'un jeu de données réduit", () => {
    const stats = computeMarketSummaryStats(dataset);
    expect(stats.companiesCount).toBe(2);
    expect(stats.totalMarketCapBnFcfa).toBe(300);
    expect(stats.firstYear).toBe(2020);
    expect(stats.lastYear).toBe(2025);
    expect(stats.avgDividendYieldPercent).not.toBeNull();
    expect(stats.buySignalsCount).toBeGreaterThanOrEqual(0);
  });

  it("ne casse pas sur un jeu de données vide", () => {
    const stats = computeMarketSummaryStats({ years: [], companies: [], generatedAt: new Date().toISOString() });
    expect(stats.companiesCount).toBe(0);
    expect(stats.avgDividendYieldPercent).toBeNull();
    expect(stats.avgPerf5Percent).toBeNull();
    expect(stats.firstYear).toBeNull();
    expect(stats.lastYear).toBeNull();
  });
});

describe("topScoredCompanies", () => {
  it("trie par score décroissant et respecte la limite", () => {
    const top = topScoredCompanies(dataset, 1);
    expect(top).toHaveLength(1);
  });

  it("ne dépasse jamais le nombre de sociétés disponibles", () => {
    const top = topScoredCompanies(dataset, 50);
    expect(top).toHaveLength(2);
  });
});

describe("allCompaniesWithMetrics", () => {
  it("retourne une entrée par société avec ses métriques calculées", () => {
    const all = allCompaniesWithMetrics(dataset);
    expect(all).toHaveLength(2);
    expect(all.map((c) => c.co.ticker)).toEqual(["AAA", "BBB"]);
    expect(all[0].metrics.score).toBeGreaterThanOrEqual(0);
  });
});
