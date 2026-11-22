// Tickers suivis par l'utilisateur courant (null = visiteur non connecté).
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";

export async function getWatchedTickersForCurrentUser(): Promise<string[] | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const rows = await prisma.watchlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { ticker: true },
  });
  return rows.map((r: { ticker: string }) => r.ticker);
}
