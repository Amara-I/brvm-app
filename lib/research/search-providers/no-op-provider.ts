// ═══════════════════════════════════════════════════════════════════════════
// Fournisseur de recherche par défaut — aucune clé API requise
// ═══════════════════════════════════════════════════════════════════════════
// Utilisé tant qu'aucune clé `RESEARCH_SEARCH_API_KEY` n'est configurée (cf.
// `lib/research/provider-factory.ts`). Ne fait AUCUN appel réseau et retourne
// toujours une liste vide : évite tout comportement surprenant (spam d'un
// provider tiers, erreurs réseau bloquant le cron) avant qu'une vraie clé de
// recherche ne soit branchée — même philosophie de transparence que les
// connecteurs d'ingestion financière au démarrage du projet (cf. AGENTS.md).
// ═══════════════════════════════════════════════════════════════════════════

import type { RawSearchResult, SearchProvider } from "../types";

export class NoOpSearchProvider implements SearchProvider {
  readonly id = "no-op";

  async search(_query: string): Promise<RawSearchResult[]> {
    return [];
  }
}
