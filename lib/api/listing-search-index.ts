// Index de recherche commun, sans historique ni repli sur des cours de démonstration.
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ListingSearchItem } from "@/lib/markets/search";

export const getListingSearchIndex = unstable_cache(async (): Promise<ListingSearchItem[]> => {
  // Toutes les places actives : le filtre ne liste pas BRVM/NGX en dur.
  const rows = await prisma.company.findMany({
    where: { isActive: true },
    select: { ticker: true, name: true, exchange: true, sector: { select: { name: true } } },
    orderBy: [{ exchange: "asc" }, { name: "asc" }],
  });
  return rows.map((c) => ({
    ticker: c.ticker,
    name: c.name,
    exchange: String(c.exchange),
    sector: c.sector.name,
  }));
}, ["listing-search-index-v2"], { revalidate: 60, tags: ["companies-nav"] });
