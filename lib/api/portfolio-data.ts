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
import {
  combinePortfolioHeadline,
  valueOtherHolding,
  type OtherHoldingInput,
  type OtherHoldingMetrics,
  type PortfolioHeadline,
} from "@/lib/calc/other-holding-metrics";
import { isMissingOtherHoldingsTable } from "@/lib/portfolio/other-holdings-errors";
import { priceDivisor } from "@/lib/corporate-actions/adjust";
import { actionsByTicker } from "@/lib/corporate-actions/load";
import { displayPosition, type PositionTrade } from "@/lib/corporate-actions/positions";
import type { AdjustmentAction } from "@/lib/corporate-actions/types";

export type EnrichedHoldingMetrics = HoldingMetrics & {
  buyDate: string | null;
  createdAt: string;
  buyHorizon: BuyHorizonCode;
  /** Score composite calcMetrics (0–100), ou null si N/D. */
  analysisScore: number | null;
  advice: PortfolioAdvice;
  targetPrice: number | null;
  stopPrice: number | null;
};

export async function getUserPortfoliosWithMetrics(userId: string) {
  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    include: { holdings: { include: { company: { include: { sector: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  const otherByPortfolio = new Map<string, OtherHoldingInput[]>();
  if (portfolios.length > 0) {
    try {
      const rows = await prisma.portfolioOtherHolding.findMany({
        where: { portfolioId: { in: portfolios.map((p) => p.id) } },
        orderBy: [{ kind: "asc" }, { name: "asc" }],
      });
      for (const row of rows) {
        const list = otherByPortfolio.get(row.portfolioId) ?? [];
        list.push(otherHoldingFromRow(row));
        otherByPortfolio.set(row.portfolioId, list);
      }
    } catch (err) {
      if (!isMissingOtherHoldingsTable(err)) throw err;
      console.warn("[portfolio] table portfolio_other_holdings absente — prisma migrate deploy requis");
    }
  }

  const allCompanyIds = [...new Set(portfolios.flatMap((p) => p.holdings.map((h) => h.companyId)))];
  const currentYear = new Date().getUTCFullYear();

  const [prices, yearStartPrices, fullDataset, sparkSeries, splitActions, tradeRows] = await Promise.all([
    getLatestCanonicalPrices(allCompanyIds),
    getYearStartCanonicalPrices(allCompanyIds, currentYear),
    getCompaniesFullDataset(),
    getMarketSparkSeriesByTicker().catch(() => ({})),
    actionsByTicker().catch(() => new Map<string, AdjustmentAction[]>()),
    portfolios.length > 0
      ? prisma.portfolioTrade.findMany({
          where: { portfolioId: { in: portfolios.map((p) => p.id) } },
          select: {
            portfolioId: true,
            companyId: true,
            side: true,
            quantity: true,
            price: true,
            tradedAt: true,
            notes: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const tradesByHolding = new Map<string, PositionTrade[]>();
  for (const trade of tradeRows) {
    const key = `${trade.portfolioId}:${trade.companyId}`;
    const list = tradesByHolding.get(key) ?? [];
    list.push({
      side: trade.side,
      quantity: Number(trade.quantity),
      price: Number(trade.price),
      tradedAt: trade.tradedAt.toISOString().slice(0, 10),
      notes: trade.notes,
    });
    tradesByHolding.set(key, list);
  }

  const adjustedClose = (ticker: string, date: Date, close: unknown): number => {
    const raw = Number(close);
    return raw / priceDivisor(splitActions.get(ticker) ?? [], date.toISOString().slice(0, 10));
  };

  // Même formule que /marche, screener et fiches : cours alignés + série journalière.
  const metricsByTicker = new Map(
    allCompaniesWithMetrics(fullDataset, sparkSeries).map(({ co, metrics }) => [
      co.ticker,
      metrics,
    ] as const)
  );

  return Promise.all(
    portfolios.map(async (p) => {
      const displayedById = new Map(
        p.holdings.map((h) => {
          const shown = displayPosition(
            {
              quantity: Number(h.quantity),
              avgBuyPrice: Number(h.avgBuyPrice),
              createdAt: h.createdAt.toISOString(),
              targetPrice: h.targetPrice != null ? Number(h.targetPrice) : null,
              stopPrice: h.stopPrice != null ? Number(h.stopPrice) : null,
            },
            tradesByHolding.get(`${p.id}:${h.companyId}`) ?? [],
            splitActions.get(h.company.ticker) ?? []
          );
          return [h.id, shown] as const;
        })
      );

      const metrics = computePortfolioMetrics(
        p.holdings.map((h) => {
          const price = prices.get(h.companyId);
          const yearStartPrice = yearStartPrices.get(h.companyId);
          const shown = displayedById.get(h.id)!;
          return {
            id: h.id,
            ticker: h.company.ticker,
            name: h.company.name,
            sector: h.company.sector.name,
            quantity: shown.quantity,
            avgBuyPrice: shown.avgBuyPrice,
            currentPrice: price ? adjustedClose(h.company.ticker, price.date, price.closePrice) : null,
            currentPriceDate: price ? price.date.toISOString().slice(0, 10) : null,
            yearStartPrice: yearStartPrice
              ? adjustedClose(h.company.ticker, yearStartPrice.date, yearStartPrice.closePrice)
              : null,
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
            targetPrice: h.targetPrice != null ? Number(h.targetPrice) : null,
            stopPrice: h.stopPrice != null ? Number(h.stopPrice) : null,
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
          targetPrice: (hm.id ? displayedById.get(hm.id)?.targetPrice : null) ?? null,
          stopPrice: (hm.id ? displayedById.get(hm.id)?.stopPrice : null) ?? null,
        };
      });

      const navSeries: PortfolioNavPoint[] = await getPortfolioNavSeries(
        p.holdings.map((h) => ({
          companyId: h.companyId,
          ticker: h.company.ticker,
          quantity: displayedById.get(h.id)?.quantity ?? Number(h.quantity),
          sinceDate:
            h.buyDate?.toISOString().slice(0, 10) ?? h.createdAt.toISOString().slice(0, 10),
        }))
      );

      const recap = adviceRecap(enrichedHoldings.map((h) => h.advice));
      const otherHoldings: OtherHoldingMetrics[] = (otherByPortfolio.get(p.id) ?? []).map((row) => valueOtherHolding(row));
      const combined: PortfolioHeadline = combinePortfolioHeadline(
        {
          totalMarketValue: metrics.totalMarketValue,
          totalCostBasis: metrics.totalCostBasis,
          totalGainLoss: metrics.totalGainLoss,
        },
        otherHoldings
      );

      return {
        id: p.id,
        name: p.name,
        createdAt: p.createdAt.toISOString(),
        holdings: p.holdings.map((h) => {
          const shown = displayedById.get(h.id);
          return {
            id: h.id,
            ticker: h.company.ticker,
            companyName: h.company.name,
            sector: h.company.sector.name,
            quantity: shown?.quantity ?? Number(h.quantity),
            avgBuyPrice: shown?.avgBuyPrice ?? Number(h.avgBuyPrice),
            buyDate: h.buyDate?.toISOString().slice(0, 10) ?? null,
            buyHorizon: (h.buyHorizon ?? "MOYEN") as BuyHorizonCode,
            notes: h.notes,
          };
        }),
        metrics: {
          ...metrics,
          holdings: enrichedHoldings,
        },
        navSeries,
        adviceRecap: recap,
        otherHoldings,
        combined,
      };
    })
  );
}

function ymd(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function otherHoldingFromRow(row: {
  id: string;
  kind: "OBLIGATION" | "FCP";
  name: string;
  isin: string | null;
  code: string | null;
  manager: string | null;
  quantity: unknown;
  avgBuyPrice: unknown;
  priceMode: "FCFA" | "PERCENT";
  nominal: unknown;
  couponRate: unknown;
  maturityDate: Date | null;
  buyDate: Date | null;
  latestValue: unknown;
  latestValueDate: Date | null;
}): OtherHoldingInput {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    isin: row.isin,
    code: row.code,
    manager: row.manager,
    quantity: Number(row.quantity),
    avgBuyPrice: Number(row.avgBuyPrice),
    priceMode: row.priceMode,
    nominal: row.nominal != null ? Number(row.nominal) : null,
    couponRate: row.couponRate != null ? Number(row.couponRate) : null,
    maturityDate: ymd(row.maturityDate),
    buyDate: ymd(row.buyDate),
    latestValue: row.latestValue != null ? Number(row.latestValue) : null,
    latestValueDate: ymd(row.latestValueDate),
  };
}

export type UserPortfoliosWithMetrics = Awaited<ReturnType<typeof getUserPortfoliosWithMetrics>>;
