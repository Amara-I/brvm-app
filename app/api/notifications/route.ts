// GET /api/notifications — historique in-app (compte connecté).
// PATCH — marquer tout lu / tout non lu.

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiError, apiSuccess, apiValidationError, privateCacheHeaders } from "@/lib/api/response";
import { isDatabaseUnavailable, isMissingDatabaseObject } from "@/lib/db/is-database-unavailable";
import { isFilterType, serializeNotification } from "@/lib/notifications/serialize";
import { collapseDuplicateNotifications } from "@/lib/notifications/dedupe";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  markAll: z.enum(["read", "unread"]),
});

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const typeRaw = request.nextUrl.searchParams.get("type")?.toUpperCase() ?? null;
  const unreadOnly = request.nextUrl.searchParams.get("unread") === "1";
  const take = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("take") ?? 50) || 50));

  try {
    const where = {
      userId,
      ...(typeRaw && isFilterType(typeRaw) ? { type: typeRaw } : {}),
      ...(unreadOnly ? { readAt: null } : {}),
    };

    // Doublons déjà en base (même information notifiée plusieurs fois) :
    // regroupés à l'affichage. On lit un peu plus large pour remplir `take`.
    const [events, unreadGroups] = await Promise.all([
      prisma.notificationEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(300, take * 3),
      }),
      prisma.notificationEvent.groupBy({
        by: ["type", "ticker", "indexCode", "title", "body"],
        where: { userId, readAt: null },
      }),
    ]);
    const collapsed = collapseDuplicateNotifications(events).slice(0, take);

    return apiSuccess(
      {
        notifications: collapsed.map((ev) => ({ ...serializeNotification(ev), duplicateCount: ev.duplicateCount })),
        unreadCount: unreadGroups.length,
      },
      { headers: privateCacheHeaders() }
    );
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingDatabaseObject(err)) {
      return apiSuccess({ notifications: [], unreadCount: 0 }, { headers: privateCacheHeaders() });
    }
    throw err;
  }
}

export async function PATCH(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    if (parsed.data.markAll === "read") {
      const res = await prisma.notificationEvent.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      });
      return apiSuccess({ updated: res.count, unreadCount: 0 });
    }
    const res = await prisma.notificationEvent.updateMany({
      where: { userId, readAt: { not: null } },
      data: { readAt: null, openedAt: null },
    });
    const unreadCount = (
      await prisma.notificationEvent.groupBy({
        by: ["type", "ticker", "indexCode", "title", "body"],
        where: { userId, readAt: null },
      })
    ).length;
    return apiSuccess({ updated: res.count, unreadCount });
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingDatabaseObject(err)) {
      return apiError("Base de données indisponible", 503);
    }
    throw err;
  }
}
