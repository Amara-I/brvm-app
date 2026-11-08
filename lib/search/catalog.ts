import { unstable_cache } from "next/cache";
import { getListingSearchIndex } from "@/lib/api/listing-search-index";
import { prisma } from "@/lib/prisma";
import { educationDocuments } from "@/lib/search/education-documents";
import { indexDocument, stockDocument, type IndexSearchSource, type StockSearchSource } from "@/lib/search/documents";
import { pageDocuments } from "@/lib/search/pages";
import { normalizeExchange } from "@/lib/search/routes";
import type { SiteSearchDocument } from "@/lib/search/types";

export function assembleSiteSearchCatalog(
  companies: StockSearchSource[],
  indices: IndexSearchSource[],
): SiteSearchDocument[] {
  const exchanges = new Set<string>();
  for (const company of companies) exchanges.add(normalizeExchange(company.exchange));
  for (const index of indices) exchanges.add(normalizeExchange(index.exchange));
  const seen = new Set<string>();
  const docs: SiteSearchDocument[] = [];
  for (const doc of [
    ...companies.map(stockDocument),
    ...indices.map(indexDocument),
    ...educationDocuments(),
    ...pageDocuments([...exchanges]),
  ]) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    docs.push(doc);
  }
  return docs;
}

async function readCompanies(): Promise<StockSearchSource[]> {
  try {
    return await getListingSearchIndex();
  } catch {
    return [];
  }
}

async function readIndices(): Promise<IndexSearchSource[]> {
  try {
    const rows = await prisma.marketIndex.findMany({
      select: { code: true, name: true, exchange: true },
      orderBy: [{ exchange: "asc" }, { name: "asc" }],
    });
    return rows.map((row) => ({
      code: row.code,
      name: row.name,
      exchange: String(row.exchange),
    }));
  } catch {
    return [];
  }
}

/**
 * Index de recherche mis en cache. Les sociétés et les indices viennent de
 * la base (toutes les places) ; l'éducation et les pages sont statiques.
 * Un échec de lecture ne retire pas le reste du catalogue.
 */
export const getSiteSearchCatalog = unstable_cache(
  async () => assembleSiteSearchCatalog(await readCompanies(), await readIndices()),
  ["site-search-catalog-v1"],
  { revalidate: 60, tags: ["companies-nav"] },
);
