// ═══════════════════════════════════════════════════════════════════════════
// Requêtes de veille par défaut — étape 10
// ═══════════════════════════════════════════════════════════════════════════
// Modifiable librement sans toucher à l'orchestrateur (`run-research-agent.ts`).
// Couvre les 4 catégories demandées par l'utilisateur : UX, contenu/actualités,
// idées de fonctionnalités, veille concurrentielle.
// ═══════════════════════════════════════════════════════════════════════════

import { ResearchCategory } from "@prisma/client";
import type { ResearchQuery } from "./types";

export const DEFAULT_RESEARCH_QUERIES: ResearchQuery[] = [
  { query: "meilleures pratiques UX design application fintech mobile 2026", category: ResearchCategory.UX },
  { query: "accessibilité web mobile bonnes pratiques dashboard financier", category: ResearchCategory.UX },
  { query: "actualités BRVM Bourse Régionale des Valeurs Mobilières", category: ResearchCategory.CONTENU },
  { query: "nouvelles fonctionnalités site ouestbourse.com", category: ResearchCategory.CONCURRENCE },
  { query: "sikafinance.com nouvelles fonctionnalités marché boursier", category: ResearchCategory.CONCURRENCE },
  { query: "richbourse.com fonctionnalités analyse boursière", category: ResearchCategory.CONCURRENCE },
  { query: "fonctionnalités attendues application suivi portefeuille boursier Afrique", category: ResearchCategory.FONCTIONNALITE },
];
