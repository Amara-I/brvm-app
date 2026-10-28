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
import { loadNgxCover, loadNgxEquities } from "./ngx/load-session";
import { persistNgxIndices, persistNgxQuotes, upsertNgxListings } from "./run-ngx-ingest";

const LOG_KIND = "NGX_HISTORY";
const DONE_COUNT = 80;
/** Ne pas lancer un PDF s'il reste moins que ça : timeout doclib = 25 s. */
const MIN_SLICE_MS = 25_000;
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
  /** true = enregistrer le dernier EUR→NGN. Défaut false. */
  fx?: boolean;
  /** Séance unique : accepter le JSON du jour s'il porte cette date. */
  tryJson?: boolean;
  resume?: boolean;
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

async function readDbCheckpoint(db: PrismaClient, from: string, to: string): Promise<Checkpoint | null> {
  const rows = await db.ingestionLog.findMany({
    where: { source: "NGX_OFFICIEL" },
    orderBy: { runAt: "desc" },
    take: 20,
    select: { errors: true },
  });
  for (const row of rows) {
    const rec = asRecord(row.errors);
    if (!rec || rec.kind !== LOG_KIND || rec.from !== from || rec.to !== to) continue;
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
  const savedFile = resume ? await readCheckpoint() : null;
  const savedDb = resume ? await readDbCheckpoint(db, from, to).catch(() => null) : null;
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
      errors: { kind: LOG_KIND, from, to, next: days[cursor] ?? null, absentDates: [...absent] },
    },
  });

  const persistProgress = async (status: IngestionStatus) => {
    checkpoint.absent = [...absent];
    checkpoint.done = [...done];
    await writeCheckpoint(checkpoint).catch(() => undefined);
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
            kind: LOG_KIND,
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
      for (; cursor < days.length; cursor++) {
        const iso = days[cursor]!;
        if (processed >= limit) {
          checkpoint.next = iso;
          break;
        }
        checkpoint.next = iso;
        if (done.has(iso) || absent.has(iso)) continue;
        const count = await canonicalCount(db, iso);
        if (count >= DONE_COUNT) {
          done.add(iso);
          skippedCanonical++;
          continue;
        }
        if (remaining() < MIN_SLICE_MS) {
          log(options, `budget restant ${remaining()} ms — arrêt avant ${iso}`);
          break;
        }
        processed++;
        const listings = await db.company.findMany({
          where: { exchange: "NGX" },
          select: { ticker: true, name: true },
        });
        const named = listings.map((row) => ({ ticker: row.ticker, name: row.name }));
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
            const upserted = await upsertNgxListings(db, loaded.quotes);
            const n = await persistNgxQuotes(db, loaded.quotes, upserted.companyIdByTicker, new Date().toISOString());
            quotes += n;
            done.add(iso);
            log(options, `${iso} ${loaded.kind} ${n} cours`);
            if (options.indices !== false && remaining() >= 8_000) {
              const cover = await loadNgxCover({ onlyDate: iso, deadlineMs: deadline ?? undefined });
              if (cover.ok) indices += await persistNgxIndices(db, cover.snapshot, new Date().toISOString());
            }
          }
        } catch (err) {
          failed++;
          failedDates.push(iso);
          log(options, `${iso} exception : ${err instanceof Error ? err.message : String(err)}`);
        }
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
        { exchange: "NGX", timeBudgetMs: slice, after, logger: options.logger },
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
