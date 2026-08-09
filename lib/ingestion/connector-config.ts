// ═══════════════════════════════════════════════════════════════════════════
// Feature flags par connecteur/opération — étape 6 du plan de migration
// ═══════════════════════════════════════════════════════════════════════════
// Répond explicitement au brief : "un scraper/connecteur dédié par source,
// chacun isolé pour pouvoir être maintenu/désactivé indépendamment si la
// structure HTML change ou si un site bloque le scraping". Plutôt que de
// commenter du code en urgence en cas de blocage, on bascule une variable
// d'env (aucun redéploiement nécessaire sur Vercel — juste un redeploy des
// env vars).
// ═══════════════════════════════════════════════════════════════════════════

export interface ConnectorFeatureFlags {
  brvmIndices: boolean;
  brvmQuotes: boolean;
  sikafinanceIndices: boolean;
  sikafinanceQuotes: boolean;
  richbourseIndices: boolean;
  richbourseQuotes: boolean;
}

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  return raw === "1" || raw.toLowerCase() === "true";
}

export function getConnectorFeatureFlags(): ConnectorFeatureFlags {
  return {
    brvmIndices: envFlag("INGESTION_ENABLE_BRVM_INDICES", true),
    brvmQuotes: envFlag("INGESTION_ENABLE_BRVM_QUOTES", true),
    sikafinanceIndices: envFlag("INGESTION_ENABLE_SIKAFINANCE_INDICES", true),
    // Désactivé PAR DÉFAUT : aucun endpoint public confirmé pour les
    // cotations par société sur Sikafinance à ce jour (cf. connecteur —
    // `/marches/cotation_{TICKER}` retourne 404 pour la quasi-totalité des
    // tickers). L'exécuter quotidiennement contre ~20-50 sociétés ne
    // produirait que des 404 en boucle, ce qui va à l'encontre du principe
    // de scraping respectueux (brief : "pas de surcharge des serveurs
    // tiers"). Réactivable via `INGESTION_ENABLE_SIKAFINANCE_QUOTES=true`
    // dès qu'un endpoint fonctionnel est confirmé manuellement.
    sikafinanceQuotes: envFlag("INGESTION_ENABLE_SIKAFINANCE_QUOTES", false),
    richbourseIndices: envFlag("INGESTION_ENABLE_RICHBOURSE_INDICES", true),
    richbourseQuotes: envFlag("INGESTION_ENABLE_RICHBOURSE_QUOTES", true),
  };
}
