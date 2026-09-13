// PATCH/DELETE /api/portfolio/:portfolioId/holdings/:holdingId
// PATCH :
//   - { quantity, avgBuyPrice?, buyHorizon?, buyDate? } : correction / mise à jour de la position
//   - { quantitySold, sellPrice?, sellDate? } : vente (partielle ou totale)
//     → journalisée dans portfolio_trades avec P&L réalisé
//   - { notes } : note seule
// DELETE : retrait sans journal (préférer quantitySold pour garder l'historique).

import { NextRequest } from "next/server";
import { z } from "zod";
import { HoldingSide } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiSuccess, apiError, apiNotFound, apiValidationError } from "@/lib/api/response";
import { recordPortfolioTrade, realizedPnl, syncOpeningBuyTradeDate } from "@/lib/api/portfolio-trades";

export const dynamic = "force-dynamic";

const patchHoldingSchema = z
  .object({
    quantitySold: z.coerce.number().positive().optional(),
    sellPrice: z.coerce.number().positive("Le prix de vente doit être positif").optional(),
    sellDate: z
      .string()
      .refine((s) => !Number.isNaN(Date.parse(s)), "Date de vente invalide")
      .optional(),
    quantity: z.coerce.number().positive("La quantité doit être positive").optional(),
    avgBuyPrice: z.coerce.number().positive("Le prix moyen d'achat doit être positif").optional(),
    buyHorizon: z.enum(["COURT", "MOYEN", "LONG"]).optional(),
    buyDate: z
      .string()
      .refine((s) => !Number.isNaN(Date.parse(s)), "Date d'achat invalide")
      .optional(),
    notes: z.string().trim().max(500).optional(),
    targetPrice: z.union([z.coerce.number().positive(), z.null()]).optional(),
    stopPrice: z.union([z.coerce.number().positive(), z.null()]).optional(),
  })
  .refine((d) => !(d.quantitySold !== undefined && d.quantity !== undefined), {
    message: "Indiquez soit quantitySold (vente), soit quantity (correction), pas les deux",
    path: ["quantity"],
  });

async function loadOwnedHolding(portfolioId: string, holdingId: string, userId: string) {
  const holding = await prisma.portfolioHolding.findUnique({
    where: { id: holdingId },
    include: { portfolio: true, company: { select: { ticker: true } } },
  });
  if (!holding || holding.portfolioId !== portfolioId || holding.portfolio.userId !== userId) return null;
  return holding;
}

export async function PATCH(request: NextRequest, { params }: { params: { portfolioId: string; holdingId: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const holding = await loadOwnedHolding(params.portfolioId, params.holdingId, userId);
  if (!holding) return apiNotFound("Position");

  const body = await request.json().catch(() => null);
  const parsed = patchHoldingSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const { quantitySold, sellPrice, sellDate, quantity, avgBuyPrice, buyHorizon, buyDate, notes, targetPrice, stopPrice } =
    parsed.data;

  if (quantitySold !== undefined) {
    const currentQty = Number(holding.quantity);
    if (quantitySold > currentQty + 1e-9) {
      return apiError(`Quantité vendue (${quantitySold}) supérieure à la position (${currentQty})`, 422);
    }

    const costBasis = Number(holding.avgBuyPrice);
    const price =
      sellPrice ??
      (await prisma.priceHistory
        .findFirst({
          where: { companyId: holding.companyId, isCanonical: true },
          orderBy: { date: "desc" },
          select: { closePrice: true },
        })
        .then((r) => (r ? Number(r.closePrice) : null)));

    if (price == null || !(price > 0)) {
      return apiError("Indiquez un prix de vente (cours actuel indisponible)", 422);
    }

    const tradedAt = sellDate ? new Date(sellDate) : new Date();
    const pnl = realizedPnl(price, costBasis, quantitySold);
    const fullExit = quantitySold >= currentQty - 1e-9;

    await prisma.$transaction(async (tx) => {
      await recordPortfolioTrade(tx, {
        portfolioId: holding.portfolioId,
        companyId: holding.companyId,
        side: HoldingSide.VENTE,
        quantity: quantitySold,
        price,
        tradedAt,
        costBasis,
        notes: notes ?? holding.notes,
      });

      if (fullExit) {
        await tx.portfolioHolding.delete({ where: { id: holding.id } });
      } else {
        await tx.portfolioHolding.update({
          where: { id: holding.id },
          data: {
            quantity: currentQty - quantitySold,
            lastSide: HoldingSide.VENTE,
            notes: notes ?? holding.notes,
          },
        });
      }
    });

    return apiSuccess({
      deleted: fullExit,
      remainingQuantity: fullExit ? 0 : currentQty - quantitySold,
      trade: {
        ticker: holding.company.ticker,
        quantity: quantitySold,
        sellPrice: price,
        costBasis,
        realizedPnl: pnl,
        tradedAt: tradedAt.toISOString().slice(0, 10),
      },
    });
  }

  if (
    quantity !== undefined ||
    avgBuyPrice !== undefined ||
    buyHorizon !== undefined ||
    buyDate !== undefined ||
    targetPrice !== undefined ||
    stopPrice !== undefined
  ) {
    const resolvedBuyDate = buyDate ? new Date(buyDate) : undefined;
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.portfolioHolding.update({
        where: { id: holding.id },
        data: {
          ...(quantity !== undefined ? { quantity, lastSide: HoldingSide.ACHAT } : {}),
          ...(avgBuyPrice !== undefined ? { avgBuyPrice } : {}),
          ...(buyHorizon !== undefined ? { buyHorizon } : {}),
          ...(resolvedBuyDate !== undefined ? { buyDate: resolvedBuyDate } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(targetPrice !== undefined ? { targetPrice } : {}),
          ...(stopPrice !== undefined ? { stopPrice } : {}),
        },
      });
      if (resolvedBuyDate !== undefined) {
        await syncOpeningBuyTradeDate(tx, holding.portfolioId, holding.companyId, resolvedBuyDate);
      }
      return row;
    });
    return apiSuccess({
      deleted: false,
      holding: {
        id: updated.id,
        quantity: Number(updated.quantity),
        avgBuyPrice: Number(updated.avgBuyPrice),
        buyHorizon: updated.buyHorizon,
        buyDate: updated.buyDate?.toISOString().slice(0, 10) ?? null,
        targetPrice: updated.targetPrice != null ? Number(updated.targetPrice) : null,
        stopPrice: updated.stopPrice != null ? Number(updated.stopPrice) : null,
      },
    });
  }

  const updated = await prisma.portfolioHolding.update({
    where: { id: holding.id },
    data: {
      notes: notes ?? holding.notes,
      ...(buyHorizon !== undefined ? { buyHorizon } : {}),
    },
  });
  return apiSuccess({
    deleted: false,
    holding: {
      id: updated.id,
      quantity: Number(updated.quantity),
      avgBuyPrice: Number(updated.avgBuyPrice),
      buyHorizon: updated.buyHorizon,
    },
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: { portfolioId: string; holdingId: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const holding = await loadOwnedHolding(params.portfolioId, params.holdingId, userId);
  if (!holding) return apiNotFound("Position");

  // Retrait sans prix : journalise une vente au cours du jour (ou au PRU si N/D)
  // pour ne pas perdre l'historique des sorties.
  const currentQty = Number(holding.quantity);
  const costBasis = Number(holding.avgBuyPrice);
  const market = await prisma.priceHistory.findFirst({
    where: { companyId: holding.companyId, isCanonical: true },
    orderBy: { date: "desc" },
    select: { closePrice: true },
  });
  const price = market ? Number(market.closePrice) : costBasis;

  await prisma.$transaction(async (tx) => {
    await recordPortfolioTrade(tx, {
      portfolioId: holding.portfolioId,
      companyId: holding.companyId,
      side: HoldingSide.VENTE,
      quantity: currentQty,
      price,
      costBasis,
      notes: "Retrait de position",
    });
    await tx.portfolioHolding.delete({ where: { id: holding.id } });
  });

  return apiSuccess({
    deleted: true,
    trade: {
      ticker: holding.company.ticker,
      quantity: currentQty,
      sellPrice: price,
      costBasis,
      realizedPnl: realizedPnl(price, costBasis, currentQty),
    },
  });
}
