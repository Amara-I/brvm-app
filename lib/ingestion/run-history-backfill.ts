// ═══════════════════════════════════════════════════════════════════════════
// Orchestrateur de backfill historique — densifie cours + fiches Sika
// ═══════════════════════════════════════════════════════════════════════════
// Stratégie (aucun cours inventé) :
//   1. Annuel GetHistos xperiod=365 depuis 1998 (la série réelle commence
//      plus tard selon le titre — ex. SNTS 2006).
//   2. Mensuel xperiod=30 depuis la première année réellement retournée.
//   3. Journalier chunké ~89 j uniquement sur les fenêtres encore lacunaires
//      (skip si déjà ≥ 35 clôtures BRVM/Sika dans la fenêtre).
//      forceDaily=1 ignore INGESTION_ENABLE_SIKA_DAILY_HISTORY=false.
//      Fenêtres persistées une par une + plafond Hobby (défaut 8 / ticker).
//      Reprise sur le MÊME ticker tant qu'il reste des gaps.
//   4. Fiche SOCIETE (ISIN, CA/RN en Mds, PER, dividendes), events/news,
//      documents BRVM via catalogue OuestBourse si la clé est configurée.
//
// Persistance incrémentale par ticker (un crash ne perd pas les précédents).
// Reprise via ingestion_logs (kind HISTORY_BACKFILL) + budget temps pour
// rester cron-safe (Hobby 300 s). Feature flags : getHistoryBackfillFlags().
//
// CLI : scripts/run-history-backfill.ts
// Cron manuel : GET /api/cron/history-backfill (pas dans vercel.json — quota
// Hobby = 2 crons déjà pris par ingest + research).

import { DataSource, IngestionStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { sikafinanceConnector } from "./connectors/sikafinance_connector";
import {
  fetchOuestbourseDocuments,
  isOuestbourseSupabaseConfigured,
  obDocumentsToRaw,
} from "./connectors/ouestbourse_supabase";
import { getHistoryBackfillFlags } from "./connector-config";
import { toIsoDate } from "./parse-utils";
import {
  persistCompanyDocuments,
  persistCompanyEvents,
  persistCompanyNews,
  persistCompanyProfiles,
  persistDividendRows,
  persistFinancialRatios,
  persistPriceQuotes,
} from "./persist";
import { reconcilePriceBatch } from "./reconciliation";
import type { DataSourceCode, RawPriceQuote } from "./types";
import {
  DEFAULT_ANNUAL_FROM_YEAR,
  DEFAULT_MIN_DAILY_POINTS_PER_CHUNK,
  earliestIsoFromQuotes,
  maxDailyChunksThisRun,
  mergeExistingPrices,
  minIsoDate,
  planDailyBackfill,
  quotesEligibleForCanonical,
  quotesNeedingUpsert,
  type ExistingPriceRef,
} from "./history-coverage";

const LOG_KIND = "HISTORY_BACKFILL";

export interface HistoryBackfillOptions {
  tickers?: string[];
  annualFromYear?: number;
  /** "auto" = première date annuelle/mensuelle réellement retournée par Sika. */
  dailyFrom?: string | "auto" | "off";
  includeAnnual?: boolean;
  includeMonthly?: boolean;
  includeDaily?: boolean;
  /** Ignore `INGESTION_ENABLE_SIKA_DAILY_HISTORY=false` et planifie les gaps. */
  forceDaily?: boolean;
  /** Seuil chunksNeedingFetch (défaut 35). 1 = fenêtres vides seulement. */
  minDailyPoints?: number;
  /** Plafond de fenêtres GetHistos journalières par ticker pour ce run. */
  maxDailyChunks?: number;
  includeSheets?: boolean;
  includeEventsNews?: boolean;
  includeDocuments?: boolean;
  timeBudgetMs?: number;
  resume?: boolean;
  resumeAfterTicker?: string;
  /** true = reprendre AU ticker (log incomplete) ; false = après (query `after`). */
  resumeInclusive?: boolean;
  maxTickers?: number;
  logger?: (msg: string) => void;
}

export interface HistoryBackfillTickerResult {
  ticker: string;
  pricesUpserted: number;
  pricesCanonical: number;
  annualPoints: number;
  monthlyPoints: number;
  dailyPoints: number;
  dailyChunksFetched: number;
  includeDaily: boolean;
  flagDaily: boolean;
  dailyFromIso: string | null;
  dailyGapsPlanned: number;
  existingPoints: number;
  dailySkipReason: string | null;
  sheetsOk: boolean;
  events: number;
  news: number;
  documents: number;
  error?: string;
}

export interface HistoryBackfillSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  incomplete: boolean;
  nextTicker: string | null;
  tickersAttempted: number;
  tickersOk: number;
  pricesUpserted: number;
  pricesCanonical: number;
  flagDaily: boolean;
  includeDaily: boolean;
  forceDaily: boolean;
  minDailyPoints: number;
  perTicker: HistoryBackfillTickerResult[];
}

function log(opts: HistoryBackfillOptions, msg: string): void {
  (opts.logger ?? console.log)(msg);
}

function timeLeft(startedAt: number, budgetMs: number | undefined): number {
  if (budgetMs == null || budgetMs <= 0) return Number.POSITIVE_INFINITY;
  return budgetMs - (Date.now() - startedAt);
}

async function loadExistingPrices(db: PrismaClient, companyId: string): Promise<ExistingPriceRef[]> {
  const rows = await db.priceHistory.findMany({
    where: { companyId },
    select: { date: true, source: true, closePrice: true },
  });
  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    source: r.source as DataSourceCode,
    closePrice: Number(r.closePrice),
  }));
}

async function persistSikaQuotes(
  db: PrismaClient,
  companyIdByTicker: Map<string, string>,
  existing: ExistingPriceRef[],
  incoming: RawPriceQuote[]
): Promise<{ upserted: number; canonical: number; existing: ExistingPriceRef[] }> {
  const toUpsert = quotesNeedingUpsert(incoming, existing);
  if (toUpsert.length === 0) {
    return { upserted: 0, canonical: 0, existing };
  }
  const { reconciled } = reconcilePriceBatch(toUpsert);
  const mergedPreview = mergeExistingPrices(existing, toUpsert);
  const filtered = quotesEligibleForCanonical(reconciled, mergedPreview);
  const persist = await persistPriceQuotes(db, toUpsert, filtered, companyIdByTicker);
  return {
    upserted: persist.upserted,
    canonical: persist.markedCanonical,
    existing: mergedPreview,
  };
}

async function findResumeTicker(db: PrismaClient): Promise<string | null> {
  const logs = await db.ingestionLog.findMany({
    where: { source: DataSource.SIKAFINANCE },
    orderBy: { runAt: "desc" },
    take: 25,
    select: { errors: true },
  });
  for (const row of logs) {
    const payload = row.errors as { kind?: string; incomplete?: boolean; nextTicker?: string } | null;
    if (payload?.kind === LOG_KIND && payload.incomplete && payload.nextTicker) {
      return payload.nextTicker.toUpperCase();
    }
  }
  return null;
}

export async function runHistoryBackfill(
  options: HistoryBackfillOptions = {},
  db: PrismaClient = prisma
): Promise<HistoryBackfillSummary> {
  const flags = getHistoryBackfillFlags();
  const startedAtMs = Date.now();
  const startedAt = new Date();

  const forceDaily = options.forceDaily === true;
  const minDailyPoints = options.minDailyPoints ?? DEFAULT_MIN_DAILY_POINTS_PER_CHUNK;
  const includeDailyRequested =
    forceDaily || (options.includeDaily !== false && options.dailyFrom !== "off");
  const includeDailyEffective = includeDailyRequested && (forceDaily || flags.daily);

  if (!flags.enabled) {
    log(options, "→ Backfill historique désactivé (INGESTION_ENABLE_HISTORY_BACKFILL=false)");
    return {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      incomplete: false,
      nextTicker: null,
      tickersAttempted: 0,
      tickersOk: 0,
      pricesUpserted: 0,
      pricesCanonical: 0,
      flagDaily: flags.daily,
      includeDaily: false,
      forceDaily,
      minDailyPoints,
      perTicker: [],
    };
  }

  const includeAnnual = options.includeAnnual !== false;
  const includeMonthly = options.includeMonthly !== false;
  const includeSheets = options.includeSheets !== false && flags.sheets;
  const includeEventsNews = options.includeEventsNews !== false && flags.eventsNews;
  const includeDocuments =
    options.includeDocuments !== false && flags.documents && isOuestbourseSupabaseConfigured();

  const only = options.tickers?.map((t) => t.toUpperCase()).filter(Boolean);
  const companies = await db.company.findMany({
    where: { isActive: true, ...(only?.length ? { ticker: { in: only } } : {}) },
    select: { id: true, ticker: true, listedSince: true },
    orderBy: { ticker: "asc" },
  });
  const companyIdByTicker = new Map(companies.map((c) => [c.ticker, c.id]));

  let resumeAfter = options.resumeAfterTicker?.toUpperCase() ?? null;
  let resumeInclusive = options.resumeInclusive === true;
  if (!resumeAfter && options.resume !== false && !only?.length) {
    resumeAfter = await findResumeTicker(db);
    resumeInclusive = true;
  }
  let queue = companies;
  if (resumeAfter) {
    const idx = queue.findIndex((c) =>
      resumeInclusive ? c.ticker >= resumeAfter! : c.ticker > resumeAfter!
    );
    queue = idx >= 0 ? queue.slice(idx) : [];
    if (queue.length) {
      log(
        options,
        `→ Reprise ${resumeInclusive ? "depuis" : "après"} ${resumeAfter} (${queue.length} restante(s))`
      );
    }
  }
  if (options.maxTickers != null && options.maxTickers >= 0) {
    queue = queue.slice(0, options.maxTickers);
  }

  const dailyFromOpt = options.dailyFrom;
  log(
    options,
    `→ Backfill historique Sika — ${queue.length} société(s)` +
      ` · annuel=${includeAnnual ? options.annualFromYear ?? DEFAULT_ANNUAL_FROM_YEAR : "off"}` +
      ` · mensuel=${includeMonthly}` +
      ` · journalier=${includeDailyEffective ? dailyFromOpt ?? "auto" : "off"}` +
      ` · flagDaily=${flags.daily} forceDaily=${forceDaily} minDailyPoints=${minDailyPoints}` +
      ` · fiches=${includeSheets} events=${includeEventsNews} docs=${includeDocuments}`
  );

  const ingestionLog = await db.ingestionLog.create({
    data: { source: DataSource.SIKAFINANCE, status: IngestionStatus.RUNNING },
  });

  const perTicker: HistoryBackfillTickerResult[] = [];
  let pricesUpserted = 0;
  let pricesCanonical = 0;
  let incomplete = false;
  let nextTicker: string | null = null;

  try {
    for (let i = 0; i < queue.length; i++) {
      const co = queue[i]!;
      if (timeLeft(startedAtMs, options.timeBudgetMs) < 20_000) {
        incomplete = true;
        nextTicker = co.ticker;
        log(options, `⏱ Budget temps atteint avant ${co.ticker} — reprise au prochain run`);
        break;
      }

      const result: HistoryBackfillTickerResult = {
        ticker: co.ticker,
        pricesUpserted: 0,
        pricesCanonical: 0,
        annualPoints: 0,
        monthlyPoints: 0,
        dailyPoints: 0,
        dailyChunksFetched: 0,
        includeDaily: includeDailyEffective,
        flagDaily: flags.daily,
        dailyFromIso: null,
        dailyGapsPlanned: 0,
        existingPoints: 0,
        dailySkipReason: null,
        sheetsOk: false,
        events: 0,
        news: 0,
        documents: 0,
      };

      try {
        let existing = await loadExistingPrices(db, co.id);
        let firstSikaIso: string | null = null;

        if (includeAnnual) {
          const annual = await sikafinanceConnector.fetchAnnualHistory(
            co.ticker,
            options.annualFromYear ?? DEFAULT_ANNUAL_FROM_YEAR
          );
          if (annual.ok) {
            result.annualPoints = annual.data.length;
            firstSikaIso = minIsoDate(firstSikaIso, earliestIsoFromQuotes(annual.data));
            const persisted = await persistSikaQuotes(db, companyIdByTicker, existing, annual.data);
            existing = persisted.existing;
            result.pricesUpserted += persisted.upserted;
            result.pricesCanonical += persisted.canonical;
          } else {
            result.error = annual.error;
            log(options, `  ${co.ticker}: annuel ✗ ${annual.error}`);
          }
        }

        if (includeMonthly) {
          const fromYear = firstSikaIso
            ? Number(firstSikaIso.slice(0, 4))
            : (options.annualFromYear ?? DEFAULT_ANNUAL_FROM_YEAR);
          const monthly = await sikafinanceConnector.fetchMonthlyHistory(co.ticker, fromYear);
          if (monthly.ok) {
            result.monthlyPoints = monthly.data.length;
            // min() : le mensuel GetHistos est souvent tronqué (~60 mois) et
            // ne doit pas écraser l'annuel qui remonte plus loin (BICC 2006).
            firstSikaIso = minIsoDate(firstSikaIso, earliestIsoFromQuotes(monthly.data));
            const persisted = await persistSikaQuotes(db, companyIdByTicker, existing, monthly.data);
            existing = persisted.existing;
            result.pricesUpserted += persisted.upserted;
            result.pricesCanonical += persisted.canonical;
          } else {
            log(options, `  ${co.ticker}: mensuel ✗ ${monthly.error}`);
          }
        }

        const plan = planDailyBackfill({
          flagDaily: flags.daily,
          forceDaily,
          includeDailyRequested: options.includeDaily !== false,
          dailyFromOpt,
          firstSikaIso,
          existing,
          listedSinceIso: co.listedSince ? toIsoDate(co.listedSince) : null,
          annualFromYear: options.annualFromYear ?? DEFAULT_ANNUAL_FROM_YEAR,
          minDailyPoints,
          todayIso: toIsoDate(new Date()),
        });
        result.includeDaily = plan.includeDaily;
        result.flagDaily = plan.flagDaily;
        result.dailyFromIso = plan.fromIso;
        result.dailyGapsPlanned = plan.gaps.length;
        result.existingPoints = plan.existingPoints;
        result.dailySkipReason = plan.skipReason;

        if (plan.includeDaily && plan.gaps.length > 0) {
          const limit = maxDailyChunksThisRun({
            timeLeftMs: timeLeft(startedAtMs, options.timeBudgetMs),
            maxDailyChunks: options.maxDailyChunks,
          });
          if (limit === 0) {
            result.dailySkipReason = "time_budget";
            incomplete = true;
            nextTicker = co.ticker;
          } else {
            const toFetch = plan.gaps.slice(0, Number.isFinite(limit) ? limit : plan.gaps.length);
            for (const range of toFetch) {
              if (timeLeft(startedAtMs, options.timeBudgetMs) < 20_000) {
                result.dailySkipReason = "time_budget";
                incomplete = true;
                nextTicker = co.ticker;
                break;
              }
              const part = await sikafinanceConnector.fetchHistos(co.ticker, range.from, range.to, "0");
              result.dailyChunksFetched += 1;
              if (!part.ok) {
                log(options, `  ${co.ticker}: journalier ${range.from}→${range.to} ✗ ${part.error}`);
                continue;
              }
              result.dailyPoints += part.data.length;
              const persisted = await persistSikaQuotes(db, companyIdByTicker, existing, part.data);
              existing = persisted.existing;
              result.pricesUpserted += persisted.upserted;
              result.pricesCanonical += persisted.canonical;
            }
            if (result.dailyChunksFetched < plan.gaps.length) {
              incomplete = true;
              nextTicker = co.ticker;
            }
          }
        }

        if (includeSheets) {
          const sheet = await sikafinanceConnector.fetchCompanySheet(co.ticker);
          if (sheet.ok) {
            result.sheetsOk = true;
            await persistCompanyProfiles(db, [sheet.data.profile], companyIdByTicker);
            await persistFinancialRatios(db, sheet.data.fundamentals, companyIdByTicker);
            await persistDividendRows(db, sheet.data.dividends, companyIdByTicker);
          } else {
            log(options, `  ${co.ticker}: fiche ✗ ${sheet.error}`);
          }
        }

        if (includeEventsNews) {
          const events = await sikafinanceConnector.fetchCompanyEvents(co.ticker);
          if (events.ok) {
            const r = await persistCompanyEvents(db, events.data, companyIdByTicker);
            result.events = r.upserted;
          }
          const news = await sikafinanceConnector.fetchCompanyNews(co.ticker);
          if (news.ok) {
            const r = await persistCompanyNews(db, news.data, companyIdByTicker);
            result.news = r.upserted;
          }
        }

        if (includeDocuments) {
          try {
            const docs = await fetchOuestbourseDocuments(co.ticker);
            const r = await persistCompanyDocuments(db, obDocumentsToRaw(co.ticker, docs), companyIdByTicker);
            result.documents = r.upserted;
          } catch (err) {
            log(options, `  ${co.ticker}: docs ✗ ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        pricesUpserted += result.pricesUpserted;
        pricesCanonical += result.pricesCanonical;
        log(
          options,
          `  ${co.ticker}: annuel ${result.annualPoints}` +
            ` · mensuel ${result.monthlyPoints}` +
            ` · journalier ${result.dailyPoints}` +
            ` (${result.dailyChunksFetched}/${result.dailyGapsPlanned} fenêtres` +
            ` from=${result.dailyFromIso ?? "n/a"}` +
            ` flagDaily=${result.flagDaily}` +
            (result.dailySkipReason ? ` skip=${result.dailySkipReason}` : "") +
            `)` +
            ` · existants ${result.existingPoints}` +
            ` · prix +${result.pricesUpserted}` +
            (result.sheetsOk ? " · fiche OK" : "") +
            (result.events ? ` · events ${result.events}` : "") +
            (result.news ? ` · news ${result.news}` : "") +
            (result.documents ? ` · docs ${result.documents}` : "")
        );
      } catch (err) {
        result.error = err instanceof Error ? err.message : String(err);
        log(options, `  ${co.ticker}: ÉCHEC ${result.error}`);
      }

      perTicker.push(result);
      if (incomplete && nextTicker === co.ticker) {
        log(options, `  ${co.ticker}: journalier incomplet — reprise sur ce ticker au prochain run`);
        break;
      }
    }

    if (!incomplete && options.timeBudgetMs && timeLeft(startedAtMs, options.timeBudgetMs) < 0) {
      incomplete = true;
    }
  } finally {
    const ok = perTicker.filter((t) => !t.error).length;
    const status =
      incomplete || perTicker.some((t) => t.error)
        ? perTicker.some((t) => !t.error)
          ? IngestionStatus.PARTIAL
          : IngestionStatus.FAILED
        : IngestionStatus.SUCCESS;
    await db.ingestionLog.update({
      where: { id: ingestionLog.id },
      data: {
        status,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAtMs,
        recordsProcessed: perTicker.length,
        recordsInserted: pricesUpserted,
        recordsFailed: perTicker.filter((t) => t.error).length,
        errors: {
          kind: LOG_KIND,
          incomplete,
          nextTicker,
          tickersOk: ok,
        },
      },
    });
  }

  const finishedAt = new Date();
  log(
    options,
    `✔ backfill upsert=${pricesUpserted} canoniques=${pricesCanonical}` +
      ` · ${perTicker.filter((t) => !t.error).length}/${perTicker.length} OK` +
      (incomplete && nextTicker ? ` · suite=${nextTicker}` : "")
  );

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAtMs,
    incomplete,
    nextTicker,
    tickersAttempted: perTicker.length,
    tickersOk: perTicker.filter((t) => !t.error).length,
    pricesUpserted,
    pricesCanonical,
    flagDaily: flags.daily,
    includeDaily: includeDailyEffective,
    forceDaily,
    minDailyPoints,
    perTicker,
  };
}
