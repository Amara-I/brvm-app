// Indices de marché : lecture des tables `market_indices` / `market_index_values`.
// Pas d'invention de niveaux — une donnée absente reste null / liste vide.

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { loadLatestCanonicalIndexValues } from "@/lib/db/latest-canonical";
import { dataSourceLabel } from "@/lib/api/data-source-label";
import { getCompaniesNavIndex } from "@/lib/api/companies-nav-index";
import { resolveIndexCatalog } from "@/lib/markets/index-catalog";
import { computeIndexStats, type IndexHistoryPoint } from "@/lib/markets/index-stats";
import { loadIndexSheetBundle, type IndexSheetBundle } from "@/lib/markets/index-sheet";
import {
  brvm30AvisFallbackComposition,
  buildIndexComposition,
  sortIndexItems,
  toIndexListItem,
  type MarketIndexComposition,
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

async function loadIndexListFromDb(exchange: "BRVM" | "NGX" = "BRVM"): Promise<MarketIndexListItem[]> {
  const [indexRows, counts] = await Promise.all([
    prisma.marketIndex.findMany({ where: { exchange } }),
    prisma.marketIndexValue.groupBy({
      by: ["marketIndexId"],
      where: { isCanonical: true },
      _count: { _all: true },
    }),
  ]);

  const countById = new Map(counts.map((row) => [row.marketIndexId, row._count._all]));
  // Dernière valeur canonique par PostgreSQL (LATERAL … LIMIT 1) : un `take` imbriqué
  // Prisma rapatriait tout l'historique de chaque indice.
  const lastById = await loadLatestCanonicalIndexValues(
    prisma,
    indexRows.map((row) => row.id)
  );
  const rows = indexRows.map((row) => ({ ...row, values: lastById.get(row.id) ?? [] }));

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

async function loadIndexDetailFromDb(
  code: string,
  exchange: "BRVM" | "NGX" = "BRVM"
): Promise<MarketIndexDetail | null> {
  // Série composée d'UN indice (quotidien 800 j, puis hebdo / mensuel), en cache 1 h :
  // l'ancienne lecture de `chart_series` MAX renvoyait tout l'historique à chaque visite.
  const bundle = await loadIndexSheetBundle(code, exchange);
  if (!bundle) return null;
  return detailFromBundle(bundle);
}

/** Détail d'indice (liste, stats, composition BRVM) à partir de la fiche en cache. */
export async function detailFromBundle(bundle: IndexSheetBundle): Promise<MarketIndexDetail> {
  const series: IndexHistoryPoint[] = bundle.series.map((p, i, all) => ({
    time: p.time,
    value: p.value,
    volume: null,
    changePercent: i === all.length - 1 ? bundle.lastChangePercent : null,
  }));
  const last = series[series.length - 1] ?? null;
  const stats = {
    ...computeIndexStats(series),
    historyPoints: bundle.historyPoints,
    firstDate: bundle.firstDate,
  };
  const catalog = resolveIndexCatalog(bundle.code, bundle.name);
  const list = toIndexListItem(
    bundle.code,
    bundle.name,
    last
      ? {
          value: last.value,
          changePercent: stats.sessionChangePercent,
          date: last.time,
          source: bundle.lastSource ?? (bundle.exchange === "NGX" ? "NGX_OFFICIEL" : "BRVM_OFFICIEL"),
        }
      : null,
    bundle.historyPoints
  );
  if (bundle.lastSource) {
    list.source = bundle.lastSource;
    list.sourceLabel = dataSourceLabel(bundle.lastSource);
  }
  let composition: MarketIndexComposition = {
    kind: "unavailable",
    note: "",
    sectorName: null,
    constituents: [],
    asOf: null,
    official: false,
  };
  if (bundle.exchange === "BRVM") {
    const nav = await getCompaniesNavIndex();
    const stored =
      bundle.storedComposition ?? (bundle.code === "BRVM_30" ? brvm30AvisFallbackComposition() : null);
    composition = buildIndexComposition(catalog.compositionKind, catalog.sectorName, nav.companies, stored);
  }
  return { ...list, stats, series, composition };
}

export const getMarketIndexList = cache(async (exchange: "BRVM" | "NGX" = "BRVM"): Promise<MarketIndexListItem[]> => {
  try {
    return await loadIndexListFromDb(exchange);
  } catch (err) {
    if (!isDatabaseUnavailable(err)) throw err;
    console.error("[indices] base injoignable — liste vide", err instanceof Error ? err.message : err);
    return [];
  }
});

export const getMarketIndexDetail = cache(async (
  code: string,
  exchange: "BRVM" | "NGX" = "BRVM"
): Promise<MarketIndexDetail | null> => {
  try {
    return await loadIndexDetailFromDb(code, exchange);
  } catch (err) {
    if (!isDatabaseUnavailable(err)) throw err;
    console.error("[indices] base injoignable — fiche vide", err instanceof Error ? err.message : err);
    return null;
  }
});
