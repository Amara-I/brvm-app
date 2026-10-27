// Upsert idempotent du catalogue, vérification des historiques, rebuild
// de chart_series pour les titres réellement ajustés.
// Les cours bruts ne sont pas modifiés. Les portefeuilles sont restatés
// à la lecture (pas d'écriture des quantités).

import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { refreshChartSeries, type RefreshChartSeriesSummary } from "@/lib/charts/refresh-chart-series";
import { BRVM_SPLIT_CATALOG, catalogFactor } from "./catalog";
import { clearCorporateActionCache } from "./load";
import { classifySplitReflection, type SplitReflection } from "./detect";

export interface CorporateActionApplyOptions {
  tickers?: string[];
  timeBudgetMs?: number;
  /** Vérifie l'historique avant d'activer un fractionnement non forcé. */
  verifyHistory?: boolean;
  logger?: (msg: string) => void;
}

export interface CorporateActionVerification {
  ticker: string;
  effectiveDate: string;
  factor: number;
  reflection: SplitReflection | "forced";
  adjustPrices: boolean;
  pointsBefore: number;
  pointsAfter: number;
}

export interface CorporateActionApplySummary {
  upserted: number;
  verifications: CorporateActionVerification[];
  chartSeries: RefreshChartSeriesSummary | null;
}

function log(opts: CorporateActionApplyOptions, msg: string): void {
  (opts.logger ?? console.log)(msg);
}

export async function applyCorporateActions(
  options: CorporateActionApplyOptions = {},
  db: PrismaClient = prisma
): Promise<CorporateActionApplySummary> {
  const wanted = new Set((options.tickers ?? []).map((ticker) => ticker.toUpperCase()));
  const catalog = BRVM_SPLIT_CATALOG.filter((entry) => wanted.size === 0 || wanted.has(entry.ticker));
  if (catalog.length === 0) {
    return { upserted: 0, verifications: [], chartSeries: null };
  }
  const companies = await db.company.findMany({
    where: {
      OR: catalog.map((entry) => ({
        ticker: entry.ticker,
        exchange: entry.exchange ?? "BRVM",
      })),
    },
    select: { id: true, ticker: true, exchange: true },
  });
  const idByTicker = new Map(companies.map((company) => [`${company.exchange}:${company.ticker}`, company.id]));

  let upserted = 0;
  const verifications: CorporateActionVerification[] = [];

  for (const entry of catalog) {
    const companyId = idByTicker.get(`${entry.exchange ?? "BRVM"}:${entry.ticker}`);
    if (!companyId) {
      log(options, `→ ${entry.ticker} absent du référentiel — ignoré`);
      continue;
    }
    const factor = catalogFactor(entry);
    let reflection: SplitReflection | "forced" = "forced";
    let adjustPrices = entry.forceAdjust || entry.defaultAdjust;
    let pointsBefore = 0;
    let pointsAfter = 0;

    if (!entry.forceAdjust && options.verifyHistory !== false) {
      const from = new Date(`${entry.effectiveDate}T00:00:00.000Z`);
      from.setUTCDate(from.getUTCDate() - 120);
      const to = new Date(`${entry.effectiveDate}T00:00:00.000Z`);
      to.setUTCDate(to.getUTCDate() + 40);
      const rows = await db.priceHistory.findMany({
        where: { companyId, isCanonical: true, date: { gte: from, lte: to } },
        orderBy: { date: "asc" },
        select: { date: true, closePrice: true },
      });
      const points = rows.map((row) => ({
        time: row.date.toISOString().slice(0, 10),
        value: Number(row.closePrice),
      }));
      pointsBefore = points.filter((point) => point.time < entry.effectiveDate).length;
      pointsAfter = points.length - pointsBefore;
      reflection = classifySplitReflection(points, entry.effectiveDate, factor);
      adjustPrices = reflection === "unadjusted";
    }

    await db.corporateAction.upsert({
      where: {
        uniq_corporate_action: {
          companyId,
          effectiveDate: new Date(`${entry.effectiveDate}T00:00:00.000Z`),
          type: entry.kind,
        },
      },
      create: {
        companyId,
        type: entry.kind,
        effectiveDate: new Date(`${entry.effectiveDate}T00:00:00.000Z`),
        newShares: entry.newShares,
        oldShares: entry.oldShares,
        nominalBefore: entry.nominalBefore ?? null,
        nominalAfter: entry.nominalAfter ?? null,
        sourceUrl: entry.sourceUrl ?? null,
        note: entry.note,
        adjustPrices,
      },
      update: {
        newShares: entry.newShares,
        oldShares: entry.oldShares,
        nominalBefore: entry.nominalBefore ?? null,
        nominalAfter: entry.nominalAfter ?? null,
        sourceUrl: entry.sourceUrl ?? null,
        note: entry.note,
        adjustPrices,
      },
    });
    upserted++;
    verifications.push({
      ticker: entry.ticker,
      effectiveDate: entry.effectiveDate,
      factor,
      reflection,
      adjustPrices,
      pointsBefore,
      pointsAfter,
    });
    log(
      options,
      `→ ${entry.ticker} ${entry.effectiveDate} ×${factor} ${reflection} adjust=${adjustPrices}`
    );
  }

  clearCorporateActionCache();
  const symbols = verifications.filter((row) => row.adjustPrices).map((row) => row.ticker);
  let chartSeries: RefreshChartSeriesSummary | null = null;
  if (symbols.length > 0) {
    chartSeries = await refreshChartSeries(
      {
        symbols,
        kinds: ["COMPANY"],
        timeBudgetMs: options.timeBudgetMs,
        logger: (msg) => log(options, msg),
      },
      db
    );
  }

  return { upserted, verifications, chartSeries };
}
