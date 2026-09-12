import { NextRequest } from "next/server";
import { getMarketIndexDetail } from "@/lib/api/market-indices";
import { apiNotFound, apiSuccess, apiValidationError, cacheHeaders } from "@/lib/api/response";
import { chartSeriesQuerySchema } from "@/lib/api/query-schemas";
import { applyChartSeriesWindow } from "@/lib/charts/chart-window";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  const parsedQuery = chartSeriesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsedQuery.success) return apiValidationError(parsedQuery.error);

  const detail = await getMarketIndexDetail(params.code);
  if (!detail) return apiNotFound(`Indice "${params.code.toUpperCase()}"`);

  const windowed = applyChartSeriesWindow(detail.series, parsedQuery.data);
  return apiSuccess(
    {
      ...detail,
      series: windowed.series,
      window: {
        range: windowed.range,
        from: windowed.from,
        to: windowed.to,
        points: windowed.series.length,
      },
    },
    { headers: cacheHeaders(60) }
  );
}
