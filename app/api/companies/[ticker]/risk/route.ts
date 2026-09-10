// GET /api/companies/:ticker/risk — analyse de risque détaillée

import { NextRequest } from "next/server";
import { apiSuccess, apiNotFound, cacheHeaders } from "@/lib/api/response";
import { getCompanySheetPayload } from "@/lib/api/company-sheet-dataset";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  const payload = await getCompanySheetPayload(ticker);
  if (!payload) return apiNotFound(`Société "${ticker}"`);

  const { metrics, company } = payload;
  return apiSuccess(
    {
      ticker: company.ticker,
      risk: metrics.riskAnalysis,
      riskLevelVolatility: metrics.riskLevel,
      volatilityPercent: metrics.volatilityPercent,
    },
    { headers: cacheHeaders(60, 120) }
  );
}
