// GET /api/market/dividends — calendrier des dividendes canoniques
import { apiSuccess, cacheHeaders } from "@/lib/api/response";
import { getDividendCalendarDataset } from "@/lib/api/dividend-calendar";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getDividendCalendarDataset();
  return apiSuccess(data, {
    headers: { ...cacheHeaders(60, 120), "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
