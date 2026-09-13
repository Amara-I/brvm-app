// PATCH /api/notifications/:id — lu / non lu + horodatage d'ouverture (stats admin).

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiError, apiNotFound, apiSuccess, apiValidationError } from "@/lib/api/response";
import { serializeNotification } from "@/lib/notifications/serialize";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  read: z.boolean().optional(),
  opened: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const existing = await prisma.notificationEvent.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) return apiNotFound("Notification");

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  const now = new Date();
  const updated = await prisma.notificationEvent.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.read === true ? { readAt: existing.readAt ?? now } : {}),
      ...(parsed.data.read === false ? { readAt: null } : {}),
      ...(parsed.data.opened === true ? { openedAt: existing.openedAt ?? now, readAt: existing.readAt ?? now } : {}),
    },
  });

  return apiSuccess({ notification: serializeNotification(updated) });
}
