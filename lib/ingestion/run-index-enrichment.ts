// Historique multi-points + composition des indices BRVM.
// GetHistos Sikafinance (BRVMC, BRVM30, sectoriels) — aucun niveau inventé.
// Une série Sika n'est persistée que si elle est compatible (±5 %) avec le
// dernier point officiel déjà en base (évite de mélanger des bases rebaseées).

import { IngestionStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { isMissingDatabaseObject } from "../db/is-database-unavailable";
import { prisma } from "../prisma";
import { COMPANIES_FULL } from "../../prisma/seed-data/companies-full";
import { HEADLINE_INDEX_CODES } from "../markets/index-catalog";
import { sikafinanceConnector, loadSikaIndexSymbols } from "./connectors/sikafinance_connector";
import { getIndexEnrichmentFlags } from "./connector-config";
import { fetchBrvm30Composition } from "./fetch-brvm-30-composition";
import { persistIndexConstituents, persistIndexQuotes } from "./persist";
import { toIsoDate, shiftIsoDate } from "./parse-utils";
import { reconcileIndexBatch } from "./reconciliation";
import { indexHistoryCompatible } from "./sika-market-parser";
import type { RawIndexQuote } from "./types";
import type { SikaIndexSymbol } from "./sika-market-parser";

const LOG_KIND = "INDEX_ENRICHMENT";
const DAILY_CHUNK_DAYS = 89;
const DEFAULT_ANNUAL_FROM = 1998;
const DEFAULT_DAILY_MONTHS = 14;

/** Slugs GetHistos stables si la page A–Z ne liste pas encore l'indice. */
export const HEADLINE_SIKA_FALLBACKS: SikaIndexSymbol[] = [
  { code: "BRVM_COMPOSITE", sikaSymbol: "BRVMC", label: "BRVM COMPOSITE" },
  { code: "BRVM_30", sikaSymbol: "BRVM30", label: "BRVM 30" },
];

/** Au-delà, un rerun cron saute le GetHistos (sauf `force`). 80 ≈ 4 mois ouvrés. */
export const MIN_CANONICAL_POINTS_TO_SKIP = 80;

export function shouldSkipIndexHistory(canonicalCount: number, force = false): boolean {
  return !force && canonicalCount >= MIN_CANONICAL_POINTS_TO_SKIP;
}

export function mergeSikaIndexSymbols(fetched: SikaIndexSymbol[]): SikaIndexSymbol[] {
  const have = new Set(fetched.map((s) => s.code));
  return [...fetched, ...HEADLINE_SIKA_FALLBACKS.filter((s) => !have.has(s.code))];
}

export interface IndexEnrichmentOptions {
  codes?: string[];
  includeHistory?: boolean;
  includeComposition?: boolean;
  includeAnnual?: boolean;
  includeMonthly?: boolean;
  includeDaily?: boolean;
  dailyFrom?: string;
  annualFromYear?: number;
  timeBudgetMs?: number;
  /** Re-télécharge même les séries déjà denses. */
  force?: boolean;
  logger?: (msg: string) => void;
}

export interface IndexEnrichmentCodeResult {
  code: string;
  sikaSymbol: string | null;
  annualPoints: number;
  monthlyPoints: number;
  dailyPoints: number;
  upserted: number;
  canonical: number;
  skippedReason: string | null;
  error?: string;
}

export interface IndexEnrichmentSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  compositionUpserted: number;
  compositionSource: string | null;
  codesOk: number;
  codesAttempted: number;
  historyUpserted: number;
  incomplete: boolean;
  compositionError: string | null;
  perCode: IndexEnrichmentCodeResult[];
}

function log(logger: IndexEnrichmentOptions["logger"], msg: string) {
  (logger ?? console.log)(`[index-enrichment] ${msg}`);
}

function chunkDailyRanges(fromIso: string, toIso: string): Array<{ from: string; to: string }> {
  const ranges: Array<{ from: string; to: string }> = [];
  let cursor = new Date(`${fromIso}T00:00:00.000Z`);
  const end = new Date(`${toIso}T00:00:00.000Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) return ranges;
  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + DAILY_CHUNK_DAYS);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    ranges.push({ from: toIsoDate(cursor), to: toIsoDate(chunkEnd) });
    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return ranges;
}

function sortSymbols(symbols: SikaIndexSymbol[], wanted?: string[]): SikaIndexSymbol[] {
  const filtered = wanted
    ? symbols.filter((s) => wanted.includes(s.code))
    : symbols.filter((s) => s.code !== "CAPIBRVM");
  return [...filtered].sort((a, b) => {
    const ah = (HEADLINE_INDEX_CODES as readonly string[]).includes(a.code) ? 0 : 1;
    const bh = (HEADLINE_INDEX_CODES as readonly string[]).includes(b.code) ? 0 : 1;
    if (ah !== bh) return ah - bh;
    return a.code.localeCompare(b.code);
  });
}

async function officialLastByCode(
  db: PrismaClient
): Promise<Map<string, { date: string; value: number }>> {
  const rows = await db.marketIndex.findMany({
    include: {
      values: {
        where: { isCanonical: true },
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });
  const map = new Map<string, { date: string; value: number }>();
  for (const row of rows) {
    const last = row.values[0];
    if (!last) continue;
    map.set(row.code, { date: last.date.toISOString().slice(0, 10), value: Number(last.value) });
  }
  return map;
}

async function canonicalCountsByCode(db: PrismaClient): Promise<Map<string, number>> {
  const indices = await db.marketIndex.findMany({ select: { id: true, code: true } });
  const idToCode = new Map(indices.map((row) => [row.id, row.code]));
  const counts = await db.marketIndexValue.groupBy({
    by: ["marketIndexId"],
    where: { isCanonical: true },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  for (const row of counts) {
    const code = idToCode.get(row.marketIndexId);
    if (code) map.set(code, row._count._all);
  }
  return map;
}

async function persistCompatible(
  db: PrismaClient,
  quotes: RawIndexQuote[],
  official: { date: string; value: number } | null
): Promise<{ upserted: number; canonical: number; skipped: boolean }> {
  if (quotes.length === 0) return { upserted: 0, canonical: 0, skipped: false };
  if (!indexHistoryCompatible(official, quotes.map((q) => ({ date: q.date, value: q.value })))) {
    return { upserted: 0, canonical: 0, skipped: true };
  }
  const reconciled = reconcileIndexBatch(quotes);
  const result = await persistIndexQuotes(db, quotes, reconciled);
  return { upserted: result.upserted, canonical: result.markedCanonical, skipped: false };
}

export async function runIndexEnrichment(
  options: IndexEnrichmentOptions = {},
  db: PrismaClient = prisma
): Promise<IndexEnrichmentSummary> {
  const flags = getIndexEnrichmentFlags();
  const started = Date.now();
  const startedAt = new Date().toISOString();
  const includeHistory = options.includeHistory ?? flags.history;
  const includeComposition = options.includeComposition ?? flags.composition;
  const includeAnnual = options.includeAnnual !== false;
  const includeMonthly = options.includeMonthly !== false;
  const includeDaily = options.includeDaily !== false;
  const toDate = toIsoDate(new Date());
  const dailyFrom =
    options.dailyFrom ??
    shiftIsoDate(toDate, -Math.round((DEFAULT_DAILY_MONTHS * 365) / 12)) ??
    `${new Date().getUTCFullYear() - 1}-01-01`;
  const annualFrom = options.annualFromYear ?? DEFAULT_ANNUAL_FROM;
  const deadline = options.timeBudgetMs ? started + options.timeBudgetMs : null;

  const summary: IndexEnrichmentSummary = {
    startedAt,
    finishedAt: startedAt,
    durationMs: 0,
    compositionUpserted: 0,
    compositionSource: null,
    codesOk: 0,
    codesAttempted: 0,
    historyUpserted: 0,
    incomplete: false,
    compositionError: null,
    perCode: [],
  };

  const logRow = await db.ingestionLog
    .create({
      data: {
        source: "SIKAFINANCE",
        runAt: new Date(),
        status: IngestionStatus.RUNNING,
        errors: { kind: LOG_KIND } as object,
      },
    })
    .catch(() => null);

  const persistComposition = async () => {
    if (!includeComposition) return;
    const known = COMPANIES_FULL.map((c) => c.ticker);
    try {
      const fromDb = await db.company.findMany({ where: { isActive: true }, select: { ticker: true } });
      known.push(...fromDb.map((c) => c.ticker));
    } catch {
      /* seed tickers suffisent */
    }
    try {
      const result = await fetchBrvm30Composition(known);
      if (result.ok && result.data.length > 0) {
        const persisted = await persistIndexConstituents(db, result.data);
        summary.compositionUpserted = persisted.upserted;
        summary.compositionSource = result.data[0]?.note ?? "BRVM_OFFICIEL";
        log(options.logger, `composition BRVM 30 : ${persisted.upserted} titres`);
      } else if (!result.ok) {
        summary.compositionError = result.error;
        log(options.logger, `composition : ${result.error}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.compositionError = isMissingDatabaseObject(err)
        ? "table market_index_constituents absente — prisma migrate deploy requis"
        : message;
      log(options.logger, `composition ignorée : ${summary.compositionError}`);
    }
  };

  if (includeHistory) {
  let symbols: SikaIndexSymbol[] = [];
  try {
    symbols = sortSymbols(mergeSikaIndexSymbols(await loadSikaIndexSymbols()), options.codes);
  } catch (err) {
    log(options.logger, `A–Z indices : ${err instanceof Error ? err.message : String(err)} — repli Composite / BRVM 30`);
    symbols = sortSymbols(HEADLINE_SIKA_FALLBACKS, options.codes);
  }

  const officialByCode = await officialLastByCode(db);
  const canonicalCounts = await canonicalCountsByCode(db);
  const triedSlugs = new Set<string>();

  for (const symbol of symbols) {
    if (deadline && Date.now() >= deadline) {
      summary.incomplete = true;
      break;
    }
    if (triedSlugs.has(`${symbol.code}:${symbol.sikaSymbol}`)) continue;
    triedSlugs.add(`${symbol.code}:${symbol.sikaSymbol}`);

    summary.codesAttempted++;
    const row: IndexEnrichmentCodeResult = {
      code: symbol.code,
      sikaSymbol: symbol.sikaSymbol,
      annualPoints: 0,
      monthlyPoints: 0,
      dailyPoints: 0,
      upserted: 0,
      canonical: 0,
      skippedReason: null,
    };

    try {
      const already = canonicalCounts.get(symbol.code) ?? 0;
      if (shouldSkipIndexHistory(already, options.force === true)) {
        row.skippedReason = `historique déjà suffisant (${already} points)`;
        summary.codesOk++;
        log(options.logger, `${symbol.code} : ${row.skippedReason}`);
        summary.perCode.push(row);
        continue;
      }

      const official = officialByCode.get(symbol.code) ?? null;
      const add = async (quotes: RawIndexQuote[]) => {
        const persisted = await persistCompatible(db, quotes, official);
        if (persisted.skipped) {
          row.skippedReason = "série Sika incompatible avec le niveau officiel (±5 %)";
          return false;
        }
        row.upserted += persisted.upserted;
        row.canonical += persisted.canonical;
        summary.historyUpserted += persisted.upserted;
        return true;
      };

      if (includeAnnual) {
        const annual = await sikafinanceConnector.fetchIndexHistos(
          symbol.code,
          symbol.sikaSymbol,
          symbol.label,
          `${annualFrom}-01-01`,
          toDate,
          "365"
        );
        if (annual.ok) {
          row.annualPoints = annual.data.length;
          if (!(await add(annual.data)) && row.skippedReason) {
            summary.perCode.push(row);
            continue;
          }
        }
      }

      if (includeMonthly) {
        const monthly = await sikafinanceConnector.fetchIndexHistos(
          symbol.code,
          symbol.sikaSymbol,
          symbol.label,
          `${annualFrom}-01-01`,
          toDate,
          "30"
        );
        if (monthly.ok) {
          row.monthlyPoints = monthly.data.length;
          if (!(await add(monthly.data)) && row.skippedReason) {
            summary.perCode.push(row);
            continue;
          }
        }
      }

      if (includeDaily) {
        let compatible = true;
        // Plus récent d'abord : un rebase se détecte sur la fenêtre contemporaine
        // avant d'écrire d'éventuelles fenêtres plus anciennes.
        for (const range of [...chunkDailyRanges(dailyFrom, toDate)].reverse()) {
          if (deadline && Date.now() >= deadline) {
            summary.incomplete = true;
            break;
          }
          const daily = await sikafinanceConnector.fetchIndexHistos(
            symbol.code,
            symbol.sikaSymbol,
            symbol.label,
            range.from,
            range.to,
            "0"
          );
          if (!daily.ok) continue;
          row.dailyPoints += daily.data.length;
          if (!(await add(daily.data))) {
            compatible = false;
            break;
          }
        }
        if (!compatible && row.skippedReason) {
          summary.perCode.push(row);
          continue;
        }
      }

      if (row.upserted > 0 || !row.skippedReason) summary.codesOk++;
      log(
        options.logger,
        `${symbol.code} (${symbol.sikaSymbol}) annual=${row.annualPoints} monthly=${row.monthlyPoints} daily=${row.dailyPoints} upsert=${row.upserted}`
      );
    } catch (err) {
      row.error = err instanceof Error ? err.message : String(err);
      log(options.logger, `${symbol.code} : ${row.error}`);
    }
    summary.perCode.push(row);
  }
  }

  await persistComposition();

  summary.finishedAt = new Date().toISOString();
  summary.durationMs = Date.now() - started;
  if (logRow) {
    await db.ingestionLog
      .update({
        where: { id: logRow.id },
        data: {
          status:
            summary.incomplete || summary.compositionError
              ? IngestionStatus.PARTIAL
              : IngestionStatus.SUCCESS,
          finishedAt: new Date(),
          durationMs: summary.durationMs,
          errors: { kind: LOG_KIND, summary } as object,
        },
      })
      .catch(() => undefined);
  }
  return summary;
}

/** Refresh composition + 21 derniers jours Composite / BRVM 30 (cron quotidien). */
export async function runIndexEnrichmentOnDailyCron(
  remainingMs: number,
  logger?: (msg: string) => void
): Promise<IndexEnrichmentSummary | null> {
  const flags = getIndexEnrichmentFlags();
  if (!flags.compositionOnDailyCron && !flags.recentHistoryOnDailyCron) return null;
  const toDate = toIsoDate(new Date());
  const dailyFrom = shiftIsoDate(toDate, -21) ?? toDate;
  return runIndexEnrichment({
    includeComposition: flags.compositionOnDailyCron,
    includeHistory: flags.recentHistoryOnDailyCron,
    includeAnnual: false,
    includeMonthly: false,
    includeDaily: flags.recentHistoryOnDailyCron,
    dailyFrom,
    codes: flags.recentHistoryOnDailyCron ? [...HEADLINE_INDEX_CODES] : [],
    timeBudgetMs: Math.max(8_000, remainingMs),
    logger,
  });
}
