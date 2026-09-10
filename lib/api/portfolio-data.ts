// Portefeuilles utilisateur + métriques — factorisé étape 10
// Enrichi : horizon d'achat, conseils calcMetrics, série NAV quotidienne.

import { prisma } from "@/lib/prisma";
import { getLatestCanonicalPrices, getYearStartCanonicalPrices } from "@/lib/api/latest-data";
import { computePortfolioMetrics, type HoldingMetrics } from "@/lib/calc/portfolio-metrics";
import { allCompaniesWithMetrics } from "@/lib/calc/market-summary-stats";
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { getMarketSparkSeriesByTicker } from "@/lib/api/market-spark-series";
import {
  adviseHolding,
  adviceRecap,
  type BuyHorizonCode,
  type PortfolioAdvice,
} from "@/lib/calc/portfolio-advice";
import { getPortfolioNavSeries, type PortfolioNavPoint } from "@/lib/api/portfolio-nav-series";

export type EnrichedHoldingMetrics = HoldingMetrics & {
  buyDate: string | null;
  createdAt: string;
  buyHorizon: BuyHorizonCode;
  /** Score composite calcMetrics (0–100), ou null si N/D. */
  analysisScore: number | null;
  advice: PortfolioAdvice;
};

export async function getUserPortfoliosWithMetrics(userId: string) {
  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    include: { holdings: { include: { company: { include: { sector: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  const allCompanyIds = [...new Set(portfolios.flatMap((p) => p.holdings.map((h) => h.companyId)))];
  const currentYear = new Date().getUTCFullYear();

  const [prices, yearStartPrices, fullDataset, sparkSeries] = await Promise.all([
    getLatestCanonicalPrices(allCompanyIds),
    getYearStartCanonicalPrices(allCompanyIds, currentYear),
    getCompaniesFullDataset(),
    getMarketSparkSeriesByTicker().catch(() => ({})),
  ]);

  // Même formule que /marche, screener et fiches : cours alignés + série journalière.
  const metricsByTicker = new Map(
    allCompaniesWithMetrics(fullDataset, sparkSeries).map(({ co, metrics }) => [
      co.ticker,
      metrics,
    ] as const)
  );

  return Promise.all(
    portfolios.map(async (p) => {
      const metrics = computePortfolioMetrics(
        p.holdings.map((h) => {
          const price = prices.get(h.companyId);
          const yearStartPrice = yearStartPrices.get(h.companyId);
          return {
            id: h.id,
            ticker: h.company.ticker,
            name: h.company.name,
            sector: h.company.sector.name,
            quantity: Number(h.quantity),
            avgBuyPrice: Number(h.avgBuyPrice),
            currentPrice: price ? Number(price.closePrice) : null,
            currentPriceDate: price ? price.date.toISOString().slice(0, 10) : null,
            yearStartPrice: yearStartPrice ? Number(yearStartPrice.closePrice) : null,
          };
        })
      );

      const holdingsMeta = new Map(
        p.holdings.map((h) => [
          h.id,
          {
            buyDate: h.buyDate?.toISOString().slice(0, 10) ?? null,
            createdAt: h.createdAt.toISOString(),
            buyHorizon: (h.buyHorizon ?? "MOYEN") as BuyHorizonCode,
            companyId: h.companyId,
            ticker: h.company.ticker,
            quantity: Number(h.quantity),
          },
        ])
      );

      const enrichedHoldings: EnrichedHoldingMetrics[] = metrics.holdings.map((hm) => {
        const meta = hm.id ? holdingsMeta.get(hm.id) : undefined;
        const buyHorizon: BuyHorizonCode = meta?.buyHorizon ?? "MOYEN";
        const analysis = meta ? metricsByTicker.get(meta.ticker) : undefined;
        const advice = adviseHolding({
          buyHorizon,
          signal: analysis?.signal ?? null,
          horizonScores: analysis?.horizonScores ?? null,
          signalSummary: analysis?.signalSummary ?? null,
          signalReasons: analysis?.signalReasons ?? null,
        });
        return {
          ...hm,
          buyDate: meta?.buyDate ?? null,
          createdAt: meta?.createdAt ?? new Date().toISOString(),
          buyHorizon,
          analysisScore: analysis?.score ?? null,
          advice,
        };
      });

      const navSeries: PortfolioNavPoint[] = await getPortfolioNavSeries(
        p.holdings.map((h) => ({
          companyId: h.companyId,
          quantity: Number(h.quantity),
          sinceDate:
            h.buyDate?.toISOString().slice(0, 10) ?? h.createdAt.toISOString().slice(0, 10),
        }))
      );

      const recap = adviceRecap(enrichedHoldings.map((h) => h.advice));

      return {
        id: p.id,
        name: p.name,
        createdAt: p.createdAt.toISOString(),
        holdings: p.holdings.map((h) => ({
          id: h.id,
          ticker: h.company.ticker,
          companyName: h.company.name,
          sector: h.company.sector.name,
          quantity: Number(h.quantity),
          avgBuyPrice: Number(h.avgBuyPrice),
          buyDate: h.buyDate?.toISOString().slice(0, 10) ?? null,
          buyHorizon: (h.buyHorizon ?? "MOYEN") as BuyHorizonCode,
          notes: h.notes,
        })),
        metrics: {
          ...metrics,
          holdings: enrichedHoldings,
        },
        navSeries,
        adviceRecap: recap,
      };
    })
  );
}

export type UserPortfoliosWithMetrics = Awaited<ReturnType<typeof getUserPortfoliosWithMetrics>>;
