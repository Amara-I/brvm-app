// ═══════════════════════════════════════════════════════════════════════════
// CLI d'exécution manuelle de l'agent de recherche IA — étape 10
// ═══════════════════════════════════════════════════════════════════════════
// Appelle `runResearchAgent`, le cœur de `app/api/cron/research/route.ts`.
// La route HTTP enchaîne ensuite le hook du lundi (e-mail de propositions
// de portefeuille, pas encore branché). Utile en local avant d'activer
// `RESEARCH_AGENT_ENABLED`.
//
// Usage : npx ts-node scripts/run-research-cli.ts
// ═══════════════════════════════════════════════════════════════════════════

import { runResearchAgent } from "../lib/research/run-research-agent";

async function main() {
  console.log("🔎 AGENT DE RECHERCHE IA — OuestBourse (veille + propositions journalières)");
  const summary = await runResearchAgent();
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.enabled) {
    console.log('\nℹ️  Agent désactivé (RESEARCH_AGENT_ENABLED != "true") — aucun appel réseau effectué.');
  } else if (summary.proposalsWritten > 0) {
    console.log(`\n✦ ${summary.proposalsWritten} proposition(s) → docs/design-agent/proposals/`);
    console.log("→ Revue : docs/design-agent/proposals/");
  }
}

main().catch((err) => {
  console.error("❌ Erreur fatale de l'agent de recherche :", err);
  process.exit(1);
});
