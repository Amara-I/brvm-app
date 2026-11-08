import { NextRequest } from "next/server";
import { runNgxDailyIngest } from "@/lib/ingestion/run-ngx-ingest";
import { revalidateMarketDataCache } from "@/lib/api/revalidate-market-cache";
import { apiError, apiSuccess, privateCacheHeaders } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  const cooldown = checkRateLimit(`refresh-ngx:${clientIp(request)}`, { limit: 1, windowMs: 10 * 60_000 });

  try {
    if (!cooldown.allowed) {
      return apiSuccess({ skipped: true, reason: "Actualisation NGX récente — données rechargées depuis la base." }, { headers: privateCacheHeaders() });
    }

    const ingestion = await runNgxDailyIngest({ budgetMs: 240_000 });
    if (ingestion.quotes > 0 || ingestion.indices > 0 || ingestion.fxStored) revalidateMarketDataCache();
    return apiSuccess({ skipped: false, ingestion }, { headers: privateCacheHeaders() });
  } catch (err) {
    return apiError("Échec de l'actualisation NGX", 500, err instanceof Error ? err.message : String(err));
  }
}
