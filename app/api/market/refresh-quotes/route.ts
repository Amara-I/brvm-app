// ═══════════════════════════════════════════════════════════════════════════
// POST /api/market/refresh-quotes — Tire les cours du jour depuis BRVM.org
// ═══════════════════════════════════════════════════════════════════════════
// Branché sur le bouton « ⟳ Actualiser les données » du dashboard. Limité à
// 1 appel / 10 min / IP (en plus du rate limit générique middleware) pour
// rester respectueux de brvm.org. En cas de cooldown, on renvoie quand même
// le jeu de données actuel en base (sans nouvel appel réseau).
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { getCompaniesFullDataset } from "@/lib/api/companies-full-dataset";
import { getMarketSparkSeriesByTicker, getMarketDayChangeByTicker } from "@/lib/api/market-spark-series";
import { revalidateMarketDataCache } from "@/lib/api/revalidate-market-cache";
import { apiError, apiSuccess, privateCacheHeaders } from "@/lib/api/response";
import { runBrvmQuotesRefresh } from "@/lib/ingestion/run-brvm-quotes-refresh";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const COOLDOWN_MS = 10 * 60_000;
const COOLDOWN_LIMIT = 1;

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function datasetAndSpark() {
  const [dataset, sparkSeries, dayChanges] = await Promise.all([
    getCompaniesFullDataset(),
    getMarketSparkSeriesByTicker(),
    getMarketDayChangeByTicker(),
  ]);
  return { dataset, sparkSeries, dayChanges };
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const cooldown = checkRateLimit(`refresh-quotes:${ip}`, {
    limit: COOLDOWN_LIMIT,
    windowMs: COOLDOWN_MS,
  });

  try {
    if (!cooldown.allowed) {
      revalidateMarketDataCache();
      const { dataset, sparkSeries, dayChanges } = await datasetAndSpark();
      return apiSuccess(
        {
          dataset,
          sparkSeries,
          dayChanges,
          ingestion: {
            skipped: true,
            skipReason:
              "Actualisation récente — données rechargées depuis la base (prochain tirage BRVM dans quelques minutes).",
            quotesFetched: 0,
            fundamentalsFetched: 0,
            reconciledPricesCount: 0,
            unknownTickers: [] as string[],
            errors: [] as string[],
            durationMs: 0,
          },
        },
        { headers: privateCacheHeaders() }
      );
    }

    const ingestion = await runBrvmQuotesRefresh();
    if (!ingestion.skipped && ingestion.reconciledPricesCount > 0) {
      revalidateMarketDataCache();
    }
    const { dataset, sparkSeries, dayChanges } = await datasetAndSpark();
    return apiSuccess({ dataset, sparkSeries, dayChanges, ingestion }, { headers: privateCacheHeaders() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      revalidateMarketDataCache();
      const { dataset, sparkSeries, dayChanges } = await datasetAndSpark();
      return apiSuccess(
        {
          dataset,
          sparkSeries,
          dayChanges,
          ingestion: {
            skipped: false,
            quotesFetched: 0,
            fundamentalsFetched: 0,
            reconciledPricesCount: 0,
            unknownTickers: [] as string[],
            errors: [message],
            durationMs: 0,
          },
        },
        { headers: privateCacheHeaders() }
      );
    } catch {
      return apiError("Échec de l'actualisation des cours", 500, message);
    }
  }
}
