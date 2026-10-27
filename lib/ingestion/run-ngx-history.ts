// Backfill NGX sur 5 ans : PDF « Daily Official List » (repli Daily Summary).
// Idempotent (une date avec ≥ 80 clôtures canoniques est sautée) et reprenable
// via `.cache/ngx-backfill.json` + `ingestion_logs.errors.kind = NGX_HISTORY`.
// Les PDF ne sont pas stockés en base. Le taux EUR→NGN historique n'est pas
// reconstitué : open.er-api.com ne publie que le dernier cours.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { IngestionStatus } from "@prisma/client";
import { refreshChartSeries } from "@/lib/charts/refresh-chart-series";
import { prisma } from "@/lib/prisma";
import { isoDate, weekdaysBetween } from "./ngx/dates";
import { loadNgxCover, loadNgxEquities } from "./ngx/load-session";
import { persistNgxIndices, persistNgxQuotes, upsertNgxListings } from "./run-ngx-ingest";

const LOG_KIND = "NGX_HISTORY";
const DONE_COUNT = 80;
const CHECKPOINT = path.join(process.cwd(), ".cache", "ngx-backfill.json");

export interface NgxHistoryOptions {
  from?: string;
  to?: string;
  limit?: number;
  indices?: boolean;
  charts?: boolean;
  resume?: boolean;
  logger?: (msg: string) => void;
  db?: PrismaClient;
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
      absent: Array.isArray(parsed.absent) ? parsed.absent : [],
      done: Array.isArray(parsed.done) ? parsed.done : [],
    };
  } catch {
    return null;
  }
}

async function writeCheckpoint(checkpoint: Checkpoint): Promise<void> {
  await mkdir(path.dirname(CHECKPOINT), { recursive: true });
  await writeFile(CHECKPOINT, JSON.stringify(checkpoint));
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

export async function runNgxHistoryBackfill(options: NgxHistoryOptions = {}): Promise<{
  done: number;
  absent: number;
  failed: number;
  next: string | null;
}> {
  const db = options.db ?? prisma;
  const to = (options.to ?? isoDate(new Date())).slice(0, 10);
  const from = (options.from ?? isoDate(new Date(Date.parse(`${to}T00:00:00.000Z`) - 5 * 365.25 * 86_400_000))).slice(0, 10);
  const days = weekdaysBetween(from, to);
  const saved = options.resume === false ? null : await readCheckpoint();
  const checkpoint: Checkpoint =
    saved && saved.from === from && saved.to === to
      ? saved
      : { from, to, next: days[0] ?? null, absent: [], done: [] };
  const absent = new Set(checkpoint.absent);
  const done = new Set(checkpoint.done);
  let cursor = checkpoint.next && days.includes(checkpoint.next) ? days.indexOf(checkpoint.next) : 0;
  let processed = 0;
  let failed = 0;
  const limit = options.limit ?? Number.POSITIVE_INFINITY;

  const logRow = await db.ingestionLog.create({
    data: {
      source: "NGX_OFFICIEL",
      status: IngestionStatus.RUNNING,
      errors: { kind: LOG_KIND, from, to, next: days[cursor] ?? null },
    },
  });

  log(options, `séances ${from} → ${to} (${days.length} jours de semaine), reprise à ${days[cursor] ?? "fin"}`);

  try {
    for (; cursor < days.length; cursor++) {
      if (processed >= limit) break;
      const iso = days[cursor]!;
      checkpoint.next = iso;
      if (done.has(iso) || absent.has(iso)) continue;
      const count = await canonicalCount(db, iso);
      if (count >= DONE_COUNT) {
        done.add(iso);
        continue;
      }
      processed++;
      const listings = await db.company.findMany({
        where: { exchange: "NGX" },
        select: { ticker: true, name: true },
      });
      const loaded = await loadNgxEquities({
        onlyDate: iso,
        allowJson: false,
        listings: listings.map((row) => ({ ticker: row.ticker, name: row.name })),
      });
      if (!loaded.ok) {
        if (loaded.absent) {
          absent.add(iso);
          log(options, `${iso} absent (jour férié ou PDF non publié)`);
        } else {
          failed++;
          log(options, `${iso} échec : ${loaded.warnings.join(" | ")}`);
        }
      } else {
        const upserted = await upsertNgxListings(db, loaded.quotes);
        const n = await persistNgxQuotes(db, loaded.quotes, upserted.companyIdByTicker, new Date().toISOString());
        done.add(iso);
        log(options, `${iso} ${loaded.kind} ${n} cours`);
        if (options.indices !== false) {
          const cover = await loadNgxCover({ onlyDate: iso });
          if (cover.ok) await persistNgxIndices(db, cover.snapshot, new Date().toISOString());
        }
      }
      checkpoint.absent = [...absent];
      checkpoint.done = [...done];
      checkpoint.next = days[cursor + 1] ?? null;
      await writeCheckpoint(checkpoint);
    }
  } finally {
    checkpoint.absent = [...absent];
    checkpoint.done = [...done];
    if (cursor >= days.length) checkpoint.next = null;
    await writeCheckpoint(checkpoint).catch(() => undefined);
  }

  let chartsUpdated = 0;
  if (options.charts !== false) {
    let after: string | undefined;
    for (let pass = 0; pass < 8; pass++) {
      const charts = await refreshChartSeries(
        { exchange: "NGX", timeBudgetMs: 60_000, after, logger: options.logger },
        db
      );
      chartsUpdated += charts.companiesUpdated + charts.indicesUpdated;
      if (!charts.incomplete || !charts.nextSymbol) break;
      after = charts.nextSymbol;
    }
    log(options, `chart_series mis à jour : ${chartsUpdated}`);
  }

  const next = checkpoint.next;
  await db.ingestionLog.update({
    where: { id: logRow.id },
    data: {
      status: failed > 0 ? IngestionStatus.PARTIAL : IngestionStatus.SUCCESS,
      finishedAt: new Date(),
      recordsInserted: done.size,
      recordsFailed: failed,
      errors: { kind: LOG_KIND, from, to, next, absent: absent.size, done: done.size, failed },
    },
  });

  return { done: done.size, absent: absent.size, failed, next };
}
