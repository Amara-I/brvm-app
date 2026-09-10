// POST /api/market/refresh-dividends — calendrier BRVM + dates Sikafinance
import { NextRequest } from "next/server";
import { getDividendCalendarDataset } from "@/lib/api/dividend-calendar";
import { revalidateDividendCalendarCache } from "@/lib/api/revalidate-market-cache";
import { apiError, apiSuccess, privateCacheHeaders } from "@/lib/api/response";
import { runDividendsRefresh } from "@/lib/ingestion/run-dividends-refresh";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const COOLDOWN_MS = 15 * 60_000;
const COOLDOWN_LIMIT = 1;

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const cooldown = checkRateLimit(`refresh-dividends:${ip}`, {
    limit: COOLDOWN_LIMIT,
    windowMs: COOLDOWN_MS,
  });

  try {
    if (!cooldown.allowed) {
      revalidateDividendCalendarCache();
      const calendar = await getDividendCalendarDataset();
      return apiSuccess(
        {
          calendar,
          ingestion: {
            skipped: true,
            skipReason:
              "Actualisation récente — calendrier rechargé depuis la base (prochain tirage BRVM dans quelques minutes).",
          },
        },
        { headers: privateCacheHeaders() }
      );
    }

    const ingestion = await runDividendsRefresh(prisma, { skipSikafinance: true });
    revalidateDividendCalendarCache();
    const calendar = await getDividendCalendarDataset();

    return apiSuccess(
      {
        calendar,
        ingestion: {
          skipped: false,
          brvm: ingestion.brvm,
          sikaUpcoming: ingestion.sikaUpcoming,
          datesSynced: ingestion.datesSynced,
        },
      },
      { headers: privateCacheHeaders() }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      revalidateDividendCalendarCache();
      const calendar = await getDividendCalendarDataset();
      return apiSuccess(
        {
          calendar,
          ingestion: { skipped: false, errors: [message] },
        },
        { headers: privateCacheHeaders() }
      );
    } catch {
      return apiError("Échec de l'actualisation du calendrier dividendes", 500, message);
    }
  }
}
