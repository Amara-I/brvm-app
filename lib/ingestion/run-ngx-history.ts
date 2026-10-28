// Backfill NGX sur 5 ans : PDF « Daily Official List » (repli Daily Summary).
// Idempotent (une date avec ≥ 80 clôtures canoniques est sautée) et reprenable.
// Le CLI écrit `.cache/ngx-backfill.json`. Le cron Vercel n'a pas de disque
// durable : la reprise est le champ `next` + `absentDates` du dernier
// `ingestion_logs` (errors.kind = NGX_HISTORY), ou le query `cursor`.
// Les PDF ne sont pas stockés. Le taux EUR→NGN historique n'est pas inventé.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { IngestionStatus } from "@prisma/client";
import { refreshChartSeries } from "@/lib/charts/refresh-chart-series";
import { fetchEurNgnRate, upsertEurNgnRate } from "@/lib/markets/fx";
import { prisma } from "@/lib/prisma";
import { calendarDaysBetween, isoDate, weekdaysBetween } from "./ngx/dates";
import { loadNgxCover, loadNgxEquities, loadNgxSummaryQuotes } from "./ngx/load-session";
import { applyNgxTickerAliases, NGX_SUMMARY_ONLY, NGX_TICKER_ALIASES } from "./ngx/ticker-aliases";
import { persistNgxIndices, persistNgxQuotes, upsertNgxListings } from "./run-ngx-ingest";

const LOG_KIND = "NGX_HISTORY";
const LOG_KIND_REFILL = "NGX_HISTORY_REFILL";
/** Tickers longs : le parseur de la liste officielle les perdait quand le PDF les collait au nom. */
const LONG_TICKER_MIN = 10;
const DONE_COUNT = 80;
/** Plancher : ne pas lancer une séance s'il reste moins que ça (timeout doclib = 25 s). */
const MIN_SLICE_MS = 25_000;
/** Marge sur la séance la plus longue déjà vue dans ce chunk. */
const SLICE_SAFETY = 1.5;
/** Reste minimal pour tenter la page de couverture (délai doclib 2 s + PDF). */
const MIN_COVER_MS = 8_000;
const CHECKPOINT = path.join(process.cwd(), ".cache", "ngx-backfill.json");

export interface NgxHistoryOptions {
  from?: string;
  to?: string;
  /** Démarre à cette date (reprise HTTP). */
  cursor?: string;
  limit?: number;
  /** Plafond d'horloge. Absent = pas de limite (CLI). */
  budgetMs?: number;
  indices?: boolean;
  /** Défaut CLI : true. Le cron de chunk passe false. */
  charts?: boolean;
  chartsAfter?: string;
  /** true = reconstruire les chart_series NGX même si le cache semble à jour. */
  chartsForce?: boolean;
  /** true = enregistrer le dernier EUR→NGN. Défaut false. */
  fx?: boolean;
  /** Séance unique : accepter le JSON du jour s'il porte cette date. */
  tryJson?: boolean;
  resume?: boolean;
  /**
   * Rattrapage ciblé : retraite aussi les séances déjà complètes (≥ 80 clôtures)
   * mais n'écrit QUE les cours manquants des tickers visés (anciens codes
   * rattachés, tickers longs, titres du Daily Summary seul). Ne touche à aucune
   * ligne existante. Ignore le checkpoint fichier ; enchaîner avec `cursor`.
   */
  refill?: boolean;
  now?: Date;
  logger?: (msg: string) => void;
  db?: PrismaClient;
}

export interface NgxHistorySummary {
  from: string;
  to: string;
  next: string | null;
  cursor: string | null;
  incomplete: boolean;
  weekdayIndex: number;
  weekdayTotal: number;
  processed: number;
  skippedCanonical: number;
  /** Tickers du PDF absents de la base NGX : ignorés (l'historique ne crée rien). */
  skippedUnknown: number;
  /** Cours rattachés à un ticker courant via un ancien code (FBNH → FIRSTHOLDCO…). */
  aliasRemapped: number;
  done: number;
  absent: number;
  failed: number;
  failedDates: string[];
  quotes: number;
  indices: number;
  fxStored: boolean;
  chartsUpdated: number;
  chartsIncomplete: boolean;
  chartsNext: string | null;
  budgetMs: number | null;
  durationMs: number;
}

interface Checkpoint {
  from: string;
  to: string;
  next: string | null;
  absent: string[];
  done: string[];
}

function log(options: NgxHistoryOptions, message: string) {
  (options.logger ?? console.log)(`[ngx-history] ${message}`);
}

async function readCheckpoint(): Promise<Checkpoint | null> {
  try {
    const raw = await readFile(CHECKPOINT, "utf8");
    const parsed = JSON.parse(raw) as Checkpoint;
    if (!parsed || typeof parsed.from !== "string" || typeof parsed.to !== "string") return null;
    return {
      from: parsed.from,
      to: parsed.to,
      next: parsed.next ?? null,
      absent: Array.isArray(parsed.absent) ? parsed.absent.filter((item) => typeof item === "string") : [],
      done: Array.isArray(parsed.done) ? parsed.done.filter((item) => typeof item === "string") : [],
    };
  } catch {
    return null;
  }
}

async function writeCheckpoint(checkpoint: Checkpoint): Promise<void> {
  await mkdir(path.dirname(CHECKPOINT), { recursive: true });
  await writeFile(CHECKPOINT, JSON.stringify(checkpoint));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function readDbCheckpoint(db: PrismaClient, from: string, to: string, kind: string): Promise<Checkpoint | null> {
  const rows = await db.ingestionLog.findMany({
    where: { source: "NGX_OFFICIEL" },
    orderBy: { runAt: "desc" },
    take: 20,
    select: { errors: true },
  });
  for (const row of rows) {
    const rec = asRecord(row.errors);
    if (!rec || rec.kind !== kind || rec.from !== from || rec.to !== to) continue;
    const absent = Array.isArray(rec.absentDates) ? rec.absentDates.filter((item): item is string => typeof item === "string") : [];
    const next = typeof rec.next === "string" ? rec.next : null;
    return { from, to, next, absent, done: [] };
  }
  return null;
}

async function canonicalCount(db: PrismaClient, iso: string): Promise<number> {
  return db.priceHistory.count({
    where: {
      isCanonical: true,
      source: "NGX_OFFICIEL",
      date: new Date(`${iso}T00:00:00.000Z`),
      company: { exchange: "NGX" },
    },
  });
}

/** Dates de la fenêtre qui ont déjà un niveau NGX_ASI (une requête, pas une par jour). */
async function datesWithAsi(db: PrismaClient, from: string, to: string): Promise<Set<string>> {
  const rows = await db.marketIndexValue.findMany({
    where: {
      marketIndex: { code: "NGX_ASI" },
      source: "NGX_OFFICIEL",
      date: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T00:00:00.000Z`) },
    },
    select: { date: true },
  });
  return new Set(rows.map((row) => row.date.toISOString().slice(0, 10)));
}

export async function runNgxHistoryBackfill(options: NgxHistoryOptions = {}): Promise<NgxHistorySummary> {
  const db = options.db ?? prisma;
  const now = options.now ?? new Date();
  const started = Date.now();
  const deadline = options.budgetMs != null ? started + options.budgetMs : null;
  const remaining = () => (deadline == null ? Number.POSITIVE_INFINITY : deadline - Date.now());
  const to = (options.to ?? isoDate(now)).slice(0, 10);
  const from = (options.from ?? isoDate(new Date(Date.parse(`${to}T00:00:00.000Z`) - 5 * 365.25 * 86_400_000))).slice(0, 10);
  const days = weekdaysBetween(from, to);
  const resume = options.resume !== false;
  const refill = options.refill === true;
  const logKind = refill ? LOG_KIND_REFILL : LOG_KIND;
  const savedFile = resume && !refill ? await readCheckpoint() : null;
  const savedDb = resume ? await readDbCheckpoint(db, from, to, logKind).catch(() => null) : null;
  const absentSeed = new Set([...(savedDb?.absent ?? []), ...(savedFile && savedFile.from === from && savedFile.to === to ? savedFile.absent : [])]);
  const explicitCursor = options.cursor && days.includes(options.cursor) ? options.cursor : null;
  const fileMatches = savedFile && savedFile.from === from && savedFile.to === to ? savedFile : null;
  const startNext = explicitCursor ?? fileMatches?.next ?? savedDb?.next ?? days[0] ?? null;
  const checkpoint: Checkpoint = {
    from,
    to,
    next: startNext && days.includes(startNext) ? startNext : (days[0] ?? null),
    absent: [...absentSeed],
    done: fileMatches?.done ?? [],
  };
  const absent = new Set(checkpoint.absent);
  const done = new Set(checkpoint.done);
  let cursor = checkpoint.next && days.includes(checkpoint.next) ? days.indexOf(checkpoint.next) : 0;
  let processed = 0;
  let skippedCanonical = 0;
  let skippedUnknown = 0;
  let aliasRemapped = 0;
  let failed = 0;
  let quotes = 0;
  let indices = 0;
  const failedDates: string[] = [];
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const skipHistory = limit === 0;

  const logRow = await db.ingestionLog.create({
    data: {
      source: "NGX_OFFICIEL",
      status: IngestionStatus.RUNNING,
      errors: { kind: logKind, from, to, next: days[cursor] ?? null, absentDates: [...absent] },
    },
  });

  const persistProgress = async (status: IngestionStatus) => {
    checkpoint.absent = [...absent];
    checkpoint.done = [...done];
    if (!refill) await writeCheckpoint(checkpoint).catch(() => undefined);
    await db.ingestionLog
      .update({
        where: { id: logRow.id },
        data: {
          status,
          finishedAt: status === IngestionStatus.RUNNING ? undefined : new Date(),
          recordsInserted: quotes + indices,
          recordsFailed: failed,
          durationMs: Date.now() - started,
          errors: {
            kind: logKind,
            from,
            to,
            next: checkpoint.next,
            absentDates: [...absent],
            doneCount: done.size,
            failed,
            failedDates,
            incomplete: checkpoint.next != null && !skipHistory,
          },
        },
      })
      .catch(() => undefined);
  };

  log(options, `séances ${from} → ${to} (${days.length} jours), reprise à ${days[cursor] ?? "fin"}`);

  try {
    if (!skipHistory) {
      // Les sociétés NGX existantes (une requête par appel, pas par séance).
      // L'historique n'en crée ni n'en renomme : il n'écrit que des cours.
      const companyRows = await db.company.findMany({
        where: { exchange: "NGX" },
        select: { id: true, ticker: true, name: true },
      });
      const companyIdByTicker = new Map(companyRows.map((row) => [row.ticker.toUpperCase(), row.id]));
      const knownTickers = new Set(companyIdByTicker.keys());

      // Rattrapage : tickers visés et séances où ils ont déjà un cours canonique.
      const refillTargets = new Set<string>();
      const haveDates = new Map<string, Set<string>>();
      if (refill) {
        for (const alias of NGX_TICKER_ALIASES) refillTargets.add(alias.current);
        for (const ticker of knownTickers) if (ticker.length >= LONG_TICKER_MIN) refillTargets.add(ticker);
        for (const only of NGX_SUMMARY_ONLY) refillTargets.add(only.ticker);
        for (const ticker of [...refillTargets]) if (!knownTickers.has(ticker)) refillTargets.delete(ticker);
        const idToTicker = new Map([...refillTargets].map((ticker) => [companyIdByTicker.get(ticker)!, ticker]));
        const existing = await db.priceHistory.findMany({
          where: { companyId: { in: [...idToTicker.keys()] }, source: "NGX_OFFICIEL", isCanonical: true },
          select: { companyId: true, date: true },
        });
        for (const row of existing) {
          const ticker = idToTicker.get(row.companyId)!;
          if (!haveDates.has(ticker)) haveDates.set(ticker, new Set());
          haveDates.get(ticker)!.add(row.date.toISOString().slice(0, 10));
        }
        log(options, `rattrapage : ${refillTargets.size} tickers visés (${[...refillTargets].sort().join(", ")})`);
      }
      const named = companyRows.map((row) => ({ ticker: row.ticker, name: row.name }));
      const wantIndices = options.indices !== false && !refill;
      const asiDates = wantIndices ? await datesWithAsi(db, days[cursor] ?? from, to).catch(() => new Set<string>()) : new Set<string>();
      let longestSliceMs = 0;
      const sliceNeeded = () => Math.max(MIN_SLICE_MS, Math.ceil(longestSliceMs * SLICE_SAFETY));

      const fillIndices = async (iso: string): Promise<void> => {
        if (!wantIndices || asiDates.has(iso) || remaining() < MIN_COVER_MS) return;
        const cover = await loadNgxCover({ onlyDate: iso, deadlineMs: deadline ?? undefined });
        if (cover.ok) {
          indices += await persistNgxIndices(db, cover.snapshot, new Date().toISOString());
          asiDates.add(iso);
        }
      };

      for (; cursor < days.length; cursor++) {
        const iso = days[cursor]!;
        if (processed >= limit) {
          checkpoint.next = iso;
          break;
        }
        checkpoint.next = iso;
        if (!refill && done.has(iso) && (!wantIndices || asiDates.has(iso))) continue;
        if (absent.has(iso)) continue;
        if (remaining() < sliceNeeded()) {
          log(options, `budget restant ${remaining()} ms (< ${sliceNeeded()}) — arrêt avant ${iso}`);
          break;
        }
        const sliceStart = Date.now();
        const count = refill ? 0 : done.has(iso) ? DONE_COUNT : await canonicalCount(db, iso);
        if (count >= DONE_COUNT) {
          done.add(iso);
          skippedCanonical++;
          // Cours déjà en base : il ne manque peut-être que le niveau d'indice.
          if (wantIndices && !asiDates.has(iso)) {
            processed++;
            try {
              await fillIndices(iso);
            } catch (err) {
              log(options, `${iso} indices : ${err instanceof Error ? err.message : String(err)}`);
            }
            longestSliceMs = Math.max(longestSliceMs, Date.now() - sliceStart);
            checkpoint.next = days[cursor + 1] ?? null;
            await persistProgress(IngestionStatus.RUNNING);
          }
          continue;
        }
        processed++;
        try {
          let loaded = options.tryJson
            ? await loadNgxEquities({
                now,
                allowJson: true,
                walkbackDays: 0,
                listings: named,
                deadlineMs: deadline ?? undefined,
              })
            : null;
          if (!loaded || !loaded.ok || loaded.date !== iso) {
            if (options.tryJson && loaded && !loaded.ok) {
              log(options, `${iso} JSON non retenu (${loaded.warnings.join(" | ") || "autre séance"})`);
            }
            loaded = await loadNgxEquities({
              onlyDate: iso,
              allowJson: false,
              listings: named,
              deadlineMs: deadline ?? undefined,
            });
          }
          if (!loaded.ok) {
            if (loaded.absent) {
              absent.add(iso);
              log(options, `${iso} absent (jour férié ou PDF non publié)`);
            } else {
              failed++;
              failedDates.push(iso);
              log(options, `${iso} échec : ${loaded.warnings.join(" | ")}`);
            }
          } else {
            let idMap = companyIdByTicker;
            let sessionQuotes = loaded.quotes;
            if (loaded.kind === "json") {
              // Séance du jour (JSON) = dernière séance : comme l'ingest
              // quotidien, elle peut créer / mettre à jour les sociétés.
              const upserted = await upsertNgxListings(db, loaded.quotes);
              idMap = upserted.companyIdByTicker;
              for (const [ticker, id] of idMap) companyIdByTicker.set(ticker, id);
            } else {
              const aliased = applyNgxTickerAliases(sessionQuotes, knownTickers);
              skippedUnknown += aliased.unknown;
              sessionQuotes = aliased.quotes;
              aliasRemapped += aliased.remapped;
            }
            if (refill) {
              const wanted = (symbol: string) => refillTargets.has(symbol) && !haveDates.get(symbol)?.has(iso);
              sessionQuotes = sessionQuotes.filter((quote) => wanted(quote.symbol));
              const seen = new Set(sessionQuotes.map((quote) => quote.symbol));
              const needSummary = NGX_SUMMARY_ONLY.filter(
                (only) => only.from <= iso && !seen.has(only.ticker) && wanted(only.ticker)
              );
              if (needSummary.length > 0 && remaining() > MIN_SLICE_MS) {
                const fromSummary = await loadNgxSummaryQuotes(iso, named);
                if ("quotes" in fromSummary) {
                  for (const quote of fromSummary.quotes) {
                    if (needSummary.some((only) => only.ticker === quote.symbol.toUpperCase())) sessionQuotes.push(quote);
                  }
                }
              }
            }
            const n = await persistNgxQuotes(db, sessionQuotes, idMap, new Date().toISOString());
            quotes += n;
            done.add(iso);
            log(options, `${iso} ${loaded.kind} ${n} cours`);
            await fillIndices(iso);
          }
        } catch (err) {
          failed++;
          failedDates.push(iso);
          log(options, `${iso} exception : ${err instanceof Error ? err.message : String(err)}`);
        }
        longestSliceMs = Math.max(longestSliceMs, Date.now() - sliceStart);
        checkpoint.next = days[cursor + 1] ?? null;
        checkpoint.absent = [...absent];
        checkpoint.done = [...done];
        await persistProgress(IngestionStatus.RUNNING);
      }
      if (cursor >= days.length) checkpoint.next = null;
    } else {
      checkpoint.next = null;
    }
  } finally {
    checkpoint.absent = [...absent];
    checkpoint.done = [...done];
    if (!skipHistory && cursor >= days.length) checkpoint.next = null;
  }

  let fxStored = false;
  if (options.fx === true && remaining() > 4_000) {
    const rate = await fetchEurNgnRate(now);
    if (rate) {
      await upsertEurNgnRate(db, rate);
      fxStored = true;
      log(options, `EUR→NGN ${rate.ngnPerEur} au ${rate.date}`);
    } else {
      log(options, "taux EUR→NGN indisponible");
    }
  }

  let chartsUpdated = 0;
  let chartsIncomplete = false;
  let chartsNext: string | null = null;
  const wantCharts = options.charts !== false;
  if (wantCharts && remaining() > 8_000) {
    let after = options.chartsAfter;
    const chartBudget = options.budgetMs == null ? 60_000 : Math.max(3_000, remaining() - 1_000);
    const passes = options.budgetMs == null ? 8 : 4;
    for (let pass = 0; pass < passes; pass++) {
      if (remaining() < 8_000) {
        chartsIncomplete = true;
        break;
      }
      const slice = options.budgetMs == null ? 60_000 : Math.max(3_000, Math.min(chartBudget, remaining() - 1_000));
      const charts = await refreshChartSeries(
        { exchange: "NGX", timeBudgetMs: slice, after, force: options.chartsForce === true, logger: options.logger },
        db
      );
      chartsUpdated += charts.companiesUpdated + charts.indicesUpdated;
      if (!charts.incomplete || !charts.nextSymbol) {
        chartsIncomplete = false;
        chartsNext = null;
        break;
      }
      chartsIncomplete = true;
      chartsNext = charts.nextSymbol;
      after = charts.nextSymbol;
      if (options.budgetMs != null) break;
    }
    log(options, `chart_series mis à jour : ${chartsUpdated}${chartsNext ? ` suite=${chartsNext}` : ""}`);
  } else if (wantCharts) {
    chartsIncomplete = true;
    chartsNext = options.chartsAfter ?? null;
  }

  const historyIncomplete = !skipHistory && checkpoint.next != null;
  const next = historyIncomplete ? checkpoint.next : null;
  const summary: NgxHistorySummary = {
    from,
    to,
    next,
    cursor: next,
    incomplete: historyIncomplete || chartsIncomplete,
    weekdayIndex: next && days.includes(next) ? days.indexOf(next) : days.length,
    weekdayTotal: days.length,
    processed,
    skippedCanonical,
    skippedUnknown,
    aliasRemapped,
    done: done.size,
    absent: absent.size,
    failed,
    failedDates,
    quotes,
    indices,
    fxStored,
    chartsUpdated,
    chartsIncomplete,
    chartsNext,
    budgetMs: options.budgetMs ?? null,
    durationMs: Date.now() - started,
  };

  await persistProgress(failed > 0 ? IngestionStatus.PARTIAL : IngestionStatus.SUCCESS);
  if (Math.abs(calendarDaysBetween(from, to)) > 0 && processed === 0 && skippedCanonical > 0) {
    log(options, `${skippedCanonical} séance(s) déjà en base, rien à télécharger dans cette fenêtre`);
  }
  return summary;
}
