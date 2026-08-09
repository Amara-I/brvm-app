// ═══════════════════════════════════════════════════════════════════════════
// Orchestrateur de l'agent de recherche IA — étape 10
// ═══════════════════════════════════════════════════════════════════════════
// Même philosophie de résilience que `lib/ingestion/run-full-ingestion.ts` :
// chaque requête tourne dans son propre try/catch (l'échec d'une requête
// n'empêche jamais les autres de s'exécuter), traçabilité complète (query,
// provider, url source pour chaque trouvaille).
//
// Ne fait AUCUNE écriture si l'agent est désactivé (`RESEARCH_AGENT_ENABLED`
// n'est pas `"true"`) — comportement par défaut sûr.
// ═══════════════════════════════════════════════════════════════════════════

// ⚠️ Import relatif (pas l'alias `@/`) : ce module est exécuté à la fois par
// Next.js (route API) ET directement par `ts-node` (CLI, cf.
// scripts/run-research-cli.ts), qui ne résout pas l'alias `@/*` sans
// configuration supplémentaire — même convention que lib/ingestion/*.
import { prisma } from "../prisma";
import { DEFAULT_RESEARCH_QUERIES } from "./queries";
import { getSearchProvider, isResearchAgentEnabled } from "./provider-factory";

export interface ResearchAgentSummary {
  enabled: boolean;
  provider: string;
  queriesRun: number;
  resultsFound: number;
  findingsCreated: number;
  errors: Array<{ query: string; message: string }>;
}

export async function runResearchAgent(): Promise<ResearchAgentSummary> {
  const enabled = isResearchAgentEnabled();
  const provider = getSearchProvider();

  const summary: ResearchAgentSummary = {
    enabled,
    provider: provider.id,
    queriesRun: 0,
    resultsFound: 0,
    findingsCreated: 0,
    errors: [],
  };

  if (!enabled) {
    console.log("[research-agent] Désactivé (RESEARCH_AGENT_ENABLED != 'true') — aucun appel réseau effectué.");
    return summary;
  }

  for (const { query, category } of DEFAULT_RESEARCH_QUERIES) {
    summary.queriesRun += 1;
    try {
      const results = await provider.search(query);
      summary.resultsFound += results.length;
      if (results.length === 0) continue;

      const urls = results.map((r) => r.url);
      const existing = await prisma.researchFinding.findMany({ where: { url: { in: urls } }, select: { url: true } });
      const existingUrls = new Set(existing.map((e) => e.url));
      const newResults = results.filter((r) => !existingUrls.has(r.url));
      if (newResults.length === 0) continue;

      const created = await prisma.researchFinding.createMany({
        data: newResults.map((r) => ({
          query,
          category,
          title: r.title,
          url: r.url,
          summary: r.snippet ?? null,
          provider: provider.id,
        })),
        skipDuplicates: true,
      });
      summary.findingsCreated += created.count;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[research-agent] Échec pour la requête "${query}":`, message);
      summary.errors.push({ query, message });
    }
  }

  return summary;
}
