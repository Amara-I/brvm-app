// DELETE /api/portfolio/:portfolioId — suppression d'un portefeuille (et cascades).

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiError, apiNotFound, apiSuccess } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { portfolioId: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const portfolio = await prisma.portfolio.findUnique({ where: { id: params.portfolioId } });
  if (!portfolio || portfolio.userId !== userId) return apiNotFound("Portefeuille");

  await prisma.portfolio.delete({ where: { id: portfolio.id } });
  return apiSuccess({ deletedId: portfolio.id, name: portfolio.name });
}
