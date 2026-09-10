// GET /api/market/spark-series — clôtures datées pour score / aperçus marché.

import { getMarketSparkSeriesByTicker, getMarketDayChangeByTicker } from "@/lib/api/market-spark-series";
import { apiSuccess, cacheHeaders } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET() {
  const sparkSeries = await getMarketSparkSeriesByTicker();
  let dayChanges: Record<string, number | null> = {};
  try {
    dayChanges = await getMarketDayChangeByTicker();
  } catch {
    // Ne pas faire échouer les sparklines si la colonne change_percent
    // n'est pas encore visible côté client Prisma (générer/redémarrer).
    dayChanges = {};
  }
  return apiSuccess({ sparkSeries, dayChanges }, { headers: cacheHeaders(30) });
}
