// Indices de marché : lecture des tables `market_indices` / `market_index_values`.
// Pas d'invention de niveaux — une donnée absente reste null / liste vide.

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { dataSourceLabel } from "@/lib/api/data-source-label";
import { getCompaniesNavIndex } from "@/lib/api/companies-nav-index";
import { resolveIndexCatalog } from "@/lib/markets/index-catalog";
import { computeIndexStats, type IndexHistoryPoint } from "@/lib/markets/index-stats";
import {
  buildIndexComposition,
  sortIndexItems,
  toIndexListItem,
  type MarketIndexDetail,
  type MarketIndexListItem,
} from "@/lib/markets/index-view";

export type {
  IndexConstituent,
  MarketIndexComposition,
  MarketIndexDetail,
  MarketIndexListItem,
} from "@/lib/markets/index-view";
export { groupIndicesByFamily } from "@/lib/markets/index-view";

async function loadIndexListFromDb(): Promise<MarketIndexListItem[]> {
  const [rows, counts] = await Promise.all([
    prisma.marketIndex.findMany({
      include: {
        values: {
          where: { isCanonical: true },
          orderBy: { date: "desc" },
          take: 1,
        },
      },
    }),
    prisma.marketIndexValue.groupBy({
      by: ["marketIndexId"],
      where: { isCanonical: true },
      _count: { _all: true },
    }),
  ]);

  const countById = new Map(counts.map((row) => [row.marketIndexId, row._count._all]));

  const items = rows.map((row) => {
    const lastRow = row.values[0];
    const last = lastRow
      ? {
          value: Number(lastRow.value),
          changePercent: lastRow.changePercent != null ? Number(lastRow.changePercent) : null,
          date: lastRow.date.toISOString().slice(0, 10),
          source: lastRow.source,
        }
      : null;
    return toIndexListItem(row.code, row.name, last, countById.get(row.id) ?? 0);
  });

  return sortIndexItems(items);
}

async function loadIndexDetailFromDb(code: string): Promise<MarketIndexDetail | null> {
  const row = await prisma.marketIndex.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      values: {
        where: { isCanonical: true },
        orderBy: { date: "asc" },
      },
    },
  });
  if (!row) return null;

  const now = Date.now();
  const byDay = new Map<string, IndexHistoryPoint>();
  for (const value of row.values) {
    if (value.date.getTime() > now) continue;
    const time = value.date.toISOString().slice(0, 10);
    byDay.set(time, {
      time,
      value: Number(value.value),
      volume: value.volume != null ? Number(value.volume) : null,
      changePercent: value.changePercent != null ? Number(value.changePercent) : null,
    });
  }
  const series = [...byDay.values()].sort((a, b) => a.time.localeCompare(b.time));
  const last = series[series.length - 1] ?? null;
  const stats = computeIndexStats(series);
  const catalog = resolveIndexCatalog(row.code, row.name);
  const nav = await getCompaniesNavIndex();
  const list = toIndexListItem(
    row.code,
    row.name,
    last
      ? {
          value: last.value,
          changePercent: stats.sessionChangePercent,
          date: last.time,
          source: row.values[row.values.length - 1]?.source ?? "BRVM_OFFICIEL",
        }
      : null,
    series.length
  );

  const lastCanonical = [...row.values].reverse().find((v) => v.date.getTime() <= now);
  if (lastCanonical) {
    list.source = lastCanonical.source;
    list.sourceLabel = dataSourceLabel(lastCanonical.source);
  }

  return {
    ...list,
    stats,
    series,
    composition: buildIndexComposition(catalog.compositionKind, catalog.sectorName, nav.companies),
  };
}

export const getMarketIndexList = cache(async (): Promise<MarketIndexListItem[]> => {
  try {
    return await loadIndexListFromDb();
  } catch (err) {
    if (!isDatabaseUnavailable(err)) throw err;
    console.error("[indices] base injoignable — liste vide", err instanceof Error ? err.message : err);
    return [];
  }
});

export const getMarketIndexDetail = cache(async (code: string): Promise<MarketIndexDetail | null> => {
  try {
    return await loadIndexDetailFromDb(code);
  } catch (err) {
    if (!isDatabaseUnavailable(err)) throw err;
    console.error("[indices] base injoignable — fiche vide", err instanceof Error ? err.message : err);
    return null;
  }
});
