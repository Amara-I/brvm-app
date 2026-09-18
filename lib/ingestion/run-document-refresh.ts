// Actualise le catalogue documents BRVM (via OuestBourse Supabase) et,
// optionnellement, les comptes annuels extraits de ces PDF (screener + financials_annual).
// Aucun PDF n'est inventé : upsert des URLs réelles brvm.org déjà indexées.
//
// Usage :
//   npm run docs:refresh
//   npx ts-node scripts/refresh-documents.ts SNTS SGBC
//   GET /api/cron/refresh-documents?budgetMs=240000
//   POST /api/companies/:ticker/refresh-documents

import { DataSource, IngestionStatus, Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { getHistoryBackfillFlags } from "./connector-config";
import {
  fetchOuestbourseDocuments,
  fetchOuestbourseFinancialsAnnual,
  fetchOuestbourseScreenerMetrics,
  isOuestbourseSupabaseConfigured,
  obDocumentsToRaw,
  obFinancialsToFundamentals,
} from "./connectors/ouestbourse_supabase";
import { isResultsPublication } from "./document-kinds";
import { persistCompanyDocuments, persistFinancialRatios } from "./persist";

const LOG_KIND = "DOCUMENT_REFRESH";

export interface DocumentRefreshOptions {
  tickers?: string[];
  maxTickers?: number;
  timeBudgetMs?: number;
  includeFundamentals?: boolean;
  resume?: boolean;
  resumeAfterTicker?: string;
  resumeInclusive?: boolean;
  logger?: (msg: string) => void;
}

export interface DocumentRefreshTickerResult {
  ticker: string;
  documentsUpserted: number;
  resultsDocuments: number;
  fundamentalsUpserted: number;
  error?: string;
}

export interface DocumentRefreshSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  source: "OUESTBOURSE" | null;
  skipped: boolean;
  skipReason: string | null;
  incomplete: boolean;
  nextTicker: string | null;
  tickersAttempted: number;
  tickersOk: number;
  documentsUpserted: number;
  resultsDocuments: number;
  fundamentalsUpserted: number;
  perTicker: DocumentRefreshTickerResult[];
}

function log(options: DocumentRefreshOptions, msg: string) {
  options.logger?.(msg);
}

function timeLeft(startedAtMs: number, budgetMs: number | undefined): number {
  if (budgetMs == null || budgetMs <= 0) return Number.POSITIVE_INFINITY;
  return budgetMs - (Date.now() - startedAtMs);
}

export function documentRefreshSkipReason(opts: {
  documentsEnabled: boolean;
  obConfigured: boolean;
}): string | null {
  if (!opts.documentsEnabled) {
    return "Catalogue documents désactivé (INGESTION_ENABLE_OB_DOCUMENTS=false).";
  }
  if (!opts.obConfigured) {
    return "OUESTBOURSE_SUPABASE_ANON_KEY absent — catalogue BRVM/OB indisponible.";
  }
  return null;
}

function asRefreshLogPayload(errors: unknown): {
  kind?: string;
  incomplete?: boolean;
  nextTicker?: string | null;
} | null {
  if (!errors || typeof errors !== "object") return null;
  return errors as { kind?: string; incomplete?: boolean; nextTicker?: string | null };
}

async function loadResumeTicker(db: PrismaClient): Promise<string | null> {
  const rows = await db.ingestionLog.findMany({
    where: { source: DataSource.OUESTBOURSE },
    orderBy: { runAt: "desc" },
    take: 8,
    select: { errors: true },
  });
  for (const row of rows) {
    const payload = asRefreshLogPayload(row.errors);
    if (payload?.kind !== LOG_KIND) continue;
    if (payload.incomplete && payload.nextTicker) return payload.nextTicker.toUpperCase();
  }
  return null;
}

export async function runDocumentRefresh(
  options: DocumentRefreshOptions = {},
  db: PrismaClient = prisma
): Promise<DocumentRefreshSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date();
  const flags = getHistoryBackfillFlags();
  const skipReason = documentRefreshSkipReason({
    documentsEnabled: flags.documents,
    obConfigured: isOuestbourseSupabaseConfigured(),
  });

  const empty = (extra: Partial<DocumentRefreshSummary> = {}): DocumentRefreshSummary => ({
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAtMs,
    source: isOuestbourseSupabaseConfigured() ? "OUESTBOURSE" : null,
    skipped: Boolean(skipReason),
    skipReason,
    incomplete: false,
    nextTicker: null,
    tickersAttempted: 0,
    tickersOk: 0,
    documentsUpserted: 0,
    resultsDocuments: 0,
    fundamentalsUpserted: 0,
    perTicker: [],
    ...extra,
  });

  if (skipReason) {
    log(options, `→ Documents : ignoré — ${skipReason}`);
    return empty();
  }

  const includeFundamentals = options.includeFundamentals !== false;
  const only = options.tickers?.map((t) => t.toUpperCase()).filter(Boolean);
  const companies = await db.company.findMany({
    where: { isActive: true, ...(only?.length ? { ticker: { in: only } } : {}) },
    select: { id: true, ticker: true },
    orderBy: { ticker: "asc" },
  });
  const companyIdByTicker = new Map(companies.map((c) => [c.ticker, c.id]));

  let resumeAfter = options.resumeAfterTicker?.toUpperCase() ?? null;
  let resumeInclusive = options.resumeInclusive === true;
  if (!resumeAfter && options.resume !== false && !only?.length) {
    resumeAfter = await loadResumeTicker(db);
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

  log(
    options,
    `→ Documents BRVM/OB — ${queue.length} société(s)` +
      ` · fondamentaux=${includeFundamentals ? "oui" : "non"}` +
      ` · source=OuestBourse (brvm_documents + brvm_financials_annual)`
  );

  const ingestionLog = await db.ingestionLog.create({
    data: { source: DataSource.OUESTBOURSE, status: IngestionStatus.RUNNING },
  });

  const perTicker: DocumentRefreshTickerResult[] = [];
  let documentsUpserted = 0;
  let resultsDocuments = 0;
  let fundamentalsUpserted = 0;
  let tickersOk = 0;
  let incomplete = false;
  let nextTicker: string | null = null;

  try {
    for (let i = 0; i < queue.length; i++) {
      const co = queue[i]!;
      if (timeLeft(startedAtMs, options.timeBudgetMs) < 12_000) {
        incomplete = true;
        nextTicker = co.ticker;
        log(options, `⏱ Budget temps atteint avant ${co.ticker} — reprise au prochain run`);
        break;
      }

      const row: DocumentRefreshTickerResult = {
        ticker: co.ticker,
        documentsUpserted: 0,
        resultsDocuments: 0,
        fundamentalsUpserted: 0,
      };

      try {
        const docs = await fetchOuestbourseDocuments(co.ticker);
        const raw = obDocumentsToRaw(co.ticker, docs);
        const persisted = await persistCompanyDocuments(db, raw, companyIdByTicker);
        row.documentsUpserted = persisted.upserted;
        row.resultsDocuments = raw.filter((d) => isResultsPublication(d)).length;
        documentsUpserted += row.documentsUpserted;
        resultsDocuments += row.resultsDocuments;

        if (includeFundamentals) {
          const [screeners, annuals] = await Promise.all([
            fetchOuestbourseScreenerMetrics(co.ticker),
            fetchOuestbourseFinancialsAnnual(co.ticker),
          ]);
          const fundamentals = obFinancialsToFundamentals(
            co.ticker,
            screeners[0] ?? null,
            annuals
          );
          if (fundamentals.length > 0) {
            const r = await persistFinancialRatios(db, fundamentals, companyIdByTicker);
            row.fundamentalsUpserted = r.upserted;
            fundamentalsUpserted += r.upserted;
          }
        }

        tickersOk++;
        log(
          options,
          `  ${co.ticker}: docs=${row.documentsUpserted} (résultats=${row.resultsDocuments})` +
            (includeFundamentals ? ` · fondamentaux=${row.fundamentalsUpserted}` : "")
        );
      } catch (err) {
        row.error = err instanceof Error ? err.message : String(err);
        log(options, `  ${co.ticker}: ✗ ${row.error}`);
      }

      perTicker.push(row);
    }

    const status =
      tickersOk === 0 && perTicker.length > 0
        ? IngestionStatus.FAILED
        : incomplete || perTicker.some((p) => p.error)
          ? IngestionStatus.PARTIAL
          : IngestionStatus.SUCCESS;

    await db.ingestionLog.update({
      where: { id: ingestionLog.id },
      data: {
        status,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAtMs,
        recordsProcessed: perTicker.length,
        recordsInserted: documentsUpserted,
        recordsFailed: perTicker.filter((p) => p.error).length,
        errors: {
          kind: LOG_KIND,
          incomplete,
          nextTicker,
          tickersOk,
          documentsUpserted,
          resultsDocuments,
          fundamentalsUpserted,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.ingestionLog
      .update({
        where: { id: ingestionLog.id },
        data: {
          status: IngestionStatus.FAILED,
          finishedAt: new Date(),
          errors: { kind: LOG_KIND, message } as unknown as Prisma.InputJsonValue,
        },
      })
      .catch(() => undefined);
    throw err;
  }

  const summary: DocumentRefreshSummary = {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAtMs,
    source: "OUESTBOURSE",
    skipped: false,
    skipReason: null,
    incomplete,
    nextTicker,
    tickersAttempted: perTicker.length,
    tickersOk,
    documentsUpserted,
    resultsDocuments,
    fundamentalsUpserted,
    perTicker,
  };
  log(
    options,
    `✔ Documents BRVM/OB : ${tickersOk}/${perTicker.length} OK · upserts ${documentsUpserted}` +
      ` · résultats ${resultsDocuments} · fondamentaux ${fundamentalsUpserted}` +
      (incomplete ? ` · incomplet → ${nextTicker}` : "")
  );
  return summary;
}

export function parseDocumentRefreshSearchParams(params: URLSearchParams): DocumentRefreshOptions {
  const tickersRaw = params.get("tickers")?.trim();
  const tickers = tickersRaw
    ? tickersRaw
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean)
    : undefined;
  const maxTickersRaw = params.get("maxTickers");
  const budgetRaw = params.get("budgetMs");
  const after = params.get("after")?.trim().toUpperCase();
  const noResume = params.get("noResume") === "1" || params.get("noResume") === "true";
  const noFundamentals = params.get("noFundamentals") === "1" || params.get("noFundamentals") === "true";

  return {
    tickers,
    maxTickers: maxTickersRaw ? Math.max(0, Number(maxTickersRaw) || 0) : undefined,
    timeBudgetMs: budgetRaw ? Math.max(5_000, Number(budgetRaw) || 240_000) : 240_000,
    includeFundamentals: !noFundamentals,
    resume: !noResume,
    resumeAfterTicker: after || undefined,
    resumeInclusive: false,
  };
}
