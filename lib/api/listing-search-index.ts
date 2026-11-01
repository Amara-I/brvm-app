// Index de recherche commun, sans historique ni repli sur des cours de démonstration.
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ListingSearchItem } from "@/lib/markets/search";

export const getListingSearchIndex = unstable_cache(async (): Promise<ListingSearchItem[]> => {
  const rows = await prisma.company.findMany({
    where: { isActive: true, exchange: { in: ["BRVM", "NGX"] } },
    select: { ticker: true, name: true, exchange: true, sector: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return rows.map((c) => ({ ticker: c.ticker, name: c.name, exchange: c.exchange as "BRVM" | "NGX", sector: c.sector.name }));
}, ["listing-search-index-v1"], { revalidate: 60, tags: ["companies-nav"] });
