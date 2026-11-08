import { Prisma } from "@prisma/client";
import type { PriceBar } from "@/lib/analysis/technical-plan";
import { loadTechnicalSetups } from "@/lib/analysis/load-technical-setups";
import { priceDivisor } from "@/lib/corporate-actions/adjust";
import { actionsByTicker } from "@/lib/corporate-actions/load";
import type { AdjustmentAction } from "@/lib/corporate-actions/types";
import { displayPosition, type PositionTrade } from "@/lib/corporate-actions/positions";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { latestEurNgnRate, XOF_PER_EUR } from "@/lib/markets/fx";
import { prisma } from "@/lib/prisma";
import { parsePortfolioType } from "@/lib/portfolio-types";
import { analyzePortfolio, type AnalysisHoldingInput, type MarketContext, type PortfolioAnalysis } from "./analyze";
import { EMPTY_INVESTOR_CRITERIA, type InvestorCriteria } from "./criteria";
import { isMissingInvestorProfileTable } from "./missing-table";
import { emptyMacroReadings, type IndexSeries } from "./market-regime";

const PRICE_ROWS = 40;
const INDEX_CODES = ["BRVM_COMPOSITE", "BRVM_30", "NGX_ASI"] as const;

export interface LoadedAnalyses {
  analyses: PortfolioAnalysis[];
  profile: InvestorCriteria;
  profileTableReady: boolean;
  market: MarketContext;
}

function asNumber(value: unknown): number | null {
  if (value == null) return null;
  const number = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(number) ? number : null;
}

function asDay(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function loadMarketContext(now = new Date()): Promise<MarketContext> {
  const since = new Date(now);
  since.setUTCFullYear(since.getUTCFullYear() - 1);
  const today = now.toISOString().slice(0, 10);

  const [indexRows, breadthRows, fx] = await Promise.all([
    prisma.marketIndexValue.findMany({
      where: {
        isCanonical: true,
        date: { gte: since, lte: now },
        marketIndex: { code: { in: [...INDEX_CODES] } },
      },
      select: {
        date: true,
        value: true,
        marketIndex: { select: { code: true, name: true, exchange: true } },
      },
      orderBy: { date: "asc" },
    }),
    loadBreadth().catch((err: unknown) => {
      if (isDatabaseUnavailable(err)) throw err;
      console.error("[portfolio-analysis] largeur de marché indisponible", err);
      return [] as Array<{ exchange: "BRVM" | "NGX"; change: number | null }>;
    }),
    latestEurNgnRate(prisma).catch((err: unknown) => {
      if (isDatabaseUnavailable(err)) throw err;
      console.error("[portfolio-analysis] taux NGN indisponible", err);
      return null;
    }),
  ]);

  const series: MarketContext["series"] = { BRVM: [], NGX: [] };
  const grouped = new Map<string, IndexSeries & { exchange: "BRVM" | "NGX" }>();
  for (const row of indexRows) {
    const day = asDay(row.date);
    if (day > today) continue;
    const exchange = row.marketIndex.exchange === "NGX" ? "NGX" : "BRVM";
    const key = `${exchange}:${row.marketIndex.code}`;
    const bucket = grouped.get(key) ?? {
      code: row.marketIndex.code,
      name: row.marketIndex.name,
      points: [],
      exchange,
    };
    const value = asNumber(row.value);
    if (value != null && value > 0) bucket.points.push({ date: day, value });
    grouped.set(key, bucket);
  }
  for (const bucket of grouped.values()) {
    series[bucket.exchange].push({ code: bucket.code, name: bucket.name, points: bucket.points });
  }

  const breadth: MarketContext["breadth"] = { BRVM: [], NGX: [] };
  for (const row of breadthRows) breadth[row.exchange].push(row.change);

  const macros = emptyMacroReadings();
  const xof = macros.find((reading) => reading.id === "xof_per_ngn");
  if (xof && fx && fx.ngnPerEur > 0) {
    xof.value = XOF_PER_EUR / fx.ngnPerEur;
    xof.asOf = fx.date;
    xof.source = fx.source;
  }

  return {
    series,
    breadth,
    macros,
    ngnPerEur: fx?.ngnPerEur ?? null,
    fxAsOf: fx?.date ?? null,
    fxSource: fx?.source ?? null,
  };
}

async function loadBreadth(): Promise<Array<{ exchange: "BRVM" | "NGX"; change: number | null }>> {
  const rows = await prisma.$queryRaw<Array<{ exchange: string; change_percent: unknown }>>`
    SELECT c.exchange, ph.change_percent
    FROM companies c
    JOIN LATERAL (
      SELECT change_percent
      FROM price_history
      WHERE company_id = c.id AND is_canonical = true AND date <= CURRENT_DATE
      ORDER BY date DESC
      LIMIT 1
    ) ph ON true
    WHERE c.is_active = true AND c.exchange IN ('BRVM', 'NGX')
  `;
  return rows.map((row) => ({
    exchange: row.exchange === "NGX" ? "NGX" : "BRVM",
    change: asNumber(row.change_percent),
  }));
}

interface PriceRow {
  company_id: string;
  date: Date | string;
  close_price: unknown;
  volume: unknown;
}

async function loadRecentPrices(companyIds: string[]): Promise<Map<string, PriceRow[]>> {
  const map = new Map<string, PriceRow[]>();
  if (companyIds.length === 0) return map;
  const rows = await prisma.$queryRaw<PriceRow[]>`
    SELECT company_id, date, close_price, volume
    FROM (
      SELECT company_id, date, close_price, volume,
             ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY date DESC) AS rn
      FROM price_history
      WHERE is_canonical = true
        AND company_id IN (${Prisma.join(companyIds)})
        AND date <= CURRENT_DATE
    ) t
    WHERE rn <= ${PRICE_ROWS}
    ORDER BY company_id, date ASC
  `;
  for (const row of rows) {
    const list = map.get(row.company_id) ?? [];
    list.push(row);
    map.set(row.company_id, list);
  }
  return map;
}

function barsFor(
  rows: PriceRow[] | undefined,
  actions: AdjustmentAction[]
): { plan: PriceBar[]; liquidity: PriceBar[]; price: number | null } {
  const today = todayIso();
  const plan: PriceBar[] = [];
  const liquidity: PriceBar[] = [];
  let price: number | null = null;
  for (const row of rows ?? []) {
    const date = asDay(row.date);
    if (date > today) continue;
    const raw = asNumber(row.close_price);
    if (raw == null || raw <= 0) continue;
    const divisor = priceDivisor(actions, date);
    const adjusted = divisor > 0 ? raw / divisor : raw;
    const volume = asNumber(row.volume);
    plan.push({ date, close: adjusted, volume });
    liquidity.push({ date, close: raw, volume });
    price = adjusted;
  }
  return { plan, liquidity, price };
}

export async function loadUserAnalyses(userId: string): Promise<LoadedAnalyses> {
  const market = await loadMarketContext();
  const built = await buildAnalyses([userId], market);
  return {
    analyses: built.analyses.get(userId) ?? [],
    profile: built.profiles.get(userId) ?? EMPTY_INVESTOR_CRITERIA,
    profileTableReady: built.profileTableReady,
    market,
  };
}

async function buildAnalyses(userIds: string[], market: MarketContext): Promise<{
  analyses: Map<string, PortfolioAnalysis[]>;
  profiles: Map<string, InvestorCriteria>;
  profileTableReady: boolean;
}> {
  const analyses = new Map<string, PortfolioAnalysis[]>();
  const profiles = new Map<string, InvestorCriteria>();
  if (userIds.length === 0) return { analyses, profiles, profileTableReady: true };

  const portfolios = await prisma.portfolio.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: "asc" },
    include: {
      holdings: {
        include: {
          company: {
            select: {
              id: true,
              ticker: true,
              name: true,
              exchange: true,
              currency: true,
              sector: { select: { name: true } },
              country: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const companyIds = [...new Set(portfolios.flatMap((portfolio) => portfolio.holdings.map((holding) => holding.companyId)))];
  const tickers = [...new Set(portfolios.flatMap((portfolio) => portfolio.holdings.map((holding) => holding.company.ticker)))];

  const [prices, splitActions, setups, trades, users, profileRows] = await Promise.all([
    loadRecentPrices(companyIds),
    actionsByTicker().catch(() => new Map<string, AdjustmentAction[]>()),
    loadTechnicalSetups(tickers),
    portfolios.length === 0
      ? Promise.resolve([])
      : prisma.portfolioTrade.findMany({
          where: { portfolioId: { in: portfolios.map((portfolio) => portfolio.id) } },
          select: {
            portfolioId: true,
            companyId: true,
            side: true,
            quantity: true,
            price: true,
            tradedAt: true,
            notes: true,
          },
        }),
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, preferredPortfolioType: true },
    }),
    readProfiles(userIds),
  ]);

  const ready = profileRows.ready;
  const tradesByHolding = new Map<string, PositionTrade[]>();
  for (const trade of trades) {
    const key = `${trade.portfolioId}:${trade.companyId}`;
    const list = tradesByHolding.get(key) ?? [];
    list.push({
      side: trade.side,
      quantity: Number(trade.quantity),
      price: Number(trade.price),
      tradedAt: asDay(trade.tradedAt),
      notes: trade.notes,
    });
    tradesByHolding.set(key, list);
  }

  const typeByUser = new Map(users.map((user) => [user.id, parsePortfolioType(user.preferredPortfolioType)]));

  for (const userId of userIds) {
    const stored = profileRows.rows.get(userId);
    const profile: InvestorCriteria = {
      age: stored?.age ?? null,
      horizon: stored?.horizon ?? null,
      capacity: stored?.capacity ?? null,
      lossTolerance: stored?.lossTolerance ?? null,
      objective: stored?.objective ?? null,
      portfolioType: typeByUser.get(userId) ?? null,
      investableCapitalFcfa: stored?.investableCapitalFcfa != null ? Number(stored.investableCapitalFcfa) : null,
      riskPerPositionPct: stored?.riskPerPositionPct != null ? Number(stored.riskPerPositionPct) : null,
    };
    profiles.set(userId, profile);

    const list: PortfolioAnalysis[] = [];
    for (const portfolio of portfolios.filter((item) => item.userId === userId)) {
      const holdings: AnalysisHoldingInput[] = portfolio.holdings.map((holding) => {
        const ticker = holding.company.ticker;
        const actions = splitActions.get(ticker) ?? [];
        const series = barsFor(prices.get(holding.companyId), actions);
        const shown = displayPosition(
          {
            quantity: Number(holding.quantity),
            avgBuyPrice: Number(holding.avgBuyPrice),
            createdAt: holding.createdAt.toISOString(),
            targetPrice: holding.targetPrice != null ? Number(holding.targetPrice) : null,
            stopPrice: holding.stopPrice != null ? Number(holding.stopPrice) : null,
          },
          tradesByHolding.get(`${portfolio.id}:${holding.companyId}`) ?? [],
          actions
        );
        const market = holding.company.exchange === "NGX" || holding.company.currency === "NGN" ? "NGX" : "BRVM";
        const currency = holding.company.currency === "NGN" ? "NGN" : "XOF";
        return {
          ticker,
          name: holding.company.name,
          market,
          currency,
          sector: holding.company.sector.name,
          country: holding.company.country.name,
          quantity: shown.quantity,
          price: series.price,
          bars: series.plan,
          liquidityBars: series.liquidity,
          holdingStop: shown.stopPrice,
          holdingTarget: shown.targetPrice,
        };
      });
      list.push(
        analyzePortfolio({
          portfolioId: portfolio.id,
          portfolioName: portfolio.name,
          profile,
          holdings,
          setups,
          market,
        })
      );
    }
    analyses.set(userId, list);
  }

  return { analyses, profiles, profileTableReady: ready };
}

interface ProfileRow {
  userId: string;
  age: number | null;
  horizon: InvestorCriteria["horizon"];
  capacity: InvestorCriteria["capacity"];
  lossTolerance: InvestorCriteria["lossTolerance"];
  objective: InvestorCriteria["objective"];
  investableCapitalFcfa: { toString(): string } | number | null;
  riskPerPositionPct: { toString(): string } | number | null;
}

async function readProfiles(userIds: string[]): Promise<{ ready: boolean; rows: Map<string, ProfileRow> }> {
  try {
    const rows = await prisma.investorProfile.findMany({ where: { userId: { in: userIds } } });
    return { ready: true, rows: new Map(rows.map((row) => [row.userId, row])) };
  } catch (err) {
    if (!isMissingInvestorProfileTable(err)) throw err;
    console.warn("[portfolio-analysis] table investor_profiles absente — prisma migrate deploy requis");
    return { ready: false, rows: new Map() };
  }
}

export async function loadAnalysesForUsers(
  userIds: string[],
  market: MarketContext
): Promise<Map<string, PortfolioAnalysis[]>> {
  const built = await buildAnalyses(userIds, market);
  return built.analyses;
}
