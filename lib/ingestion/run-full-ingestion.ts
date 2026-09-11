// ═══════════════════════════════════════════════════════════════════════════
// Orchestrateur d'ingestion complète — étape 6 du plan de migration
// ═══════════════════════════════════════════════════════════════════════════
// Industrialise le prototype de l'étape 3 (scripts/ingest-prototype.ts) :
//
//   1. Récupère TOUTES les sociétés actives en base (plus seulement les 2-3
//      tickers test du prototype).
//   2. Interroge les 3 connecteurs (indices + cotations). Chacun est isolé
//      dans son propre try/catch à DEUX niveaux : l'échec d'un appel
//      (fetchIndices/fetchQuotes) n'empêche pas l'autre appel de la MÊME
//      source, et l'échec total d'UNE source n'empêche jamais les DEUX
//      autres de tourner (cf. brief : "chacun isolé pour pouvoir être
//      maintenu/désactivé indépendamment"). Chaque source est journalisée
//      dans `ingestion_logs` (RUNNING → SUCCESS/PARTIAL/FAILED).
//   3. Réconcilie (priorité BRVM_OFFICIEL > SIKAFINANCE > RICHBOURSE, cf.
//      reconciliation.ts), journalise les écarts > 2% dans
//      `data_discrepancies`, et persiste les valeurs canoniques dans
//      `price_history` / `market_index_values` (cf. persist.ts).
//   4. Envoie une alerte (cf. alerts.ts) si une source échoue complètement,
//      ou si des écarts significatifs ont été détectés — jamais bloquant.
//
// Appelé par `app/api/cron/ingest/route.ts` (Vercel Cron, production) et par
// `scripts/run-ingestion-cli.ts` (exécution/débogage manuel).
//
// ⚠️ Non exécuté contre une vraie base à ce stade (pas de `DATABASE_URL`
// réelle disponible dans cet environnement, cf. AGENTS.md) — à valider de
// bout en bout dès qu'une base Postgres réelle est branchée.
// ═══════════════════════════════════════════════════════════════════════════

import { IngestionStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { brvmConnector } from "./connectors/brvm_connector";
import { sikafinanceConnector } from "./connectors/sikafinance_connector";
import { richbourseConnector } from "./connectors/richbourse_connector";
import { getConnectorFeatureFlags, getHistoryBackfillFlags } from "./connector-config";
import { deriveSourceRunStatus, type IngestionRunStatus } from "./status";
import { DISCREPANCY_THRESHOLD_PERCENT, reconcileIndexQuotes, reconcilePriceBatch } from "./reconciliation";
import type { ReconciledIndex } from "./reconciliation";
import { persistDiscrepancies, persistIndexQuotes, persistPriceQuotes } from "./persist";
import { toPrismaDataSource } from "./prisma-mappers";
import { sendIngestionAlert } from "./alerts";
import { runHistoryBackfill, type HistoryBackfillSummary } from "./run-history-backfill";
import type { ConnectorResult, DataSourceCode, MarketDataConnector, RawIndexQuote, RawPriceQuote } from "./types";

export interface SourceRunSummary {
  source: DataSourceCode;
  status: IngestionRunStatus;
  indicesFetched: number;
  quotesFetched: number;
  errors: string[];
  durationMs: number;
}

export interface FullIngestionSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  perSource: SourceRunSummary[];
  reconciledPricesCount: number;
  reconciledIndicesCount: number;
  discrepanciesCount: number;
  unknownTickers: string[];
  historyBackfill?: HistoryBackfillSummary | null;
}

interface ConnectorEnabled {
  indices: boolean;
  quotes: boolean;
}

async function runOneConnectorCalls(
  connector: MarketDataConnector,
  tickers: string[],
  enabled: ConnectorEnabled
): Promise<{ summary: SourceRunSummary; indexQuotes: RawIndexQuote[]; priceQuotes: RawPriceQuote[] }> {
  const startedAt = Date.now();
  const errors: string[] = [];
  let indicesResult: ConnectorResult<RawIndexQuote[]> | null = null;
  let quotesResult: ConnectorResult<RawPriceQuote[]> | null = null;

  if (enabled.indices) {
    try {
      indicesResult = await connector.fetchIndices();
      if (!indicesResult.ok) errors.push(`indices: ${indicesResult.error}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      indicesResult = { ok: false, source: connector.source, error: message, fetchedAt: new Date().toISOString() };
      errors.push(`indices: ${message}`);
    }
  }

  if (enabled.quotes) {
    try {
      quotesResult = await connector.fetchQuotes(tickers);
      if (!quotesResult.ok) errors.push(`quotes: ${quotesResult.error}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      quotesResult = { ok: false, source: connector.source, error: message, fetchedAt: new Date().toISOString() };
      errors.push(`quotes: ${message}`);
    }
  }

  const status = deriveSourceRunStatus([
    { attempted: enabled.indices, ok: indicesResult?.ok ?? false },
    { attempted: enabled.quotes, ok: quotesResult?.ok ?? false },
  ]);

  return {
    summary: {
      source: connector.source,
      status,
      indicesFetched: indicesResult?.ok ? indicesResult.data.length : 0,
      quotesFetched: quotesResult?.ok ? quotesResult.data.length : 0,
      errors,
      durationMs: Date.now() - startedAt,
    },
    indexQuotes: indicesResult?.ok ? indicesResult.data : [],
    priceQuotes: quotesResult?.ok ? quotesResult.data : [],
  };
}

export async function runFullIngestion(): Promise<FullIngestionSummary> {
  const startedAt = new Date();
  const flags = getConnectorFeatureFlags();

  const companies = await prisma.company.findMany({ where: { isActive: true }, select: { id: true, ticker: true } });
  const tickers = companies.map((c) => c.ticker);
  const companyIdByTicker = new Map(companies.map((c) => [c.ticker, c.id]));

  const connectorPlan: Array<{ connector: MarketDataConnector; enabled: ConnectorEnabled }> = [
    { connector: brvmConnector, enabled: { indices: flags.brvmIndices, quotes: flags.brvmQuotes } },
    { connector: sikafinanceConnector, enabled: { indices: flags.sikafinanceIndices, quotes: flags.sikafinanceQuotes } },
    { connector: richbourseConnector, enabled: { indices: flags.richbourseIndices, quotes: flags.richbourseQuotes } },
  ];

  const perSource: SourceRunSummary[] = [];
  const allIndexQuotes: RawIndexQuote[] = [];
  const allPriceQuotes: RawPriceQuote[] = [];

  for (const { connector, enabled } of connectorPlan) {
    const log = await prisma.ingestionLog.create({
      data: { source: toPrismaDataSource(connector.source), status: IngestionStatus.RUNNING },
    });

    try {
      const { summary, indexQuotes, priceQuotes } = await runOneConnectorCalls(connector, tickers, enabled);
      perSource.push(summary);
      allIndexQuotes.push(...indexQuotes);
      allPriceQuotes.push(...priceQuotes);

      await prisma.ingestionLog.update({
        where: { id: log.id },
        data: {
          status: IngestionStatus[summary.status],
          finishedAt: new Date(),
          recordsProcessed: (enabled.indices ? 1 : 0) + (enabled.quotes ? tickers.length : 0),
          recordsInserted: summary.indicesFetched + summary.quotesFetched,
          recordsFailed: summary.errors.length,
          errors: summary.errors.length ? summary.errors : undefined,
          durationMs: summary.durationMs,
        },
      });

      if (summary.status === "FAILED") {
        await sendIngestionAlert({
          severity: "critical",
          title: `Source d'ingestion en échec : ${connector.source}`,
          message: summary.errors.join(" | ") || "Échec sans détail disponible",
        });
      }
    } catch (err) {
      // Filet de sécurité ultime : même un bug inattendu ici (ex: Prisma
      // injoignable en cours de route) ne doit JAMAIS empêcher les deux
      // autres sources de tourner — c'est tout le sens de la boucle
      // try/catch PAR connecteur plutôt qu'un try/catch global.
      const message = err instanceof Error ? err.message : String(err);
      perSource.push({ source: connector.source, status: "FAILED", indicesFetched: 0, quotesFetched: 0, errors: [message], durationMs: 0 });
      await prisma.ingestionLog
        .update({ where: { id: log.id }, data: { status: IngestionStatus.FAILED, finishedAt: new Date(), errors: [message] } })
        .catch(() => {
          // Même la mise à jour du log peut échouer (DB down) — on ne fait
          // pas planter le run pour autant.
        });
      await sendIngestionAlert({ severity: "critical", title: `Erreur inattendue — connecteur ${connector.source}`, message });
    }
  }

  // ── Réconciliation + persistance des cotations ──────────────────────────
  const { reconciled: reconciledPrices, discrepancies } = reconcilePriceBatch(allPriceQuotes);
  const priceResult = await persistPriceQuotes(prisma, allPriceQuotes, reconciledPrices, companyIdByTicker);
  await persistDiscrepancies(prisma, discrepancies, companyIdByTicker, reconciledPrices);

  // ── Réconciliation + persistance des indices ────────────────────────────
  const indexCodes = new Set(allIndexQuotes.map((q) => q.code));
  const reconciledIndices: ReconciledIndex[] = [];
  for (const code of indexCodes) {
    const dates = new Set(allIndexQuotes.filter((q) => q.code === code).map((q) => q.date));
    for (const date of dates) {
      const { reconciled } = reconcileIndexQuotes(code, date, allIndexQuotes);
      if (reconciled) reconciledIndices.push(reconciled);
    }
  }
  await persistIndexQuotes(prisma, allIndexQuotes, reconciledIndices);

  if (discrepancies.length > 0) {
    await sendIngestionAlert({
      severity: "warning",
      title: `${discrepancies.length} écart(s) de cours > ${DISCREPANCY_THRESHOLD_PERCENT}% détecté(s)`,
      message: discrepancies.map((d) => `${d.ticker} (${d.date}): écart ${d.deltaPercent}%`).join(" | "),
    });
  }

  if (priceResult.unknownTickers.length > 0) {
    await sendIngestionAlert({
      severity: "info",
      title: `${priceResult.unknownTickers.length} ticker(s) inconnu(s) rencontré(s) pendant l'ingestion`,
      message: `${priceResult.unknownTickers.join(", ")} — absent(s) de la table companies (nouvelle introduction ? faute de frappe côté source ?)`,
    });
  }

  const finishedAt = new Date();

  let historyBackfill: HistoryBackfillSummary | null = null;
  if (getHistoryBackfillFlags().onDailyCron) {
    const elapsed = finishedAt.getTime() - startedAt.getTime();
    const remaining = Math.max(15_000, 270_000 - elapsed);
    try {
      historyBackfill = await runHistoryBackfill({
        timeBudgetMs: remaining,
        resume: true,
        logger: (msg) => console.log(`[ingest→history] ${msg}`),
      });
    } catch (err) {
      console.warn(
        `[ingest→history] backfill ignoré : ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    perSource,
    reconciledPricesCount: reconciledPrices.length,
    reconciledIndicesCount: reconciledIndices.length,
    discrepanciesCount: discrepancies.length,
    unknownTickers: priceResult.unknownTickers,
    historyBackfill,
  };
}
