// ═══════════════════════════════════════════════════════════════════════════
// PATCH/DELETE /api/portfolio/:portfolioId/holdings/:holdingId — étape 7
// ═══════════════════════════════════════════════════════════════════════════
// PATCH  { quantitySold } : allègement partiel d'une position (vente d'une
//        partie des actions). Si `quantitySold >= quantité détenue`, la
//        ligne est purement et simplement supprimée plutôt que de passer en
//        dessous de 0 (cf. commentaire du modèle Prisma `PortfolioHolding`).
//        PATCH { notes } seul : mise à jour d'une note sans toucher à la
//        quantité.
// DELETE : retrait total de la position (vente complète).
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { z } from "zod";
import { HoldingSide } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiSuccess, apiError, apiNotFound, apiValidationError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const patchHoldingSchema = z.object({
  quantitySold: z.coerce.number().positive().optional(),
  notes: z.string().trim().max(500).optional(),
});

async function loadOwnedHolding(portfolioId: string, holdingId: string, userId: string) {
  const holding = await prisma.portfolioHolding.findUnique({
    where: { id: holdingId },
    include: { portfolio: true },
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

  if (parsed.data.quantitySold !== undefined) {
    const currentQty = Number(holding.quantity);
    if (parsed.data.quantitySold >= currentQty) {
      await prisma.portfolioHolding.delete({ where: { id: holding.id } });
      return apiSuccess({ deleted: true, remainingQuantity: 0 });
    }
    const updated = await prisma.portfolioHolding.update({
      where: { id: holding.id },
      data: {
        quantity: currentQty - parsed.data.quantitySold,
        lastSide: HoldingSide.VENTE,
        notes: parsed.data.notes ?? holding.notes,
      },
    });
    return apiSuccess({ deleted: false, remainingQuantity: Number(updated.quantity) });
  }

  const updated = await prisma.portfolioHolding.update({
    where: { id: holding.id },
    data: { notes: parsed.data.notes ?? holding.notes },
  });
  return apiSuccess({ deleted: false, remainingQuantity: Number(updated.quantity) });
}

export async function DELETE(_request: NextRequest, { params }: { params: { portfolioId: string; holdingId: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const holding = await loadOwnedHolding(params.portfolioId, params.holdingId, userId);
  if (!holding) return apiNotFound("Position");

  await prisma.portfolioHolding.delete({ where: { id: holding.id } });
  return apiSuccess({ deleted: true });
}
