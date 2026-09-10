// GET /api/companies/:ticker/indicators — indicateurs techniques (RSI, MACD, SMA…)

import { NextRequest } from "next/server";
import { apiSuccess, apiNotFound, cacheHeaders } from "@/lib/api/response";
import { getCompanySheetPayload } from "@/lib/api/company-sheet-dataset";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  const payload = await getCompanySheetPayload(ticker);
  if (!payload) return apiNotFound(`Société "${ticker}"`);

  const { metrics, company, series } = payload;
  return apiSuccess(
    {
      ticker: company.ticker,
      seriesPoints: series.length,
      indicators: metrics.technical,
      note: metrics.technical.available
        ? "Indicateurs calculés sur la série de clôtures disponible (canonique / densifiée)."
        : "Indicateurs N/D — historique trop court pour RSI/MACD/SMA significatifs.",
    },
    { headers: cacheHeaders(60, 120) }
  );
}
