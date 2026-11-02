import { NextRequest } from "next/server";
import { z } from "zod";
import { getListingSearchIndex } from "@/lib/api/listing-search-index";
import { searchListings, companyHref } from "@/lib/markets/search";
import { apiSuccess, apiValidationError, cacheHeaders } from "@/lib/api/response";

export const dynamic = "force-dynamic";
const query = z.object({ q: z.string().trim().max(120).default(""), exchange: z.enum(["BRVM", "NGX"]).optional() });
export async function GET(request: NextRequest) {
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return apiValidationError(parsed.error);
  const groups = searchListings(await getListingSearchIndex(), parsed.data.q, parsed.data.exchange)
    .map((group) => ({ ...group, items: group.items.map((item) => ({ ...item, href: companyHref(item) })) }));
  return apiSuccess({ groups }, { headers: cacheHeaders(60) });
}
