// Séries de clôture réelles (dates) pour les aperçus sparklines du marché.

import { prisma } from "@/lib/prisma";
import type { ChartClosePoint } from "@/lib/charts/indicators";
import { isMissingDatabaseObject } from "@/lib/db/is-database-unavailable";
import { readCachedSparkSeriesByTicker } from "@/lib/charts/refresh-chart-series";
import { adjustSeries, sessionChangePercent, splitBetween } from "@/lib/corporate-actions/adjust";
import { actionsByTicker } from "@/lib/corporate-actions/load";
import type { AdjustmentAction } from "@/lib/corporate-actions/types";

function sparkFromRows(
  companies: Array<{ id: string; ticker: string }>,
  rows: Array<{ companyId: string; date: Date; closePrice: unknown }>
): Record<string, ChartClosePoint[]> {
  const idToTicker = new Map(companies.map((c) => [c.id, c.ticker]));
  const byTicker: Record<string, ChartClosePoint[]> = {};
  for (const c of companies) byTicker[c.ticker] = [];
  const lastIndexByKey = new Map<string, number>();
  for (const row of rows) {
    const ticker = idToTicker.get(row.companyId);
    if (!ticker) continue;
    const time = row.date.toISOString().slice(0, 10);
    const value = Number(row.closePrice);
    if (!(value > 0)) continue;
    const list = byTicker[ticker]!;
    const key = `${ticker}:${time}`;
    const existingIdx = lastIndexByKey.get(key);
    if (existingIdx != null) {
      list[existingIdx] = { time, value, volume: null };
    } else {
      lastIndexByKey.set(key, list.length);
      list.push({ time, value, volume: null });
    }
  }
  return byTicker;
}

/**
 * Clôtures pour aperçus sparklines. Préfère `chart_series` SPARK (1 requête)
 * ; repli : 3 ans de `price_history` (plus 20 ans de scan).
 */
export async function getMarketSparkSeriesByTicker(): Promise<Record<string, ChartClosePoint[]>> {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, ticker: true },
  });
  if (companies.length === 0) return {};

  try {
    const cached = await readCachedSparkSeriesByTicker(prisma);
    if (cached && Object.keys(cached).length >= Math.min(8, companies.length)) {
      const out: Record<string, ChartClosePoint[]> = {};
      for (const c of companies) out[c.ticker] = cached[c.ticker] ?? [];
      return out;
    }
  } catch (err) {
    if (!isMissingDatabaseObject(err)) {
      console.warn("[spark] cache:", err instanceof Error ? err.message : err);
    }
  }

  const now = new Date();
  const from = new Date(now);
  from.setUTCFullYear(from.getUTCFullYear() - 3);

  const rows = await prisma.priceHistory.findMany({
    where: {
      companyId: { in: companies.map((c) => c.id) },
      isCanonical: true,
      date: { lte: now, gte: from },
    },
    orderBy: [{ companyId: "asc" }, { date: "asc" }],
    select: { companyId: true, date: true, closePrice: true },
  });

  const raw = sparkFromRows(companies, rows);
  try {
    const byTicker = await actionsByTicker();
    for (const company of companies) {
      const actions = byTicker.get(company.ticker) ?? [];
      if (actions.length === 0) continue;
      raw[company.ticker] = adjustSeries(raw[company.ticker] ?? [], actions);
    }
  } catch {
    /* catalogue indisponible — série brute */
  }
  return raw;
}

/**
 * Variation journalière par ticker pour le tableau Marché.
 * Priorité : `change_percent` officiel de la dernière clôture canonique
 * (colonne BRVM « Variation (%) ») ; sinon recalcul vs séance précédente
 * (écart ≤ 14 jours).
 */
export async function getMarketDayChangeByTicker(): Promise<Record<string, number | null>> {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, ticker: true },
  });
  const out: Record<string, number | null> = {};
  for (const c of companies) out[c.ticker] = null;
  if (companies.length === 0) return out;

  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 21);

  const rows = await prisma.priceHistory.findMany({
    where: {
      companyId: { in: companies.map((c) => c.id) },
      isCanonical: true,
      date: { lte: now, gte: from },
    },
    orderBy: [{ companyId: "asc" }, { date: "desc" }],
    select: { companyId: true, date: true, closePrice: true, changePercent: true },
  });

  let actions = new Map<string, AdjustmentAction[]>();
  try {
    actions = await actionsByTicker();
  } catch {
    actions = new Map();
  }

  const idToTicker = new Map(companies.map((c) => [c.id, c.ticker]));
  const byCompany = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byCompany.get(row.companyId) ?? [];
    list.push(row);
    byCompany.set(row.companyId, list);
  }

  for (const [companyId, list] of byCompany) {
    const ticker = idToTicker.get(companyId);
    if (!ticker || list.length === 0) continue;
    const latest = list[0]!;
    const stored =
      latest.changePercent != null ? Math.round(Number(latest.changePercent) * 100) / 100 : null;
    const tickerActions = actions.get(ticker) ?? [];
    if (list.length < 2) {
      out[ticker] = stored;
      continue;
    }
    const prev = list[1]!;
    const prevDate = prev.date.toISOString().slice(0, 10);
    const lastDate = latest.date.toISOString().slice(0, 10);
    const gapDays = (latest.date.getTime() - prev.date.getTime()) / (24 * 3600 * 1000);
    const acrossSplit = splitBetween(tickerActions, prevDate, lastDate);
    if (!acrossSplit && stored != null) {
      out[ticker] = stored;
      continue;
    }
    if (!acrossSplit && gapDays > 14) continue;
    out[ticker] = sessionChangePercent(
      { date: prevDate, close: Number(prev.closePrice) },
      { date: lastDate, close: Number(latest.closePrice) },
      acrossSplit ? null : stored,
      tickerActions
    );
  }

  return out;
}
