// ═══════════════════════════════════════════════════════════════════════════
// Rafraîchissement ciblé des cours BRVM (bouton "Actualiser" + cron horaire)
// ═══════════════════════════════════════════════════════════════════════════
// Variante légère de `runFullIngestion` : uniquement les cotations BRVM.org
// (source de vérité n°1), sans Sikafinance/Richbourse. Objectif : mettre à
// jour les cours du jour en ~10–20 s sans attendre le cron multi-source.
// ═══════════════════════════════════════════════════════════════════════════

import { IngestionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { brvmConnector } from "./connectors/brvm_connector";
import { persistFinancialRatios, persistPriceQuotes } from "./persist";
import { toPrismaDataSource } from "./prisma-mappers";
import { reconcilePriceBatch } from "./reconciliation";

export interface BrvmQuotesRefreshSummary {
  quotesFetched: number;
  fundamentalsFetched: number;
  reconciledPricesCount: number;
  unknownTickers: string[];
  errors: string[];
  durationMs: number;
  skipped: boolean;
  skipReason?: string;
}

export interface BrvmQuotesRefreshOptions {
  /** Si true (cron horaire), ne tente pas les fiches PER/cap. */
  skipFundamentals?: boolean;
}

export async function runBrvmQuotesRefresh(
  options: BrvmQuotesRefreshOptions = {}
): Promise<BrvmQuotesRefreshSummary> {
  const { skipFundamentals = false } = options;
  const startedAt = Date.now();
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, ticker: true },
  });
  const tickers = companies.map((c) => c.ticker);
  const companyIdByTicker = new Map(companies.map((c) => [c.ticker, c.id]));

  const log = await prisma.ingestionLog.create({
    data: { source: toPrismaDataSource(brvmConnector.source), status: IngestionStatus.RUNNING },
  });

  try {
    const quotesResult = await brvmConnector.fetchQuotes(tickers);
    const errors = quotesResult.ok ? [] : [quotesResult.error ?? "Échec fetchQuotes BRVM"];
    const priceQuotes = quotesResult.ok ? quotesResult.data : [];

    const { reconciled: reconciledPrices } = reconcilePriceBatch(priceQuotes);
    const priceResult = await persistPriceQuotes(prisma, priceQuotes, reconciledPrices, companyIdByTicker);

    // Fondamentaux (PER / cap.) : uniquement hors cron horaire, et seulement
    // les sociétés encore sans capitalisation canonique (Crawl-delay BRVM 10s).
    let fundamentalsFetched = 0;
    let fundTargets = 0;
    if (!skipFundamentals) {
      const missingCap = await prisma.company.findMany({
        where: {
          isActive: true,
          OR: [
            { financialRatios: { none: { isCanonical: true } } },
            { financialRatios: { some: { isCanonical: true, OR: [{ mktCap: null }, { mktCap: 0 }] } } },
          ],
        },
        select: { ticker: true },
        take: 8,
      });
      fundTargets = missingCap.length;
      if (missingCap.length > 0) {
        const fund = await brvmConnector.fetchFundamentals(missingCap.map((c) => c.ticker));
        if (fund.ok) {
          await persistFinancialRatios(prisma, fund.data, companyIdByTicker);
          fundamentalsFetched = fund.data.length;
        } else {
          errors.push(fund.error);
        }
      }
    }

    const status =
      !quotesResult.ok ? IngestionStatus.FAILED : errors.length > 0 ? IngestionStatus.PARTIAL : IngestionStatus.SUCCESS;

    await prisma.ingestionLog.update({
      where: { id: log.id },
      data: {
        status,
        finishedAt: new Date(),
        recordsProcessed: tickers.length + fundTargets,
        recordsInserted: priceQuotes.length + fundamentalsFetched,
        recordsFailed: errors.length,
        errors: errors.length ? errors : undefined,
        durationMs: Date.now() - startedAt,
      },
    });

    // Alertes de seuil : best-effort après mise à jour des cours.
    try {
      const { evaluateActivePriceAlerts } = await import("../alerts/evaluate-price-alerts");
      await evaluateActivePriceAlerts();
    } catch (err) {
      console.error(
        "[quotes-refresh] Évaluation des alertes ignorée :",
        err instanceof Error ? err.message : err
      );
    }

    return {
      quotesFetched: priceQuotes.length,
      fundamentalsFetched,
      reconciledPricesCount: reconciledPrices.length,
      unknownTickers: priceResult.unknownTickers,
      errors,
      durationMs: Date.now() - startedAt,
      skipped: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.ingestionLog
      .update({
        where: { id: log.id },
        data: {
          status: IngestionStatus.FAILED,
          finishedAt: new Date(),
          errors: [message],
          durationMs: Date.now() - startedAt,
        },
      })
      .catch(() => {});
    throw err;
  }
}
