// GET /api/market/ngx-board — Recharge la vue d'ensemble NGX depuis la base
// (sans nouvel appel au doclib officiel). Utilisé par le polling client,
// comme /api/companies/full + /api/market/spark-series sur la BRVM.

import { apiError, apiSuccess, privateCacheHeaders } from "@/lib/api/response";
import { getI18n } from "@/lib/i18n/get-i18n";
import { loadNgxOverviewBoard } from "@/lib/markets/load-ngx-overview-board";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { t } = getI18n();
    const board = await loadNgxOverviewBoard(t);
    return apiSuccess(board, { headers: privateCacheHeaders() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("Échec du chargement de la vue d'ensemble NGX", 500, message);
  }
}
