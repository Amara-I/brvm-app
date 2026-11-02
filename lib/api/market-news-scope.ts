import type { Prisma } from "@prisma/client";
import type { ListingExchange } from "@/lib/markets/listing-scope";
/** Les articles historiques non étiquetés restent visibles dans « Tous ». */
export function marketNewsWhere(exchange?: ListingExchange, ticker?: string): Prisma.NewsArticleWhereInput {
  return {
    ...(ticker ? { company: { ticker, ...(exchange ? { exchange } : {}) } } : {}),
    ...(exchange && !ticker ? { OR: [
      { company: { exchange } },
      { companyId: null, sourceName: { startsWith: `${exchange} · ` } },
    ] } : {}),
  };
}
