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
// Budget : sur Vercel le run s'arrête vers 240s (kill plateforme à 300s).
// BRVM puis Sikafinance sont persistés avant le scrape Richbourse (1 page
// par ticker). Les étapes suivantes se partagent le reste, sans plancher
// qui les ferait déborder. Chaque étape écrit `[ingest] step=… durationMs=…`.
//
// ⚠️ Non exécuté contre une vraie base à ce stade (pas de `DATABASE_URL`
// réelle disponible dans cet environnement, cf. AGENTS.md) — à valider de
// bout en bout dès qu'une base Postgres réelle est branchée.
// ═══════════════════════════════════════════════════════════════════════════

import { IngestionStatus } from "@prisma/client";
import { tipLatestChartPoints, type RefreshChartSeriesSummary } from "../charts/refresh-chart-series";
import { prisma } from "../prisma";
import { sendIngestionAlert } from "./alerts";
import { getConnectorFeatureFlags, getHistoryBackfillFlags, getIndexEnrichmentFlags } from "./connector-config";
import { brvmConnector } from "./connectors/brvm_connector";
import { richbourseConnector } from "./connectors/richbourse_connector";
import { sikafinanceConnector } from "./connectors/sikafinance_connector";
import { runWithFetchDeadline } from "./fetch-budget";
import {
  persistDiscrepancies,
  persistIndexQuotes,
  persistPriceQuotes,
  promoteIndexDaysWithoutCanonical,
  promotePriceDaysWithoutCanonical,
} from "./persist";
import { toPrismaDataSource } from "./prisma-mappers";
import { DISCREPANCY_THRESHOLD_PERCENT, reconcileIndexQuotes, reconcilePriceBatch } from "./reconciliation";
import type { ReconciledIndex, ReconciledPrice } from "./reconciliation";
import { runDocumentRefresh, type DocumentRefreshSummary } from "./run-document-refresh";
import { runHistoryBackfill, type HistoryBackfillSummary } from "./run-history-backfill";
import { runIndexEnrichmentOnDailyCron, type IndexEnrichmentSummary } from "./run-index-enrichment";
import { deriveSourceRunStatus, type IngestionRunStatus } from "./status";
import {
  INGEST_SAFETY_MS,
  RICHBOURSE_MS_PER_TICKER,
  type IngestStepLog,
  type TimeBudget,
  allocatedOptionalMs,
  createTimeBudget,
  forEachUntilBudget,
  planOptionalIngestSteps,
  preferCompleteTertiary,
  resolveIngestBudgetMs,
  richbourseWantMs,
  sliceTickersForRun,
  utcEpochDay,
  withTimeout,
} from "./time-budget";
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
  indexEnrichment?: IndexEnrichmentSummary | null;
  documentRefresh?: DocumentRefreshSummary | null;
  chartSeries?: RefreshChartSeriesSummary | null;
  budgetMs: number;
  incomplete: boolean;
  stoppedAt: string | null;
  steps: IngestStepLog[];
  richbourseDeferredTickers: string[];
}

export interface RunFullIngestionOptions {
  budgetMs?: number;
  logger?: (msg: string) => void;
}

interface ConnectorEnabled {
  indices: boolean;
  quotes: boolean;
}

const MIN_CONNECTOR_CALL_MS = 8_000;

/** Séances avec une source mais zéro ligne canonique (collier, lot interrompu). */
async function repairCanonicalHoles(logger: (msg: string) => void): Promise<void> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 120);
  try {
    const prices = await promotePriceDaysWithoutCanonical(prisma, since);
    const indices = await promoteIndexDaysWithoutCanonical(prisma, since);
    logger(`[ingest] canoniques réparés prix=${prices} indices=${indices}`);
  } catch (err) {
    logger(`[ingest] réparation canonique ignorée : ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Pointe `chart_series` sur les dernières clôtures déjà en base.
 * Les indices ne sont tipés qu'après l'enrichissement : un tip avant
 * GetHistos avancerait `lastDate` au cours du jour et laisserait le trou.
 */
async function tipIngestCharts(
  logger: (msg: string) => void,
  budget: TimeBudget,
  companies: string[],
  indices: string[],
  capMs: number
): Promise<RefreshChartSeriesSummary | null> {
  const live = Math.min(capMs, budget.remainingMs() - INGEST_SAFETY_MS);
  if (live < 3_000) return null;
  if (companies.length === 0 && indices.length === 0) return null;
  return tipLatestChartPoints({
    companyTickers: companies,
    indexCodes: indices,
    timeBudgetMs: live,
    logger: (msg) => logger(`[ingest→charts] ${msg}`),
  });
}

async function runOneConnectorCalls(
  connector: MarketDataConnector,
  tickers: string[],
  enabled: ConnectorEnabled,
  budget: TimeBudget
): Promise<{ summary: SourceRunSummary; indexQuotes: RawIndexQuote[]; priceQuotes: RawPriceQuote[] }> {
  const startedAt = Date.now();
  const errors: string[] = [];
  let indicesResult: ConnectorResult<RawIndexQuote[]> | null = null;
  let quotesResult: ConnectorResult<RawPriceQuote[]> | null = null;

  if (enabled.indices) {
    if (!budget.canStart(MIN_CONNECTOR_CALL_MS)) {
      const message = "reporté (budget temps épuisé)";
      indicesResult = { ok: false, source: connector.source, error: message, fetchedAt: new Date().toISOString() };
      errors.push(`indices: ${message}`);
    } else {
      try {
        indicesResult = await connector.fetchIndices();
        if (!indicesResult.ok) errors.push(`indices: ${indicesResult.error}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        indicesResult = { ok: false, source: connector.source, error: message, fetchedAt: new Date().toISOString() };
        errors.push(`indices: ${message}`);
      }
    }
  }

  if (enabled.quotes) {
    if (!budget.canStart(MIN_CONNECTOR_CALL_MS)) {
      const message = "reporté (budget temps épuisé)";
      quotesResult = { ok: false, source: connector.source, error: message, fetchedAt: new Date().toISOString() };
      errors.push(`quotes: ${message}`);
    } else {
      try {
        quotesResult = await connector.fetchQuotes(tickers);
        if (!quotesResult.ok) errors.push(`quotes: ${quotesResult.error}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        quotesResult = { ok: false, source: connector.source, error: message, fetchedAt: new Date().toISOString() };
        errors.push(`quotes: ${message}`);
      }
    }
  }

  let status = deriveSourceRunStatus([
    { attempted: enabled.indices, ok: indicesResult?.ok ?? false },
    { attempted: enabled.quotes, ok: quotesResult?.ok ?? false },
  ]);
  // Un arrêt volontaire (budget) n'est pas une source morte : pas d'alerte critique.
  if (status === "FAILED" && errors.length > 0 && errors.every((e) => e.includes("budget temps"))) {
    status = "PARTIAL";
  }

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

interface PersistSnapshot {
  reconciledPrices: ReconciledPrice[];
  reconciledIndices: ReconciledIndex[];
  discrepancies: ReturnType<typeof reconcilePriceBatch>["discrepancies"];
  unknownTickers: string[];
}

function reconcileIndices(allIndexQuotes: RawIndexQuote[]): ReconciledIndex[] {
  const indexCodes = new Set(allIndexQuotes.map((q) => q.code));
  const reconciledIndices: ReconciledIndex[] = [];
  for (const code of indexCodes) {
    const dates = new Set(allIndexQuotes.filter((q) => q.code === code).map((q) => q.date));
    for (const date of dates) {
      const { reconciled } = reconcileIndexQuotes(code, date, allIndexQuotes);
      if (reconciled) reconciledIndices.push(reconciled);
    }
  }
  return reconciledIndices;
}

async function persistCollected(
  allPriceQuotes: RawPriceQuote[],
  allIndexQuotes: RawIndexQuote[],
  companyIdByTicker: Map<string, string>,
  budget: TimeBudget
): Promise<PersistSnapshot> {
  const persistMs = Math.min(60_000, Math.max(5_000, budget.remainingMs() - 5_000));
  return withTimeout(
    (async () => {
      const { reconciled: reconciledPrices, discrepancies } = reconcilePriceBatch(allPriceQuotes);
      const priceResult = await persistPriceQuotes(prisma, allPriceQuotes, reconciledPrices, companyIdByTicker);
      const reconciledIndices = reconcileIndices(allIndexQuotes);
      await persistIndexQuotes(prisma, allIndexQuotes, reconciledIndices);
      return {
        reconciledPrices,
        reconciledIndices,
        discrepancies,
        unknownTickers: priceResult.unknownTickers,
      };
    })(),
    persistMs,
    "persistance cours"
  );
}

export async function runFullIngestion(options: RunFullIngestionOptions = {}): Promise<FullIngestionSummary> {
  const startedAt = new Date();
  const budget = createTimeBudget(resolveIngestBudgetMs(options.budgetMs));
  const logger = options.logger ?? ((msg: string) => console.log(msg));
  const steps: IngestStepLog[] = [];
  let incomplete = false;
  let stoppedAt: string | null = null;

  const note = (row: IngestStepLog) => {
    steps.push(row);
    const reason = row.reason ? ` reason=${row.reason}` : "";
    logger(
      `[ingest] step=${row.name} durationMs=${row.durationMs} remainingMs=${budget.remainingMs()} skipped=${row.skipped}${reason}`
    );
  };

  const skip = (name: string, reason: string, countsAsStop: boolean) => {
    note({ name, durationMs: 0, skipped: true, reason });
    if (countsAsStop) {
      incomplete = true;
      stoppedAt ??= name;
    }
  };

  async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const t0 = Date.now();
    logger(`[ingest] step=${name} start remainingMs=${budget.remainingMs()}`);
    try {
      const value = await fn();
      note({ name, durationMs: Date.now() - t0, skipped: false });
      return value;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      note({ name, durationMs: Date.now() - t0, skipped: false, reason: message });
      throw err;
    }
  }

  logger(`[ingest] start budgetMs=${budget.totalMs} safetyMs=${INGEST_SAFETY_MS}`);

  async function executeIngestion(): Promise<FullIngestionSummary> {
    const flags = getConnectorFeatureFlags();
    const historyFlags = getHistoryBackfillFlags();
    const indexFlags = getIndexEnrichmentFlags();

    const companies = await timed("companies", () =>
      withTimeout(
        prisma.company.findMany({
          where: { isActive: true, exchange: "BRVM" },
          select: { id: true, ticker: true },
        }),
        Math.min(20_000, Math.max(5_000, budget.remainingMs())),
        "lecture sociétés"
      )
    );
    const tickers = companies.map((c) => c.ticker);
    const companyIdByTicker = new Map(companies.map((c) => [c.ticker, c.id]));

    const perSource: SourceRunSummary[] = [];
    const allIndexQuotes: RawIndexQuote[] = [];
    const allPriceQuotes: RawPriceQuote[] = [];

    const runLoggedConnector = async (connector: MarketDataConnector, enabled: ConnectorEnabled, quoteTickers: string[]) => {
      if (!enabled.indices && !enabled.quotes) {
        skip(`source:${connector.source}`, "connecteur désactivé", false);
        return;
      }
      await timed(`source:${connector.source}`, async () => {
        let logId: string | null = null;
        try {
          const log = await prisma.ingestionLog.create({
            data: { source: toPrismaDataSource(connector.source), status: IngestionStatus.RUNNING },
          });
          logId = log.id;
          const { summary, indexQuotes, priceQuotes } = await runOneConnectorCalls(connector, quoteTickers, enabled, budget);
          perSource.push(summary);
          allIndexQuotes.push(...indexQuotes);
          allPriceQuotes.push(...priceQuotes);
          await prisma.ingestionLog.update({
            where: { id: logId },
            data: {
              status: IngestionStatus[summary.status],
              finishedAt: new Date(),
              recordsProcessed: (enabled.indices ? 1 : 0) + (enabled.quotes ? quoteTickers.length : 0),
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
          if (summary.errors.some((e) => e.includes("budget temps"))) {
            incomplete = true;
            stoppedAt ??= `source:${connector.source}`;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          perSource.push({
            source: connector.source,
            status: "FAILED",
            indicesFetched: 0,
            quotesFetched: 0,
            errors: [message],
            durationMs: 0,
          });
          if (logId) {
            await prisma.ingestionLog
              .update({
                where: { id: logId },
                data: { status: IngestionStatus.FAILED, finishedAt: new Date(), errors: [message] },
              })
              .catch(() => undefined);
          }
          await sendIngestionAlert({
            severity: "critical",
            title: `Erreur inattendue — connecteur ${connector.source}`,
            message,
          });
        }
      });
    };

    // Priorité fraîcheur : BRVM (1 page de cours) puis Sika (tableau A–Z).
    // Richbourse indices = 1 page ; ses cotations (1 page / ticker) viennent après la persistance.
    await runLoggedConnector(brvmConnector, { indices: flags.brvmIndices, quotes: flags.brvmQuotes }, tickers);
    await runLoggedConnector(
      sikafinanceConnector,
      { indices: flags.sikafinanceIndices, quotes: flags.sikafinanceQuotes },
      tickers
    );
    if (flags.richbourseIndices) {
      await runLoggedConnector(richbourseConnector, { indices: true, quotes: false }, []);
    }

    let snapshot = await timed("persist", () =>
      persistCollected(allPriceQuotes, allIndexQuotes, companyIdByTicker, budget)
    );
    await repairCanonicalHoles(logger);

    let chartSeries: RefreshChartSeriesSummary | null = null;
    let indexCodesToTip: string[] = [];
    // Réserve ~36s pour l'enrichissement d'indices avant de tiper les sociétés.
    const earlyCap = Math.min(22_000, budget.remainingMs() - INGEST_SAFETY_MS - 36_000);
    if (earlyCap >= 3_000) {
      chartSeries = await tipIngestCharts(
        logger,
        budget,
        [...new Set(snapshot.reconciledPrices.map((row) => row.ticker))],
        [],
        earlyCap
      );
    }

    const quotesOf = (source: DataSourceCode) => perSource.find((s) => s.source === source)?.quotesFetched ?? 0;
    const brvmQuotesOk = !flags.brvmQuotes || quotesOf("BRVM_OFFICIEL") > 0;
    const sikaQuotesOk = !flags.sikafinanceQuotes || quotesOf("SIKAFINANCE") > 0;
    const plan = planOptionalIngestSteps({
      remainingMs: budget.remainingMs(),
      richbourseQuotesEnabled: flags.richbourseQuotes,
      richbourseWantMs: richbourseWantMs({
        tickerCount: tickers.length,
        brvmQuotesOk,
        sikaQuotesOk,
        preferComplete: preferCompleteTertiary(budget.totalMs),
      }),
      historyOnDailyCron: historyFlags.onDailyCron,
      documentsOnDailyCron: historyFlags.documentsOnDailyCron,
      indexOnDailyCron: indexFlags.compositionOnDailyCron || indexFlags.recentHistoryOnDailyCron,
    });
    logger(
      `[ingest] plan remainingMs=${budget.remainingMs()} allocatedMs=${allocatedOptionalMs(plan)} richbourse=${plan.richbourseQuotes.budgetMs} indices=${plan.indexEnrichment.budgetMs} history=${plan.historyBackfill.budgetMs} docs=${plan.documents.budgetMs} charts=${plan.chartSeries.budgetMs} alerts=${plan.alerts.budgetMs}`
    );

    let richbourseDeferredTickers: string[] = [];
    if (!flags.richbourseQuotes) {
      skip("richbourse-quotes", plan.richbourseQuotes.reason ?? "désactivé", false);
    } else if (!plan.richbourseQuotes.run) {
      const cut = (plan.richbourseQuotes.reason ?? "").includes("reste utile");
      skip("richbourse-quotes", plan.richbourseQuotes.reason ?? "budget épuisé", cut);
      if (cut) richbourseDeferredTickers = tickers.map((t) => t.toUpperCase());
    } else {
      const sliceMs = Math.min(plan.richbourseQuotes.budgetMs, Math.max(0, budget.remainingMs() - INGEST_SAFETY_MS));
      const maxCount = Math.max(1, Math.floor(sliceMs / RICHBOURSE_MS_PER_TICKER));
      const slice = sliceTickersForRun(tickers, utcEpochDay(budget.startedAtMs), maxCount);
      richbourseDeferredTickers = slice.deferred;
      logger(
        `[ingest] richbourse-quotes fenêtre=${slice.selected.length} différés=${slice.deferred.length} budgetMs=${sliceMs}`
      );
      const sliceBudget = createTimeBudget(sliceMs);
      let fetchedRich = 0;
      await timed("richbourse-quotes", () =>
        runWithFetchDeadline(sliceBudget.deadlineMs, async () => {
          const log = await prisma.ingestionLog.create({
            data: { source: toPrismaDataSource("RICHBOURSE"), status: IngestionStatus.RUNNING },
          });
          try {
            const loop = await forEachUntilBudget(slice.selected, sliceBudget, 2_500, async (ticker) => {
              const part = await richbourseConnector.fetchQuotes([ticker]);
              if (part.ok) {
                allPriceQuotes.push(...part.data);
                fetchedRich += part.data.length;
              }
            });
            if (loop.stoppedEarly) {
              incomplete = true;
              stoppedAt ??= "richbourse-quotes";
              richbourseDeferredTickers = [...slice.selected.slice(loop.processed), ...slice.deferred];
            }
            const summary: SourceRunSummary = {
              source: "RICHBOURSE",
              status: loop.stoppedEarly ? "PARTIAL" : fetchedRich > 0 || slice.selected.length === 0 ? "SUCCESS" : "PARTIAL",
              indicesFetched: 0,
              quotesFetched: fetchedRich,
              errors: loop.stoppedEarly ? ["quotes: reporté (budget temps épuisé)"] : [],
              durationMs: sliceBudget.elapsedMs(),
            };
            perSource.push(summary);
            await prisma.ingestionLog.update({
              where: { id: log.id },
              data: {
                status: IngestionStatus[summary.status],
                finishedAt: new Date(),
                recordsProcessed: slice.selected.length,
                recordsInserted: fetchedRich,
                recordsFailed: loop.deferred,
                errors: summary.errors.length ? summary.errors : undefined,
                durationMs: summary.durationMs,
              },
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            perSource.push({
              source: "RICHBOURSE",
              status: "FAILED",
              indicesFetched: 0,
              quotesFetched: fetchedRich,
              errors: [message],
              durationMs: sliceBudget.elapsedMs(),
            });
            await prisma.ingestionLog
              .update({
                where: { id: log.id },
                data: { status: IngestionStatus.FAILED, finishedAt: new Date(), errors: [message] },
              })
              .catch(() => undefined);
            if (!message.includes("budget temps")) {
              await sendIngestionAlert({
                severity: "critical",
                title: "Erreur inattendue — connecteur RICHBOURSE",
                message,
              });
            } else {
              incomplete = true;
              stoppedAt ??= "richbourse-quotes";
            }
          }
        })
      );
      if (fetchedRich > 0) {
        try {
          snapshot = await timed("persist-richbourse", () =>
            persistCollected(allPriceQuotes, allIndexQuotes, companyIdByTicker, budget)
          );
        } catch (err) {
          logger(
            `[ingest] persistance Richbourse ignorée (cours BRVM/Sika déjà écrits) : ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    const liveSlice = (wanted: number, minMs: number): number => {
      const live = Math.min(wanted, budget.remainingMs() - INGEST_SAFETY_MS);
      return live >= minMs ? live : 0;
    };

    let indexEnrichment: IndexEnrichmentSummary | null = null;
    if (!plan.indexEnrichment.run) {
      skip("index-enrichment", plan.indexEnrichment.reason ?? "budget épuisé", false);
    } else {
      const ms = liveSlice(plan.indexEnrichment.budgetMs, 8_000);
      if (ms <= 0) skip("index-enrichment", "reste insuffisant au moment de démarrer", false);
      else {
        try {
          indexEnrichment = await timed("index-enrichment", () =>
            runIndexEnrichmentOnDailyCron(ms, (msg) => logger(`[ingest→indices] ${msg}`))
          );
          if (indexEnrichment) {
            indexCodesToTip = [
              ...new Set([
                ...snapshot.reconciledIndices.map((row) => row.code),
                ...indexEnrichment.perCode.filter((row) => row.upserted > 0).map((row) => row.code),
              ]),
            ];
          }
        } catch (err) {
          logger(`[ingest→indices] enrichissement ignoré : ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    let historyBackfill: HistoryBackfillSummary | null = null;
    if (!plan.historyBackfill.run) {
      skip("history-backfill", plan.historyBackfill.reason ?? "budget épuisé", false);
    } else {
      const ms = liveSlice(plan.historyBackfill.budgetMs, 15_000);
      if (ms <= 0) skip("history-backfill", "reste insuffisant au moment de démarrer", false);
      else {
        try {
          historyBackfill = await timed("history-backfill", () =>
            runHistoryBackfill({
              timeBudgetMs: ms,
              resume: true,
              logger: (msg) => logger(`[ingest→history] ${msg}`),
            })
          );
        } catch (err) {
          logger(`[ingest→history] backfill ignoré : ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    let documentRefresh: DocumentRefreshSummary | null = null;
    if (!plan.documents.run) {
      skip("documents", plan.documents.reason ?? "budget épuisé", false);
    } else {
      const ms = liveSlice(plan.documents.budgetMs, 12_000);
      if (ms <= 0) skip("documents", "reste insuffisant au moment de démarrer", false);
      else {
        try {
          documentRefresh = await timed("documents", () =>
            runDocumentRefresh({
              timeBudgetMs: ms,
              resume: true,
              maxTickers: 8,
              logger: (msg) => logger(`[ingest→docs] ${msg}`),
            })
          );
        } catch (err) {
          logger(`[ingest→docs] actualisation ignorée : ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    const followCompanies = plan.chartSeries.run
      ? [...new Set(snapshot.reconciledPrices.map((r) => r.ticker))]
      : [];
    if (followCompanies.length === 0 && indexCodesToTip.length === 0) {
      skip(
        "chart-series",
        chartSeries
          ? "incrémental déjà exécuté après la persistance"
          : (plan.chartSeries.reason ?? "budget épuisé"),
        false
      );
    } else {
      const ms = followCompanies.length > 0 ? liveSlice(plan.chartSeries.budgetMs, 4_000) : Math.min(8_000, Math.max(0, budget.remainingMs() - INGEST_SAFETY_MS));
      if (ms < 3_000) skip("chart-series", "reste insuffisant au moment de démarrer", false);
      else {
        try {
          const followUp = await timed("chart-series", () =>
            tipIngestCharts(logger, budget, followCompanies, indexCodesToTip, ms)
          );
          if (followUp) {
            chartSeries = chartSeries
              ? {
                  ...chartSeries,
                  companiesUpdated: chartSeries.companiesUpdated + followUp.companiesUpdated,
                  indicesUpdated: chartSeries.indicesUpdated + followUp.indicesUpdated,
                  rowsUpserted: chartSeries.rowsUpserted + followUp.rowsUpserted,
                  incomplete: chartSeries.incomplete || followUp.incomplete,
                  nextSymbol: followUp.nextSymbol ?? chartSeries.nextSymbol,
                  durationMs: chartSeries.durationMs + followUp.durationMs,
                  skippedMissingTable: chartSeries.skippedMissingTable || followUp.skippedMissingTable,
                  finishedAt: followUp.finishedAt,
                }
              : followUp;
          }
        } catch (err) {
          logger(`[ingest→charts] refresh ignoré : ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    if (!plan.alerts.run) {
      skip("alerts", plan.alerts.reason ?? "budget épuisé", false);
    } else {
      const ms = liveSlice(plan.alerts.budgetMs, 4_000);
      if (ms <= 0) skip("alerts", "reste insuffisant au moment de démarrer", false);
      else {
        try {
          await timed("alerts", async () => {
            const { evaluateAllAlerts } = await import("../notifications/evaluate-all");
            await withTimeout(evaluateAllAlerts(), ms, "alertes");
          });
        } catch (err) {
          logger(`[ingest→alerts] évaluation ignorée : ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    if (snapshot.discrepancies.length > 0) {
      try {
        await withTimeout(
          persistDiscrepancies(prisma, snapshot.discrepancies, companyIdByTicker, snapshot.reconciledPrices),
          Math.min(15_000, Math.max(1_000, budget.remainingMs())),
          "écarts"
        );
        await sendIngestionAlert({
          severity: "warning",
          title: `${snapshot.discrepancies.length} écart(s) de cours > ${DISCREPANCY_THRESHOLD_PERCENT}% détecté(s)`,
          message: snapshot.discrepancies
            .slice(0, 12)
            .map((d) => `${d.ticker} (${d.date}): écart ${d.deltaPercent}%`)
            .join(" | "),
        });
      } catch (err) {
        logger(`[ingest] écarts non journalisés : ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (snapshot.unknownTickers.length > 0) {
      await sendIngestionAlert({
        severity: "info",
        title: `${snapshot.unknownTickers.length} ticker(s) inconnu(s) rencontré(s) pendant l'ingestion`,
        message: `${snapshot.unknownTickers.join(", ")} — absent(s) de la table companies (nouvelle introduction ? faute de frappe côté source ?)`,
      });
    }

    const summary: FullIngestionSummary = {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      perSource,
      reconciledPricesCount: snapshot.reconciledPrices.length,
      reconciledIndicesCount: snapshot.reconciledIndices.length,
      discrepanciesCount: snapshot.discrepancies.length,
      unknownTickers: snapshot.unknownTickers,
      historyBackfill,
      indexEnrichment,
      documentRefresh,
      chartSeries,
      budgetMs: budget.totalMs,
      incomplete,
      stoppedAt,
      steps,
      richbourseDeferredTickers,
    };
    logger(
      `[ingest] done durationMs=${summary.durationMs} incomplete=${summary.incomplete} stoppedAt=${summary.stoppedAt ?? "-"} prices=${summary.reconciledPricesCount} deferredRichbourse=${richbourseDeferredTickers.length} steps=${steps.map((s) => `${s.name}:${s.skipped ? "skip" : s.durationMs}`).join(",")}`
    );
    return summary;
  }

  return runWithFetchDeadline(budget.deadlineMs, () => executeIngestion());
}
