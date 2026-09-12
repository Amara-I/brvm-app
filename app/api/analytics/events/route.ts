// POST /api/analytics/events — journalisation première partie (clics / pages).
// Public (visiteurs anonymes inclus). userId pris UNIQUEMENT de la session
// NextAuth, jamais du body. Désactivable via ANALYTICS_TRACKING_ENABLED=false.

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, apiValidationError } from "@/lib/api/response";
import { isAnalyticsTrackingEnabled } from "@/lib/analytics/config";
import { persistAnalyticsEvents } from "@/lib/analytics/persist";
import { sanitizeAnalyticsBatch } from "@/lib/analytics/sanitize";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  events: z.array(z.unknown()).max(20),
});

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return "unknown";
}

export async function POST(request: NextRequest) {
  if (!isAnalyticsTrackingEnabled()) {
    return apiSuccess({ accepted: 0, disabled: true });
  }

  const limited = checkRateLimit(`analytics:${clientIp(request)}`, { limit: 30, windowMs: 60_000 });
  if (!limited.allowed) {
    return apiError("Trop de requêtes. Veuillez réessayer dans quelques instants.", 429);
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);

  const events = sanitizeAnalyticsBatch(parsed.data.events);
  if (events.length === 0) return apiSuccess({ accepted: 0 });

  const userId = await getCurrentUserId().catch(() => null);

  try {
    const accepted = await persistAnalyticsEvents(events, userId);
    return apiSuccess({ accepted }, { status: 201 });
  } catch (err) {
    if (isDatabaseUnavailable(err)) {
      return apiError("Base de données indisponible", 503);
    }
    throw err;
  }
}
