// Séries de clôture réelles (dates) pour les aperçus sparklines du marché.

import { prisma } from "@/lib/prisma";
import type { ChartClosePoint } from "@/lib/charts/indicators";

/**
 * Toutes les clôtures canoniques non futures, par ticker.
 * Contrairement au dataset annuel (`prices[année]`), on conserve la vraie
 * date de cotation — indispensable pour les horizons courts et pour ne pas
 * dater l'année courante au 31/12 (futur) qui faisait disparaître le cours.
 */
export async function getMarketSparkSeriesByTicker(): Promise<Record<string, ChartClosePoint[]>> {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, ticker: true },
  });
  if (companies.length === 0) return {};

  const idToTicker = new Map(companies.map((c) => [c.id, c.ticker]));
  const now = new Date();

  const rows = await prisma.priceHistory.findMany({
    where: {
      companyId: { in: companies.map((c) => c.id) },
      isCanonical: true,
      date: { lte: now },
    },
    orderBy: [{ companyId: "asc" }, { date: "asc" }],
    select: { companyId: true, date: true, closePrice: true },
  });

  const byTicker: Record<string, ChartClosePoint[]> = {};
  for (const c of companies) byTicker[c.ticker] = [];

  // Déduplique par jour (garde le dernier close du jour).
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
  const rows = await prisma.priceHistory.findMany({
    where: {
      companyId: { in: companies.map((c) => c.id) },
      isCanonical: true,
      date: { lte: now },
    },
    orderBy: [{ companyId: "asc" }, { date: "desc" }],
    select: { companyId: true, date: true, closePrice: true, changePercent: true },
  });

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
    if (latest.changePercent != null) {
      out[ticker] = Math.round(Number(latest.changePercent) * 100) / 100;
      continue;
    }
    if (list.length < 2) continue;
    const last = Number(latest.closePrice);
    const prev = Number(list[1]!.closePrice);
    if (!(prev > 0)) continue;
    const gapDays = (latest.date.getTime() - list[1]!.date.getTime()) / (24 * 3600 * 1000);
    if (gapDays > 14) continue;
    out[ticker] = Math.round(((last - prev) / prev) * 1000) / 10;
  }

  return out;
}
