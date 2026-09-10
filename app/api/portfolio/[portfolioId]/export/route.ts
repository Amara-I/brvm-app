// GET /api/portfolio/:portfolioId/export — télécharge les positions (+ mouvements) en .xlsx

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiError, apiNotFound } from "@/lib/api/response";
import { listPortfolioTrades } from "@/lib/api/portfolio-trades";
import {
  buildPortfolioExportFileName,
  buildPortfolioWorkbook,
  formatUtcYmd,
  type PortfolioExcelExportRow,
} from "@/lib/portfolio/portfolio-excel";
import type { BuyHorizonCode } from "@/lib/calc/portfolio-advice";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { portfolioId: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const portfolio = await prisma.portfolio.findUnique({
    where: { id: params.portfolioId },
    include: {
      holdings: {
        include: { company: { select: { ticker: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!portfolio || portfolio.userId !== userId) return apiNotFound("Portefeuille");

  const rows: PortfolioExcelExportRow[] = portfolio.holdings.map((h) => {
    const buy =
      h.buyDate != null
        ? formatUtcYmd(h.buyDate)
        : formatUtcYmd(h.createdAt);
    return {
      ticker: h.company.ticker,
      name: h.company.name,
      quantity: Number(h.quantity),
      avgBuyPrice: Number(h.avgBuyPrice),
      buyDate: buy,
      buyHorizon: (h.buyHorizon ?? "MOYEN") as BuyHorizonCode,
      notes: h.notes,
    };
  });

  const trades = await listPortfolioTrades(prisma, portfolio.id, { take: 500 });
  const tradeRows = trades.map((t) => ({
    tradedAt: t.tradedAt.slice(0, 10),
    side: t.side,
    ticker: t.ticker,
    name: t.name,
    quantity: t.quantity,
    price: t.price,
    costBasis: t.costBasis,
    realizedPnl: t.realizedPnl,
    notes: t.notes,
  }));

  const buffer = buildPortfolioWorkbook(portfolio.name, rows, tradeRows);
  const fileName = buildPortfolioExportFileName(portfolio.name);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
