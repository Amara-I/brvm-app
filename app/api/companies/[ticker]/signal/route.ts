// GET /api/companies/:ticker/signal — signal final + horizons + composite

import { NextRequest } from "next/server";
import { apiSuccess, apiNotFound, cacheHeaders } from "@/lib/api/response";
import { getCompanySheetPayload } from "@/lib/api/company-sheet-dataset";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  const payload = await getCompanySheetPayload(ticker);
  if (!payload) return apiNotFound(`Société "${ticker}"`);

  const horizon = (request.nextUrl.searchParams.get("horizon") ?? "all").toLowerCase();
  const { metrics, company } = payload;

  const horizonValue =
    horizon === "court"
      ? metrics.horizonScores.court
      : horizon === "moyen"
        ? metrics.horizonScores.moyen
        : horizon === "long"
          ? metrics.horizonScores.long
          : null;

  return apiSuccess(
    {
      ticker: company.ticker,
      signal: metrics.signal,
      score: metrics.score,
      compositeScore: metrics.compositeScore,
      confidence: metrics.confidence,
      signalSummary: metrics.signalSummary,
      signalReasons: metrics.signalReasons,
      horizons: metrics.horizonScores,
      selectedHorizon: horizon === "all" ? "all" : horizon,
      selectedHorizonScore: horizonValue,
      technicalScore: metrics.technicalScore,
      fundamentalScore: metrics.fundamentalScore,
      sectorScore: metrics.sectorScore,
      riskScore: metrics.riskAnalysis.riskScore,
      riskTier: metrics.riskAnalysis.riskTier,
    },
    { headers: cacheHeaders(60, 120) }
  );
}
