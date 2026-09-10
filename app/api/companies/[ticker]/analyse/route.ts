// GET /api/companies/:ticker/analyse — analyse complète (technique + fondamental + risque)

import { NextRequest } from "next/server";
import { apiSuccess, apiNotFound, cacheHeaders } from "@/lib/api/response";
import { getCompanySheetPayload } from "@/lib/api/company-sheet-dataset";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  const payload = await getCompanySheetPayload(ticker);
  if (!payload) return apiNotFound(`Société "${ticker}"`);

  const { metrics, health, company } = payload;

  return apiSuccess(
    {
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      country: company.country,
      signal: metrics.signal,
      score: metrics.score,
      compositeScore: metrics.compositeScore,
      confidence: metrics.confidence,
      signalSummary: metrics.signalSummary,
      signalReasons: metrics.signalReasons,
      horizons: metrics.horizonScores,
      technicalScore: metrics.technicalScore,
      fundamentalScore: metrics.fundamentalScore,
      sectorScore: metrics.sectorScore,
      risk: metrics.riskAnalysis,
      technical: metrics.technical,
      riskLevelVolatility: metrics.riskLevel,
      volatilityPercent: metrics.volatilityPercent,
      health,
      metrics: {
        perf5Percent: metrics.perf5Percent,
        perf10Percent: metrics.perf10Percent,
        dividendYieldPercent: metrics.dividendYieldPercent,
        avgDividend: metrics.avgDividend,
        currentPrice: metrics.currentPrice,
        currentDividend: metrics.currentDividend,
        historyDepth: metrics.historyDepth,
        per: company.per,
        mktcap: company.mktcap,
      },
    },
    { headers: cacheHeaders(60, 120) }
  );
}
