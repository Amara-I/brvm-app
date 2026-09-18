import { prisma } from "@/lib/prisma";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { parsePortfolioType, type PortfolioTypeId } from "@/lib/portfolio/types";

/** Préférence persistée ; null si non connecté, non choisi, ou base indisponible. */
export async function getUserPortfolioType(
  userId: string | null | undefined
): Promise<PortfolioTypeId | null> {
  if (!userId) return null;
  try {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { portfolioType: true },
    });
    return parsePortfolioType(row?.portfolioType ?? null);
  } catch (error) {
    if (isDatabaseUnavailable(error)) return null;
    throw error;
  }
}
