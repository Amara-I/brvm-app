import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { loadRecentIndexLevels } from "./market-summary-snapshot";
import type { ListingExchange } from "@/lib/markets/listing-scope";

export const getLandingMarkets = unstable_cache(async () => Promise.all((["BRVM", "NGX"] as const).map(async (exchange) => {
  const [count, levels] = await Promise.all([
    prisma.company.count({ where: { isActive: true, exchange } }), loadRecentIndexLevels(exchange),
  ]);
  const index = levels.find((i) => i.code === (exchange === "NGX" ? "NGX_ASI" : "BRVM_COMPOSITE"));
  return { exchange, count, index: index ?? null };
})), ["landing-markets-v1"], { revalidate: 60 });
export type LandingMarket = { exchange: ListingExchange; count: number | null; index: Awaited<ReturnType<typeof loadRecentIndexLevels>>[number] | null };
