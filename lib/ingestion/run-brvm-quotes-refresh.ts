// ═══════════════════════════════════════════════════════════════════════════
// Rafraîchissement ciblé des cours BRVM (bouton "Actualiser" + cron horaire)
// ═══════════════════════════════════════════════════════════════════════════
// Variante légère de `runFullIngestion` : cotations BRVM.org (source de
// vérité n°1). Si BRVM ne renvoie aucun cours, repli Sikafinance A–Z
// (1 requête, isolé) pour ne pas laisser le rafraîchissement horaire vide.
// ═══════════════════════════════════════════════════════════════════════════

import { IngestionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { brvmConnector } from "./connectors/brvm_connector";
import { sikafinanceConnector } from "./connectors/sikafinance_connector";
import { getConnectorFeatureFlags } from "./connector-config";
import { persistFinancialRatios, persistPriceQuotes } from "./persist";
import { toPrismaDataSource } from "./prisma-mappers";
import { reconcilePriceBatch } from "./reconciliation";
import type { RawPriceQuote } from "./types";

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
    const errors: string[] = quotesResult.ok ? [] : [quotesResult.error ?? "Échec fetchQuotes BRVM"];
    const priceQuotes: RawPriceQuote[] = quotesResult.ok ? [...quotesResult.data] : [];

    // Repli Sika A–Z (1 requête) si BRVM n'a renvoyé aucun cours — isolation
    // conservée : l'échec Sika n'empêche jamais de persister un résultat BRVM.
    if (priceQuotes.length === 0 && getConnectorFeatureFlags().sikafinanceQuotes) {
      try {
        const sika = await sikafinanceConnector.fetchQuotes(tickers);
        if (sika.ok && sika.data.length > 0) {
          priceQuotes.push(...sika.data);
          errors.push(`repli Sikafinance A–Z : ${sika.data.length} cours (BRVM vide)`);
        } else if (!sika.ok) {
          errors.push(`repli Sikafinance : ${sika.error}`);
        }
      } catch (err) {
        errors.push(`repli Sikafinance : ${err instanceof Error ? err.message : String(err)}`);
      }
    }

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
      priceQuotes.length === 0
        ? IngestionStatus.FAILED
        : errors.length > 0
          ? IngestionStatus.PARTIAL
          : IngestionStatus.SUCCESS;

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
