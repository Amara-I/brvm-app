// DELETE /api/charts/analyses/[id]

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiSuccess, apiError, apiNotFound, privateCacheHeaders } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const existing = await prisma.chartAnalysis.findUnique({ where: { id: context.params.id } });
  if (!existing || existing.userId !== userId) return apiNotFound("Analyse");

  await prisma.chartAnalysis.delete({ where: { id: existing.id } });
  return apiSuccess({ deleted: true }, { headers: privateCacheHeaders() });
}
