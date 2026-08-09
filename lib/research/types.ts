// ═══════════════════════════════════════════════════════════════════════════
// Types partagés — Agent de recherche IA (étape 10)
// ═══════════════════════════════════════════════════════════════════════════
// Même philosophie que `lib/ingestion/types.ts` : une interface pluggable
// (`SearchProvider`) pour pouvoir changer/désactiver le fournisseur de
// recherche sans toucher à l'orchestrateur, avec traçabilité complète.
// ═══════════════════════════════════════════════════════════════════════════

import type { ResearchCategory } from "@prisma/client";

export interface ResearchQuery {
  /// Texte de la requête envoyée au fournisseur de recherche.
  query: string;
  category: ResearchCategory;
}

export interface RawSearchResult {
  title: string;
  url: string;
  /// Extrait/résumé fourni par le moteur de recherche, si disponible.
  snippet?: string;
}

/// Fournisseur de recherche web pluggable. Une implémentation ne doit JAMAIS
/// lever d'exception pour une simple absence de résultats — retourner un
/// tableau vide est le comportement attendu dans ce cas (cf. `no-op-provider`).
export interface SearchProvider {
  /// Identifiant court, stocké dans `ResearchFinding.provider` pour traçabilité.
  readonly id: string;
  search(query: string): Promise<RawSearchResult[]>;
}
