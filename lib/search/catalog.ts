import { getIndexSearchIndex } from "@/lib/api/index-search-index";
import { getListingSearchIndex } from "@/lib/api/listing-search-index";
import { cachedLoader, MARKET_INDICES_TAG } from "@/lib/cache/market-cache";
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
    return await getIndexSearchIndex();
  } catch {
    return [];
  }
}

/**
 * Index de recherche mis en cache. Les sociétés et les indices viennent de
 * la base (toutes les places) ; l'éducation et les pages sont statiques.
 * Un échec de lecture ne retire pas le reste du catalogue.
 * Invalidé avec les sociétés (`companies-nav`) et les indices (`market-indices`).
 */
export const getSiteSearchCatalog = cachedLoader(
  async () => assembleSiteSearchCatalog(await readCompanies(), await readIndices()),
  ["site-search-catalog-v1"],
  { revalidate: 60, tags: ["companies-nav", MARKET_INDICES_TAG] },
);
