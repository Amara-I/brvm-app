// GET /api/market/dividends — calendrier des dividendes canoniques
import { apiSuccess, privateCacheHeaders } from "@/lib/api/response";
import { getDividendCalendarDataset } from "@/lib/api/dividend-calendar";
import { getViewer, presentDividendCalendar } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export async function GET() {
  const [data, viewer] = await Promise.all([getDividendCalendarDataset(), getViewer()]);
  return apiSuccess(presentDividendCalendar(data, viewer), {
    headers: privateCacheHeaders(),
  });
}
