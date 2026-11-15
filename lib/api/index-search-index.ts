// Catalogue léger des indices pour la recherche (code, nom, place).
// Mis en cache 1 h, invalidé par l'étiquette d'ingestion `market-indices`.
import { prisma } from "@/lib/prisma";
import { cachedLoader, MARKET_INDICES_REVALIDATE_S, MARKET_INDICES_TAG } from "@/lib/cache/market-cache";
import type { IndexSearchSource } from "@/lib/search/documents";

export const getIndexSearchIndex = cachedLoader(
  async (): Promise<IndexSearchSource[]> => {
    const rows = await prisma.marketIndex.findMany({
      select: { code: true, name: true, exchange: true },
      orderBy: [{ exchange: "asc" }, { name: "asc" }],
    });
    return rows.map((row) => ({
      code: row.code,
      name: row.name,
      exchange: String(row.exchange),
    }));
  },
  ["index-search-index-v1"],
  { revalidate: MARKET_INDICES_REVALIDATE_S, tags: [MARKET_INDICES_TAG] },
);
