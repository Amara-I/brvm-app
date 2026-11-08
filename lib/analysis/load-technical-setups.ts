import { prisma } from "@/lib/prisma";
import { fromCompactPoints, type ChartSeriesMetaPayload } from "@/lib/charts/chart-series-cache";
import { adjustSeries, adjustmentFingerprint } from "@/lib/corporate-actions/adjust";
import { actionsByTicker } from "@/lib/corporate-actions/load";
import type { AdjustmentAction } from "@/lib/corporate-actions/types";
import { isMissingDatabaseObject } from "@/lib/db/is-database-unavailable";
import { analyzePriceHistoryCached } from "@/lib/technical-analysis/cache";
import { technicalLevels } from "@/lib/technical-analysis/levels";
import type { CloseInput } from "@/lib/technical-analysis/types";
import type { TechnicalSetup } from "./technical-plan";

/**
 * Séries de clôtures → plans `source: "technical"`.
 * Invalidation et premier objectif viennent de `technicalLevels` (scénario du signal).
 * Un titre sans niveau chiffré est omis : le dimensionnement retombe alors sur
 * le stop de la ligne, puis l'ATR.
 */
export function setupsFromCloses(seriesByTicker: Record<string, CloseInput[]>): TechnicalSetup[] {
  const setups: TechnicalSetup[] = [];
  for (const [raw, points] of Object.entries(seriesByTicker)) {
    const ticker = raw.toUpperCase();
    if (!points || points.length < 8) continue;
    const levels = technicalLevels(analyzePriceHistoryCached(points));
    const reference = levels.lastClose;
    if (reference == null || !(reference > 0)) continue;
    if (levels.invalidation == null && levels.targets.length === 0) continue;
    setups.push({
      ticker,
      referencePrice: reference,
      invalidation: levels.invalidation,
      target: levels.targets[0] ?? null,
      riskReward: levels.riskReward,
      source: "technical",
      asOf: levels.asOf,
    });
  }
  return setups;
}

async function loadCloses(tickers: string[]): Promise<Record<string, CloseInput[]>> {
  const rows = await prisma.chartSeries.findMany({
    where: { kind: "COMPANY", rangeKey: "MAX", symbol: { in: tickers } },
    select: { symbol: true, points: true, meta: true },
  });
  let actions = new Map<string, AdjustmentAction[]>();
  try {
    actions = await actionsByTicker();
  } catch (err) {
    if (!isMissingDatabaseObject(err)) {
      console.warn("[technical-setups] fractionnements:", err instanceof Error ? err.message : err);
    }
  }

  const out: Record<string, CloseInput[]> = {};
  for (const row of rows) {
    const points = fromCompactPoints(row.points);
    if (points.length === 0) continue;
    const meta = (row.meta ?? null) as ChartSeriesMetaPayload | null;
    const list = actions.get(row.symbol) ?? [];
    const fp = adjustmentFingerprint(list);
    out[row.symbol.toUpperCase()] = meta?.adjustmentFingerprint === fp ? points : adjustSeries(points, list);
  }

  const missing = tickers.filter((ticker) => (out[ticker]?.length ?? 0) < 8);
  if (missing.length === 0) return out;

  const companies = await prisma.company.findMany({
    where: { ticker: { in: missing }, isActive: true },
    select: { id: true, ticker: true },
  });
  if (companies.length === 0) return out;
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 4);
  const prices = await prisma.priceHistory.findMany({
    where: {
      companyId: { in: companies.map((company) => company.id) },
      isCanonical: true,
      date: { gte: since, lte: new Date() },
    },
    orderBy: [{ companyId: "asc" }, { date: "asc" }],
    select: { companyId: true, date: true, closePrice: true, volume: true },
  });
  const idToTicker = new Map(companies.map((company) => [company.id, company.ticker.toUpperCase()]));
  const built: Record<string, CloseInput[]> = {};
  for (const row of prices) {
    const ticker = idToTicker.get(row.companyId);
    const value = Number(row.closePrice);
    if (!ticker || !(value > 0)) continue;
    const list = built[ticker] ?? [];
    list.push({
      time: row.date.toISOString().slice(0, 10),
      value,
      volume: row.volume != null ? Number(row.volume) : null,
    });
    built[ticker] = list;
  }
  for (const [ticker, points] of Object.entries(built)) {
    const list = actions.get(ticker) ?? [];
    out[ticker] = list.length > 0 ? adjustSeries(points, list) : points;
  }
  return out;
}

/**
 * Plans techniques pour le dimensionnement de position.
 * `source` est toujours `"technical"`. Tableau vide si aucune série n'est lisible.
 */
export async function loadTechnicalSetups(tickers: readonly string[]): Promise<TechnicalSetup[]> {
  const unique = [...new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return [];
  try {
    const series = await loadCloses(unique);
    return setupsFromCloses(series);
  } catch (err) {
    if (!isMissingDatabaseObject(err)) {
      console.warn("[technical-setups]", err instanceof Error ? err.message : err);
    }
    return [];
  }
}
