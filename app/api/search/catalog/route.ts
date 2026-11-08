import { apiSuccess, cacheHeaders } from "@/lib/api/response";
import { getSiteSearchCatalog } from "@/lib/search/catalog";

export const dynamic = "force-dynamic";

/** Catalogue complet, mis en cache. Le header filtre ensuite côté client. */
export async function GET() {
  const documents = await getSiteSearchCatalog();
  return apiSuccess({ documents }, { headers: cacheHeaders(60) });
}
