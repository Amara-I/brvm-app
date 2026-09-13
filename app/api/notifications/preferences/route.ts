// GET/PATCH /api/notifications/preferences — préférences du compte connecté.

import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { apiError, apiSuccess, apiValidationError, privateCacheHeaders } from "@/lib/api/response";
import { isDatabaseUnavailable, isMissingDatabaseObject } from "@/lib/db/is-database-unavailable";
import { getOrCreatePrefs, updatePrefs } from "@/lib/notifications/prefs";
import { DEFAULT_PREFS } from "@/lib/notifications/types";
import { clampDailyMovePct } from "@/lib/notifications/logic";
import { isEmailConfigured } from "@/lib/notifications/email";

export const dynamic = "force-dynamic";

const hourSchema = z.number().int().min(0).max(23).nullable();

const patchSchema = z.object({
  priceEnabled: z.boolean().optional(),
  signalEnabled: z.boolean().optional(),
  portfolioEnabled: z.boolean().optional(),
  indexEnabled: z.boolean().optional(),
  systemEnabled: z.boolean().optional(),
  channelInApp: z.boolean().optional(),
  channelEmail: z.boolean().optional(),
  deliveryMode: z.enum(["REALTIME", "DIGEST"]).optional(),
  quietHoursStart: hourSchema.optional(),
  quietHoursEnd: hourSchema.optional(),
  sessionReminders: z.boolean().optional(),
  portfolioMovePct: z.coerce.number().positive().max(10).optional(),
  indexMovePct: z.coerce.number().positive().max(10).optional(),
});

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return apiError("Authentification requise", 401);

  try {
    const prefs = await getOrCreatePrefs(userId);
    return apiSuccess(
      { prefs, emailAvailable: isEmailConfigured() },
      { headers: privateCacheHeaders() }
    );
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingDatabaseObject(err)) {
      return apiSuccess({ prefs: DEFAULT_PREFS, emailAvailable: isEmailConfigured() }, { headers: privateCacheHeaders() });
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
    const prefs = await updatePrefs(userId, {
      ...parsed.data,
      portfolioMovePct:
        parsed.data.portfolioMovePct != null ? clampDailyMovePct(parsed.data.portfolioMovePct) : undefined,
      indexMovePct: parsed.data.indexMovePct != null ? clampDailyMovePct(parsed.data.indexMovePct) : undefined,
    });
    return apiSuccess({ prefs, emailAvailable: isEmailConfigured() });
  } catch (err) {
    if (isDatabaseUnavailable(err) || isMissingDatabaseObject(err)) {
      return apiError("Base de données indisponible", 503);
    }
    throw err;
  }
}
