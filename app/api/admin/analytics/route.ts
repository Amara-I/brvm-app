// GET /api/admin/analytics?days=7|30 — agrégats d'usage (admin uniquement).
// Jamais de cache partagé (données internes produit).

import { NextRequest } from "next/server";
import { getAnalyticsSummary } from "@/lib/analytics/summary";
import { parseAnalyticsDays } from "@/lib/analytics/aggregate";
import { apiError, apiSuccess, privateCacheHeaders } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return apiError(admin.status === 401 ? "Authentification requise" : "Accès administrateur requis", admin.status);
  }

  const days = parseAnalyticsDays(request.nextUrl.searchParams.get("days"));

  try {
    const data = await getAnalyticsSummary(days);
    return apiSuccess(data, { headers: privateCacheHeaders() });
  } catch (err) {
    if (isDatabaseUnavailable(err)) {
      return apiError("Base de données indisponible", 503);
    }
    throw err;
  }
}
