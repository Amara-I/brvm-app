import { parseSearchCatalog } from "@/lib/search/documents";
import type { SiteSearchDocument } from "@/lib/search/types";

let inflight: Promise<SiteSearchDocument[] | null> | null = null;

/** Charge le catalogue une fois. Relance après un échec réseau. */
export function loadSiteSearchCatalogClient(): Promise<SiteSearchDocument[] | null> {
  if (!inflight) {
    inflight = fetch("/api/search/catalog", { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const documents = parseSearchCatalog(await response.json());
        if (!documents) throw new Error("catalog");
        return documents;
      })
      .catch(() => {
        inflight = null;
        return null;
      });
  }
  return inflight;
}
