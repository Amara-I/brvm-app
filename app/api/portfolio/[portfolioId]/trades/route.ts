// GET /api/portfolio/:portfolioId/trades — historique des mouvements (achats / ventes).

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiSuccess, apiError, apiNotFound, privateCacheHeaders } from "@/lib/api/response";
import { listPortfolioTrades, summarizeRealizedPnl } from "@/lib/api/portfolio-trades";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { portfolioId: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const portfolio = await prisma.portfolio.findUnique({ where: { id: params.portfolioId } });
  if (!portfolio || portfolio.userId !== userId) return apiNotFound("Portefeuille");

  const sideParam = request.nextUrl.searchParams.get("side");
  const side = sideParam === "VENTE" || sideParam === "ACHAT" ? sideParam : undefined;

  const trades = await listPortfolioTrades(prisma, portfolio.id, { side, take: 200 });
  const summary = summarizeRealizedPnl(trades);

  return apiSuccess({ trades, summary }, { headers: privateCacheHeaders() });
}
