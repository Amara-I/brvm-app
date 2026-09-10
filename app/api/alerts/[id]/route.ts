// DELETE /api/alerts/[id] — supprimer une alerte (propriétaire uniquement).
// PATCH — réactiver (ACTIVE) ou désactiver.

import { NextRequest } from "next/server";
import { z } from "zod";
import { PriceAlertStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiSuccess, apiError, apiNotFound, apiValidationError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["ACTIVE", "DISABLED"]),
});

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const existing = await prisma.priceAlert.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) return apiNotFound("Alerte");

  await prisma.priceAlert.delete({ where: { id: params.id } });
  return apiSuccess({ id: params.id, deleted: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const existing = await prisma.priceAlert.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) return apiNotFound("Alerte");

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  const updated = await prisma.priceAlert.update({
    where: { id: params.id },
    data: {
      status: parsed.data.status as PriceAlertStatus,
      ...(parsed.data.status === "ACTIVE"
        ? { triggeredAt: null, triggerPrice: null }
        : {}),
    },
  });

  return apiSuccess({
    id: updated.id,
    status: updated.status,
  });
}
