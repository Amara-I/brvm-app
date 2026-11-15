// GET /api/market/ngx-row/:ticker — détail de la ligne dépliée de la vue d'ensemble NGX.
// Chargé seulement au dépliage, pour un seul ticker ; réponse de quelques ko, servie depuis le
// cache serveur NGX (10 min, invalidé après chaque ingestion) puis par le CDN 1 min (données publiques).

import { apiError, apiNotFound, apiSuccess, cacheHeaders } from "@/lib/api/response";
import { loadNgxRowDetail } from "@/lib/markets/ngx-row-detail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { ticker: string } }) {
  try {
    const detail = await loadNgxRowDetail(params.ticker);
    if (!detail) return apiNotFound("Action NGX");
    return apiSuccess(detail, { headers: cacheHeaders(60, 240) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError("Échec du chargement du détail NGX", 500, message);
  }
}
