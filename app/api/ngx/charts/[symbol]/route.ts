// GET /api/ngx/charts/[symbol] — série NGX (société ou indice) pour le workbench graphique.
// Même paramètres (`range`, `from`, `to`, `interval`) et même forme que /api/charts/[ticker].
// Lecture seule : clôtures canoniques NGX en base, ajustées des opérations sur titres.

import { NextRequest } from "next/server";
import { apiSuccess, apiNotFound, apiValidationError } from "@/lib/api/response";
import { chartSeriesQuerySchema } from "@/lib/api/query-schemas";
import { loadNgxChartPayload } from "@/lib/markets/ngx-chart";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { symbol: string } }) {
  const parsed = chartSeriesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return apiValidationError(parsed.error);

  const payload = await loadNgxChartPayload(params.symbol, parsed.data);
  if (!payload) return apiNotFound(`Symbole NGX "${params.symbol.toUpperCase()}"`);

  return apiSuccess(payload, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=120, stale-while-revalidate=240" },
  });
}
