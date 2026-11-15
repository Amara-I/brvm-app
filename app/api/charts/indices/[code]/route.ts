// GET /api/charts/indices/[code] — série d'un indice (BRVM ou NGX) pour le workbench /graphes.
// Même paramètres (`range`, `from`, `to`, `interval`) et même forme que /api/charts/[ticker].
// Lecture seule : série déjà sous-échantillonnée et mise en cache 1 h (`index-sheet-v1`,
// étiquette `market-indices`). Pas de take/distinct Prisma imbriqué.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiNotFound, apiValidationError, apiError } from "@/lib/api/response";
import { chartSeriesQuerySchema } from "@/lib/api/query-schemas";
import { buildIndexChartPayload } from "@/lib/charts/index-chart-payload";
import { loadIndexSheetBundle } from "@/lib/markets/index-sheet";
import { normalizeInstrumentSymbol } from "@/lib/charts/chart-selection";
import { isDatabaseUnavailable } from "@/lib/db/is-database-unavailable";

export const dynamic = "force-dynamic";

function parseExchange(raw: string | null): "BRVM" | "NGX" | null {
  const value = raw?.trim().toUpperCase();
  if (value === "BRVM" || value === "NGX") return value;
  return null;
}

export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  const parsed = chartSeriesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return apiValidationError(parsed.error);

  const code = normalizeInstrumentSymbol(params.code);
  if (!code) return apiError("Code d'indice manquant", 422);

  let exchange = parseExchange(request.nextUrl.searchParams.get("exchange"));
  if (!exchange) {
    try {
      const row = await prisma.marketIndex.findUnique({
        where: { code },
        select: { exchange: true },
      });
      if (!row || (row.exchange !== "BRVM" && row.exchange !== "NGX")) {
        return apiNotFound(`Indice "${code}"`);
      }
      exchange = row.exchange;
    } catch (err) {
      if (isDatabaseUnavailable(err)) return apiNotFound(`Indice "${code}"`);
      throw err;
    }
  }

  const bundle = await loadIndexSheetBundle(code, exchange);
  if (!bundle) return apiNotFound(`Indice "${code}"`);

  const payload = buildIndexChartPayload(
    {
      code: bundle.code,
      name: bundle.name,
      exchange: bundle.exchange,
      series: bundle.series,
      source: bundle.lastSource,
      storedHistoryPoints: bundle.historyPoints,
      firstDate: bundle.firstDate,
      lastChangePercent: bundle.lastChangePercent,
    },
    parsed.data
  );

  return apiSuccess(payload, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=120, stale-while-revalidate=240" },
  });
}
