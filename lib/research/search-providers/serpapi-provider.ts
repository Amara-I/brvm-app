// ═══════════════════════════════════════════════════════════════════════════
// Fournisseur de recherche — SerpAPI (Google Search), étape 10
// ═══════════════════════════════════════════════════════════════════════════
// Implémentation réelle, prête à l'emploi dès qu'une clé
// `RESEARCH_SEARCH_API_KEY` est configurée (cf. .env.example et
// `lib/research/provider-factory.ts`).
//
// ⚠️ Transparence (même principe que les connecteurs Sikafinance/Richbourse
// au démarrage du projet) : cette implémentation n'a PAS pu être testée en
// conditions réelles dans cet environnement, faute de clé API disponible.
// Le format de requête/réponse suit la documentation publique de SerpAPI
// (https://serpapi.com/search-api) au moment de l'écriture — à revalider
// avec un vrai compte avant la première exécution en production.
// ═══════════════════════════════════════════════════════════════════════════

import type { RawSearchResult, SearchProvider } from "../types";

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

interface SerpApiOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
}

interface SerpApiResponse {
  organic_results?: SerpApiOrganicResult[];
  error?: string;
}

export class SerpApiSearchProvider implements SearchProvider {
  readonly id = "serpapi";

  constructor(private readonly apiKey: string) {}

  async search(query: string): Promise<RawSearchResult[]> {
    const url = new URL(SERPAPI_ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("hl", "fr");
    url.searchParams.set("num", "10");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": process.env.INGESTION_USER_AGENT ?? "BRVMAppResearchBot/1.0" },
    });

    if (!res.ok) {
      throw new Error(`SerpAPI a répondu ${res.status} pour la requête "${query}"`);
    }

    const json = (await res.json()) as SerpApiResponse;
    if (json.error) {
      throw new Error(`SerpAPI: ${json.error}`);
    }

    return (json.organic_results ?? [])
      .filter((r): r is SerpApiOrganicResult & { title: string; link: string } => Boolean(r.title && r.link))
      .map((r) => ({ title: r.title, url: r.link, snippet: r.snippet }));
  }
}
