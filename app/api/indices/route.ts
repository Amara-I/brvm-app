import { getMarketIndexList } from "@/lib/api/market-indices";
import { apiSuccess, cacheHeaders } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await getMarketIndexList();
  return apiSuccess({ items, asOf: new Date().toISOString() }, { headers: cacheHeaders(30) });
}
