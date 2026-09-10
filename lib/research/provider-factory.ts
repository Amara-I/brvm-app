// ═══════════════════════════════════════════════════════════════════════════
// Sélection du fournisseur de recherche — étape 10 (+ fallback DDG étape 16)
// ═══════════════════════════════════════════════════════════════════════════
// RESEARCH_AGENT_ENABLED doit être explicitement "true" pour tout appel
// réseau. Priorité :
//   1. SerpAPI si RESEARCH_SEARCH_API_KEY est renseignée
//   2. DuckDuckGo HTML (sans clé) sinon — veille best-effort
//   3. NoOp si l'agent est désactivé
// ═══════════════════════════════════════════════════════════════════════════

import type { SearchProvider } from "./types";
import { NoOpSearchProvider } from "./search-providers/no-op-provider";
import { SerpApiSearchProvider } from "./search-providers/serpapi-provider";
import { GoogleNewsRssSearchProvider } from "./search-providers/google-news-rss-provider";

export function isResearchAgentEnabled(): boolean {
  return process.env.RESEARCH_AGENT_ENABLED === "true";
}

export function getSearchProvider(): SearchProvider {
  if (!isResearchAgentEnabled()) {
    return new NoOpSearchProvider();
  }
  const apiKey = process.env.RESEARCH_SEARCH_API_KEY?.trim();
  if (apiKey) {
    return new SerpApiSearchProvider(apiKey);
  }
  // Sans clé SerpAPI : Google News RSS (DDG HTML est bloqué par challenge anti-bot).
  return new GoogleNewsRssSearchProvider();
}
