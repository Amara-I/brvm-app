import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { parsePortfolioType, type PortfolioTypeId } from "@/lib/portfolio-types";

export async function getPreferredPortfolioType(): Promise<PortfolioTypeId | null> {
  const user = await getCurrentUser().catch(() => null);
  if (!user?.id) return null;
  try {
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { preferredPortfolioType: true },
    });
    return parsePortfolioType(row?.preferredPortfolioType);
  } catch (error) {
    if (isDatabaseUnavailable(error)) return null;
    throw error;
  }
}
