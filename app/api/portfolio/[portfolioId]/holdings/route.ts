// POST /api/portfolio/:portfolioId/holdings — Ajout / renforcement d'une position.
// Chaque achat est aussi journalisé dans portfolio_trades (historique).

import { NextRequest } from "next/server";
import { z } from "zod";
import { HoldingSide } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiSuccess, apiError, apiNotFound, apiValidationError } from "@/lib/api/response";
import { recordPortfolioTrade } from "@/lib/api/portfolio-trades";

export const dynamic = "force-dynamic";

const addHoldingSchema = z.object({
  ticker: z
    .string()
    .trim()
    .min(1)
    .transform((s) => s.toUpperCase()),
  quantity: z.coerce.number().positive("La quantité doit être positive"),
  avgBuyPrice: z.coerce.number().positive("Le prix d'achat doit être positif"),
  buyDate: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), "Date d'achat invalide")
    .optional(),
  buyHorizon: z.enum(["COURT", "MOYEN", "LONG"]).optional(),
  notes: z.string().trim().max(500).optional(),
});

function serializeHolding(holding: { id: string; quantity: unknown; avgBuyPrice: unknown }, ticker: string) {
  return { id: holding.id, ticker, quantity: Number(holding.quantity), avgBuyPrice: Number(holding.avgBuyPrice) };
}

export async function POST(request: NextRequest, { params }: { params: { portfolioId: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const portfolio = await prisma.portfolio.findUnique({ where: { id: params.portfolioId } });
  if (!portfolio || portfolio.userId !== userId) return apiNotFound("Portefeuille");

  const body = await request.json().catch(() => null);
  const parsed = addHoldingSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);
  const { ticker, quantity, avgBuyPrice, buyDate, buyHorizon, notes } = parsed.data;

  const company = await prisma.company.findUnique({ where: { ticker } });
  if (!company) return apiNotFound(`Société "${ticker}"`);

  const existing = await prisma.portfolioHolding.findUnique({
    where: { uniq_holding_portfolio_company: { portfolioId: portfolio.id, companyId: company.id } },
  });

  const resolvedBuyDate = buyDate ? new Date(buyDate) : new Date();
  const resolvedHorizon = buyHorizon ?? "MOYEN";

  if (existing) {
    const existingQty = Number(existing.quantity);
    const existingAvg = Number(existing.avgBuyPrice);
    const newQty = existingQty + quantity;
    const newAvg = (existingQty * existingAvg + quantity * avgBuyPrice) / newQty;
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.portfolioHolding.update({
        where: { id: existing.id },
        data: {
          quantity: newQty,
          avgBuyPrice: newAvg,
          lastSide: HoldingSide.ACHAT,
          buyHorizon: resolvedHorizon,
          notes: notes ?? existing.notes,
        },
      });
      await recordPortfolioTrade(tx, {
        portfolioId: portfolio.id,
        companyId: company.id,
        side: HoldingSide.ACHAT,
        quantity,
        price: avgBuyPrice,
        tradedAt: resolvedBuyDate,
        notes,
      });
      return row;
    });
    return apiSuccess({ holding: serializeHolding(updated, ticker) });
  }

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.portfolioHolding.create({
      data: {
        portfolioId: portfolio.id,
        companyId: company.id,
        quantity,
        avgBuyPrice,
        lastSide: HoldingSide.ACHAT,
        buyDate: resolvedBuyDate,
        buyHorizon: resolvedHorizon,
        notes,
      },
    });
    await recordPortfolioTrade(tx, {
      portfolioId: portfolio.id,
      companyId: company.id,
      side: HoldingSide.ACHAT,
      quantity,
      price: avgBuyPrice,
      tradedAt: resolvedBuyDate,
      notes,
    });
    return row;
  });
  return apiSuccess({ holding: serializeHolding(created, ticker) }, { status: 201 });
}
