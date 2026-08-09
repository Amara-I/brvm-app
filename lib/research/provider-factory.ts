// ═══════════════════════════════════════════════════════════════════════════
// Sélection du fournisseur de recherche — étape 10
// ═══════════════════════════════════════════════════════════════════════════
// Feature-flaggé comme les connecteurs d'ingestion (`lib/ingestion/connector-config.ts`) :
// `RESEARCH_AGENT_ENABLED` doit être explicitement `"true"` ET une clé
// `RESEARCH_SEARCH_API_KEY` doit être configurée pour qu'un vrai appel réseau
// soit effectué. Par défaut, retombe sur `NoOpSearchProvider` (aucun appel
// réseau, comportement sûr par défaut).
// ═══════════════════════════════════════════════════════════════════════════

import type { SearchProvider } from "./types";
import { NoOpSearchProvider } from "./search-providers/no-op-provider";
import { SerpApiSearchProvider } from "./search-providers/serpapi-provider";

export function isResearchAgentEnabled(): boolean {
  return process.env.RESEARCH_AGENT_ENABLED === "true";
}

export function getSearchProvider(): SearchProvider {
  const apiKey = process.env.RESEARCH_SEARCH_API_KEY;
  if (isResearchAgentEnabled() && apiKey) {
    return new SerpApiSearchProvider(apiKey);
  }
  return new NoOpSearchProvider();
}
