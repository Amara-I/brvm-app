// Catalogue des graphes disponibles sur la plateforme (actions et indices,
// toutes places). Lecture légère, mise en cache 1 h, invalidée par les
// étiquettes d'ingestion déjà en place (companies-full, ngx-market, market-indices).

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import {
  cachedLoader,
  MARKET_INDICES_REVALIDATE_S,
  MARKET_INDICES_TAG,
  NGX_MARKET_TAG,
} from "@/lib/cache/market-cache";
import { COMPANIES_FULL_TAG } from "@/lib/cache/revalidate-quotes";
import { normalizeExchange } from "@/lib/search/routes";

const NGX_FLAG = "🇳🇬";
import {
  chartCatalogHref,
  chartCatalogKey,
  groupChartCatalog,
  hiddenCatalogCounts,
  INDEX_COLOR,
  type ChartCatalog,
  type ChartCatalogEntry,
} from "./chart-catalog-core";

export {
  chartCatalogHref,
  chartCatalogKey,
  filterChartCatalog,
  groupChartCatalog,
  hiddenCatalogCounts,
  indexSortRank,
  INDEX_COLOR,
  type ChartCatalog,
  type ChartCatalogEntry,
  type ChartCatalogGroup,
  type ChartCatalogKind,
} from "./chart-catalog-core";

function toCompanyEntry(row: {
  ticker: string;
  name: string;
  exchange: string;
  color: string;
  sector: { name: string };
  country: { flagEmoji: string };
}): ChartCatalogEntry {
  const exchange = normalizeExchange(row.exchange);
  const symbol = row.ticker.trim().toUpperCase();
  const base = {
    kind: "company" as const,
    symbol,
    exchange,
  };
  return {
    key: chartCatalogKey(base),
    symbol,
    name: row.name,
    exchange,
    kind: "company",
    sector: row.sector.name,
    countryFlag: row.country.flagEmoji,
    color: row.color || INDEX_COLOR,
    href: chartCatalogHref(base),
  };
}

function toIndexEntry(row: { code: string; name: string; exchange: string }): ChartCatalogEntry {
  const exchange = normalizeExchange(row.exchange);
  const symbol = row.code.trim().toUpperCase();
  const base = { kind: "index" as const, symbol, exchange };
  return {
    key: chartCatalogKey(base),
    symbol,
    name: row.name,
    exchange,
    kind: "index",
    sector: null,
    countryFlag: exchange === "NGX" ? NGX_FLAG : "",
    color: INDEX_COLOR,
    href: chartCatalogHref(base),
  };
}

function assembleCatalog(
  companies: ChartCatalogEntry[],
  indices: ChartCatalogEntry[],
  totals: { companies: number; indices: number }
): ChartCatalog {
  const entries = [...companies, ...indices];
  const hidden = hiddenCatalogCounts(totals, {
    companies: companies.length,
    indices: indices.length,
  });
  return {
    entries,
    groups: groupChartCatalog(entries),
    visibleCompanies: companies.length,
    visibleIndices: indices.length,
    ...hidden,
  };
}

async function loadChartCatalogUncached(): Promise<ChartCatalog> {
  // Filtres `some` → EXISTS SQL. Pas de `take` / `distinct` imbriqués Prisma
  // (ces formes rapatrient l'historique en mémoire Node).
  const [companyRows, indexRows, companyCount, indexCount] = await Promise.all([
    prisma.company.findMany({
      where: {
        isActive: true,
        OR: [
          { priceHistory: { some: { isCanonical: true } } },
          { chartSeries: { some: { pointCount: { gt: 0 } } } },
        ],
      },
      select: {
        ticker: true,
        name: true,
        exchange: true,
        color: true,
        sector: { select: { name: true } },
        country: { select: { flagEmoji: true } },
      },
      orderBy: [{ exchange: "asc" }, { ticker: "asc" }],
    }),
    prisma.marketIndex.findMany({
      where: { values: { some: { isCanonical: true } } },
      select: { code: true, name: true, exchange: true },
      orderBy: [{ exchange: "asc" }, { code: "asc" }],
    }),
    prisma.company.count({ where: { isActive: true } }),
    prisma.marketIndex.count(),
  ]);

  return assembleCatalog(
    companyRows.map((row) => toCompanyEntry({ ...row, exchange: String(row.exchange) })),
    indexRows.map((row) => toIndexEntry({ ...row, exchange: String(row.exchange) })),
    { companies: companyCount, indices: indexCount }
  );
}

const getCachedChartCatalog = cachedLoader(loadChartCatalogUncached, ["chart-catalog-v1"], {
  revalidate: MARKET_INDICES_REVALIDATE_S,
  tags: [COMPANIES_FULL_TAG, NGX_MARKET_TAG, MARKET_INDICES_TAG],
});

const EMPTY_CATALOG: ChartCatalog = {
  entries: [],
  groups: [],
  visibleCompanies: 0,
  visibleIndices: 0,
  hiddenCompanies: 0,
  hiddenIndices: 0,
};

/** Déduplique les appels au sein d'une même requête RSC. */
export const getChartCatalog = cache(async (): Promise<ChartCatalog> => {
  try {
    return await getCachedChartCatalog();
  } catch (err) {
    if (!isDatabaseUnavailable(err)) throw err;
    console.error(
      "[chart-catalog] base injoignable —",
      process.env.NODE_ENV === "production" ? "catalogue vide" : "repli seed local",
      err instanceof Error ? err.message : err
    );
    if (process.env.NODE_ENV === "production") return EMPTY_CATALOG;
    const { seedChartCatalog } = await import("@/lib/api/offline-seed-dataset");
    return seedChartCatalog();
  }
});
