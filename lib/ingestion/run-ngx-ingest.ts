// Ingestion NGX isolée du lot BRVM : les cours ne passent pas dans la
// réconciliation Sikafinance/Richbourse. Budget quotidien plafonné par l'appelant.

import type { Prisma, PrismaClient } from "@prisma/client";
import { IngestionStatus } from "@prisma/client";
import { refreshChartSeries } from "@/lib/charts/refresh-chart-series";
import { fetchEurNgnRate, upsertEurNgnRate } from "@/lib/markets/fx";
import { currencyForExchange } from "@/lib/markets/listing-scope";
import { prisma } from "@/lib/prisma";
import { sendIngestionAlert } from "./alerts";
import { collarConfigForExchange } from "./price-collar";
import { persistIndexQuotes, persistPriceQuotes } from "./persist";
import { reconcileIndexBatch, reconcilePriceBatch } from "./reconciliation";
import type { NgxListingQuote } from "./ngx/listing-quote";
import { loadNgxCover, loadNgxEquities } from "./ngx/load-session";
import { chooseCompanyName, colorForTicker, sectorSlug } from "./ngx/names";
import type { RawIndexQuote, RawPriceQuote } from "./types";

export interface NgxIngestOptions {
  budgetMs?: number;
  logger?: (msg: string) => void;
  now?: Date;
  refreshCharts?: boolean;
  db?: PrismaClient;
}

export interface NgxIngestSummary {
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  quotes: number;
  indices: number;
  companiesUpserted: number;
  collisions: string[];
  fxStored: boolean;
  chartsUpdated: number;
  kind: string | null;
  errors: string[];
}

const UNCLASSIFIED = "UNCLASSIFIED";

function log(options: NgxIngestOptions, message: string) {
  (options.logger ?? console.log)(`[ngx] ${message}`);
}

async function ensureCountry(db: PrismaClient) {
  return db.country.upsert({
    where: { code: "NG" },
    update: {},
    create: { code: "NG", name: "Nigeria", flagEmoji: "🇳🇬" },
  });
}

async function ensureSector(db: PrismaClient, official: string | null) {
  const name = (official?.trim().toUpperCase() || UNCLASSIFIED).slice(0, 80);
  const slug = sectorSlug(name) || "ngx-unclassified";
  const bySlug = await db.sector.findUnique({ where: { slug } });
  if (bySlug) return bySlug;
  const byName = await db.sector.findUnique({ where: { name } });
  if (byName) return byName;
  return db.sector.create({ data: { name, slug } });
}

export async function upsertNgxListings(
  db: PrismaClient,
  quotes: NgxListingQuote[]
): Promise<{ companyIdByTicker: Map<string, string>; collisions: string[]; upserted: number }> {
  const country = await ensureCountry(db);
  const companyIdByTicker = new Map<string, string>();
  const collisions: string[] = [];
  let upserted = 0;
  const sectorCache = new Map<string, string>();

  for (const quote of quotes) {
    const ticker = quote.symbol.toUpperCase();
    const existing = await db.company.findUnique({ where: { ticker } });
    if (existing && existing.exchange !== "NGX") {
      collisions.push(ticker);
      continue;
    }
    const sectorKey = quote.sector?.trim().toUpperCase() || UNCLASSIFIED;
    let sectorId = sectorCache.get(sectorKey);
    if (!sectorId) {
      const sector = await ensureSector(db, sectorKey);
      sectorId = sector.id;
      sectorCache.set(sectorKey, sectorId);
    }
    const prevMeta =
      existing?.profileMeta && typeof existing.profileMeta === "object" && !Array.isArray(existing.profileMeta)
        ? (existing.profileMeta as Record<string, unknown>)
        : {};
    const legalName = chooseCompanyName(
      typeof prevMeta.legalName === "string" ? prevMeta.legalName : existing?.name,
      quote.name,
      ticker
    );
    const profileMeta: Prisma.InputJsonValue = {
      ...prevMeta,
      legalName,
      ...(quote.board ? { board: quote.board } : {}),
      source: "NGX_OFFICIEL",
    };
    if (!existing) {
      const created = await db.company.create({
        data: {
          exchange: "NGX",
          currency: currencyForExchange("NGX"),
          ticker,
          name: chooseCompanyName(null, quote.name, ticker),
          countryId: country.id,
          sectorId,
          color: colorForTicker(ticker),
          profileMeta,
        },
      });
      companyIdByTicker.set(ticker, created.id);
      upserted++;
      continue;
    }
    const updated = await db.company.update({
      where: { id: existing.id },
      data: {
        name: chooseCompanyName(existing.name, quote.name, ticker),
        sectorId,
        currency: "NGN",
        profileMeta,
      },
    });
    companyIdByTicker.set(ticker, updated.id);
    upserted++;
  }

  return { companyIdByTicker, collisions, upserted };
}

export async function persistNgxQuotes(
  db: PrismaClient,
  quotes: NgxListingQuote[],
  companyIdByTicker: Map<string, string>,
  fetchedAt: string
): Promise<number> {
  const raw: RawPriceQuote[] = [];
  for (const quote of quotes) {
    if (!companyIdByTicker.has(quote.symbol.toUpperCase())) continue;
    raw.push({
      ticker: quote.symbol.toUpperCase(),
      closePrice: quote.close,
      volume: quote.volume,
      source: "NGX_OFFICIEL",
      date: quote.tradeDate,
      fetchedAt,
      changePercent: quote.changePercent,
      prevClose: quote.prevClose,
    });
  }
  if (raw.length === 0) return 0;
  const { reconciled } = reconcilePriceBatch(raw);
  const result = await persistPriceQuotes(db, raw, reconciled, companyIdByTicker, {
    collar: collarConfigForExchange("NGX"),
    collarLabel: "NGX (~±10 %)",
  });
  return result.upserted;
}

export async function persistNgxIndices(db: PrismaClient, snapshot: {
  printDate: string;
  asi: { code: string; name: string; value: number; changePercent: number | null };
  indices: { code: string; name: string; value: number; changePercent: number | null }[];
}, fetchedAt: string): Promise<number> {
  const prints = [snapshot.asi, ...snapshot.indices].filter((row) => row.code.startsWith("NGX") && row.value > 0);
  for (const row of prints) {
    await db.marketIndex.upsert({
      where: { code: row.code },
      update: { exchange: "NGX", currency: "NGN" },
      create: { code: row.code, name: row.name, exchange: "NGX", currency: "NGN" },
    });
  }
  const raw: RawIndexQuote[] = prints.map((row) => ({
    code: row.code,
    label: row.name,
    value: row.value,
    changePercent: row.changePercent,
    source: "NGX_OFFICIEL",
    date: snapshot.printDate,
    fetchedAt,
  }));
  if (raw.length === 0) return 0;
  await persistIndexQuotes(db, raw, reconcileIndexBatch(raw));
  return raw.length;
}

export async function runNgxDailyIngest(options: NgxIngestOptions = {}): Promise<NgxIngestSummary> {
  const db = options.db ?? prisma;
  const started = Date.now();
  const deadline = options.budgetMs != null ? started + options.budgetMs : undefined;
  const summary: NgxIngestSummary = {
    status: "FAILED",
    quotes: 0,
    indices: 0,
    companiesUpserted: 0,
    collisions: [],
    fxStored: false,
    chartsUpdated: 0,
    kind: null,
    errors: [],
  };

  let logId: string | null = null;
  try {
    const log = await db.ingestionLog.create({
      data: { source: "NGX_OFFICIEL", status: IngestionStatus.RUNNING },
    });
    logId = log.id;
  } catch (err) {
    summary.errors.push(err instanceof Error ? err.message : String(err));
  }

  try {
    const existing = await db.company.findMany({
      where: { exchange: "NGX" },
      select: { ticker: true, name: true },
    });
    const loaded = await loadNgxEquities({
      now: options.now,
      deadlineMs: deadline,
      listings: existing.map((row) => ({ ticker: row.ticker, name: row.name })),
      walkbackDays: 6,
    });
    if (!loaded.ok) {
      summary.errors.push(...loaded.warnings);
      await sendIngestionAlert({
        severity: "critical",
        title: "NGX — cours du jour indisponibles",
        message: loaded.warnings.join(" | ") || "JSON et PDF officiels en échec",
      });
    } else {
      if (loaded.kind !== "json") {
        summary.errors.push(...loaded.warnings);
        await sendIngestionAlert({
          severity: "warning",
          title: "NGX — repli PDF",
          message: `${loaded.kind} ${loaded.date} (${loaded.quotes.length} titres). ${loaded.warnings.join(" | ")}`,
        });
      }
      summary.kind = loaded.kind;
      const upserted = await upsertNgxListings(db, loaded.quotes);
      summary.companiesUpserted = upserted.upserted;
      summary.collisions = upserted.collisions;
      if (upserted.collisions.length > 0) {
        await sendIngestionAlert({
          severity: "warning",
          title: "NGX — ticker déjà utilisé sur une autre place",
          message: upserted.collisions.join(", "),
        });
      }
      summary.quotes = await persistNgxQuotes(db, loaded.quotes, upserted.companyIdByTicker, new Date().toISOString());
      log(options, `${summary.quotes} cours ${loaded.kind} ${loaded.date}`);
    }

    if (deadline == null || Date.now() < deadline - 4_000) {
      const cover = await loadNgxCover({ now: options.now, deadlineMs: deadline, walkbackDays: 6 });
      if (cover.ok) {
        summary.indices = await persistNgxIndices(db, cover.snapshot, new Date().toISOString());
        log(options, `${summary.indices} indices au ${cover.snapshot.printDate}`);
      } else {
        summary.errors.push(...cover.warnings, "couverture d'indices introuvable");
      }
    }

    if (deadline == null || Date.now() < deadline - 2_000) {
      const rate = await fetchEurNgnRate(options.now);
      if (rate) {
        await upsertEurNgnRate(db, rate);
        summary.fxStored = true;
      } else {
        summary.errors.push("taux EUR→NGN indisponible");
      }
    }

    if (options.refreshCharts !== false && (deadline == null || Date.now() < deadline - 3_000)) {
      const left = deadline != null ? deadline - Date.now() : 12_000;
      const charts = await refreshChartSeries(
        { exchange: "NGX", timeBudgetMs: Math.max(3_000, Math.min(12_000, left)), logger: options.logger },
        db
      );
      summary.chartsUpdated = charts.companiesUpdated + charts.indicesUpdated;
    }

    summary.status = summary.quotes > 0 ? (summary.errors.length ? "PARTIAL" : "SUCCESS") : "FAILED";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    summary.errors.push(message);
    summary.status = summary.quotes > 0 ? "PARTIAL" : "FAILED";
    await sendIngestionAlert({
      severity: "critical",
      title: "NGX — erreur d'ingestion",
      message,
    });
  }

  if (logId) {
    await db.ingestionLog
      .update({
        where: { id: logId },
        data: {
          status: IngestionStatus[summary.status],
          finishedAt: new Date(),
          recordsInserted: summary.quotes + summary.indices,
          recordsFailed: summary.errors.length,
          errors: summary.errors.length ? summary.errors : undefined,
          durationMs: Date.now() - started,
        },
      })
      .catch(() => undefined);
  }

  log(options, `fin status=${summary.status} quotes=${summary.quotes} indices=${summary.indices}`);
  return summary;
}
