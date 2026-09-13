// PATCH/DELETE /api/alert-rules/:id — propriétaire uniquement.

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiError, apiNotFound, apiSuccess, apiValidationError } from "@/lib/api/response";
import { serializeAlertRule } from "@/lib/notifications/serialize";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
});

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const existing = await prisma.alertRule.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) return apiNotFound("Règle");

  await prisma.alertRule.delete({ where: { id: params.id } });
  return apiSuccess({ id: params.id, deleted: true });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const existing = await prisma.alertRule.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) return apiNotFound("Règle");

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  const updated = await prisma.alertRule.update({
    where: { id: existing.id },
    data: { enabled: parsed.data.enabled ?? existing.enabled },
  });
  return apiSuccess({ rule: serializeAlertRule(updated) });
}
