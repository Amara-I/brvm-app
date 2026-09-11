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

export interface HistoryBackfillFlags {
  /** Orchestrateur GetHistos + enrichissement (défaut true). */
  enabled: boolean;
  /**
   * Journalier chunké (défaut true). `false` saute toutes les fenêtres
   * GetHistos xperiod=0 — annual/monthly/sheets continuent, d'où des
   * réponses cron `dailyChunksFetched: 0` sur des séries encore mensuelles
   * (cas BICC). Override ops : `?forceDaily=1`.
   */
  daily: boolean;
  /** Fiches SOCIETE : ISIN, PER, CA/RN, dividendes. */
  sheets: boolean;
  /** Événements + actualités valeur. */
  eventsNews: boolean;
  /** Documents BRVM via catalogue OuestBourse (si clé configurée). */
  documents: boolean;
  /** Enchaîner un backfill borné après le cron d'ingestion quotidien (défaut false). */
  onDailyCron: boolean;
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
    // Activé par défaut (10/09/2026) : une seule page `/marches/aaz`
    // (`#tblShare`) publie Dernier + volume pour toutes les valeurs —
    // plus de scrape `cotation_{TICKER}` (404 / `.mkprice` disparu).
    // Repli GetHistos (dernier close) si le tableau A–Z est vide.
    // Désactivable via `INGESTION_ENABLE_SIKAFINANCE_QUOTES=false`.
    sikafinanceQuotes: envFlag("INGESTION_ENABLE_SIKAFINANCE_QUOTES", true),
    richbourseIndices: envFlag("INGESTION_ENABLE_RICHBOURSE_INDICES", true),
    richbourseQuotes: envFlag("INGESTION_ENABLE_RICHBOURSE_QUOTES", true),
  };
}

export function getHistoryBackfillFlags(): HistoryBackfillFlags {
  return {
    enabled: envFlag("INGESTION_ENABLE_HISTORY_BACKFILL", true),
    daily: envFlag("INGESTION_ENABLE_SIKA_DAILY_HISTORY", true),
    sheets: envFlag("INGESTION_ENABLE_SIKA_SHEETS", true),
    eventsNews: envFlag("INGESTION_ENABLE_SIKA_EVENTS", true),
    documents: envFlag("INGESTION_ENABLE_OB_DOCUMENTS", true),
    // Désactivé par défaut : le cron Hobby (300 s) est déjà saturé par
    // BRVM + Sika A–Z + Richbourse. Activer uniquement si on accepte un
    // rattrapage incrémental (reprise ticker par ticker).
    onDailyCron: envFlag("INGESTION_HISTORY_BACKFILL_ON_CRON", false),
  };
}
