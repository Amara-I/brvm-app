// GET /api/ngx/charts/[symbol] — série NGX (société ou indice) pour le workbench graphique.
// Même paramètres (`range`, `from`, `to`, `interval`) et même forme que /api/charts/[ticker].
// Lecture seule : clôtures canoniques NGX en base, ajustées des opérations sur titres.

import { NextRequest } from "next/server";
import { apiSuccess, apiNotFound, apiValidationError, privateCacheHeaders } from "@/lib/api/response";
import { chartSeriesQuerySchema } from "@/lib/api/query-schemas";
import { capChartQueryForVisitor, getViewer, redactChartPayloadForVisitor } from "@/lib/entitlements";
import { loadNgxChartPayload } from "@/lib/markets/ngx-chart";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { symbol: string } }) {
  const parsed = chartSeriesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return apiValidationError(parsed.error);

  const viewer = await getViewer();
  const capped = viewer.gated ? capChartQueryForVisitor(parsed.data) : { ...parsed.data, capped: false };
  const query = { range: capped.range, from: capped.from, to: capped.to, interval: capped.interval ?? parsed.data.interval };

  const built = await loadNgxChartPayload(params.symbol, query);
  if (!built) return apiNotFound(`Symbole NGX "${params.symbol.toUpperCase()}"`);
  const payload = viewer.gated ? redactChartPayloadForVisitor(built as unknown as Record<string, unknown>) : built;

  return apiSuccess(payload, { headers: privateCacheHeaders() });
}
