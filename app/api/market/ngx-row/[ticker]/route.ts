// GET /api/market/ngx-row/:ticker — détail de la ligne dépliée de la vue d'ensemble NGX.
// Chargé seulement au dépliage, pour un seul ticker. Réservé aux comptes
// (contient score, signal, risques). Cache privé : le corps dépend de la session.

import { apiError, apiNotFound, apiSuccess, privateCacheHeaders } from "@/lib/api/response";
import { getViewer } from "@/lib/entitlements";
import { loadNgxRowDetail } from "@/lib/markets/ngx-row-detail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { ticker: string } }) {
  try {
    const viewer = await getViewer();
    if (viewer.gated) return apiError("Authentification requise", 401);
    const detail = await loadNgxRowDetail(params.ticker);
    if (!detail) return apiNotFound("Action NGX");
    return apiSuccess(detail, { headers: privateCacheHeaders() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("Échec du chargement du détail NGX", 500, message);
  }
}
