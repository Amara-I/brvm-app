import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, apiValidationError, cacheHeaders } from "@/lib/api/response";
import { getSiteSearchCatalog } from "@/lib/search/catalog";
import { searchSite } from "@/lib/search/match";

export const dynamic = "force-dynamic";

const query = z.object({
  q: z.string().trim().max(120).default(""),
  exchange: z
    .string()
    .trim()
    .regex(/^[A-Za-z][A-Za-z0-9_-]{1,15}$/)
    .optional(),
});

export async function GET(request: NextRequest) {
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return apiValidationError(parsed.error);
  const documents = await getSiteSearchCatalog();
  const groups = searchSite(documents, parsed.data.q, { exchange: parsed.data.exchange });
  return apiSuccess({ groups }, { headers: cacheHeaders(60) });
}
