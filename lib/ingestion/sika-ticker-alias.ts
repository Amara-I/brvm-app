/**
 * Symbole Sikafinance quand il ne coïncide pas avec le ticker en base.
 *
 * Vérifié le 2026-10-02 sur `/marches/aaz` : Bridge Bank est
 * `cotation_BBGC.ci` (pas BBGCI). GetHistos `BBGC.ci` du 2026-09-01 au
 * 2026-10-02 renvoie 8 clôtures réelles (23/09 → 02/10), pas le seul
 * prix d'OPV 6 750 du 15/09 stocké en base. L'alias ne crée aucun cours.
 *
 * Pour les persister (DATABASE_URL), journalier seulement : l'annuel et le
 * mensuel GetHistos regroupent la fenêtre en une barre (ex. 23/09 Close 8 995
 * alors que la séance du 23/09 a clôturé à 6 750).
 *   npx ts-node scripts/run-history-backfill.ts BBGCI --daily-from=2026-09-01 --no-annual --no-monthly --no-sheets --no-events --no-docs
 *   npm run charts:refresh
 */
export const SIKA_SYMBOL_BY_TICKER: Record<string, string> = {
  BBGCI: "BBGC.ci",
};

/** Ticker interne pour un ticker ou un symbole Sika (`BBGC` / `BBGC.ci` → `BBGCI`). */
export function internalTickerForSika(sikaTickerOrSymbol: string): string {
  const raw = sikaTickerOrSymbol.trim().toUpperCase();
  const bare = raw.split(".")[0] || raw;
  for (const [internal, symbol] of Object.entries(SIKA_SYMBOL_BY_TICKER)) {
    const sym = symbol.toUpperCase();
    const symBare = sym.split(".")[0] || sym;
    if (raw === sym || bare === symBare) return internal;
  }
  return bare;
}

/** Ajoute les tickers internes absents de la page A–Z (clé = ticker base). */
export function applySikaSymbolAliases(map: Map<string, string>): Map<string, string> {
  for (const [ticker, symbol] of Object.entries(SIKA_SYMBOL_BY_TICKER)) {
    if (!map.has(ticker)) map.set(ticker, symbol);
  }
  return map;
}
