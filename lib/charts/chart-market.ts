// Configuration par marché du workbench graphique : devise, décimales de cours,
// routes API et fiches, clé de stockage des tracés, horaires de séance.
// BRVM reste le défaut (comportement historique inchangé) ; NGX réutilise le même
// workbench avec ses propres sources de données (cours en naira, indices NGX).

export type ChartMarket = "BRVM" | "NGX";

export interface ChartMarketConfig {
  id: ChartMarket;
  /** Code ISO de la devise d'affichage des cours. */
  currency: "XOF" | "NGN";
  /** Décimales affichées sur les cours (axe, légende OHLC, en-tête). */
  priceDecimals: number;
  /** Séance continue UTC en minutes depuis minuit (lundi → vendredi). */
  sessionUtcMinutes: { open: number; close: number };
  /** Compte : analyses sauvegardées et alertes de cours (les deux places ; le portefeuille reste BRVM). */
  accountTools: boolean;
}

export const CHART_MARKETS: Record<ChartMarket, ChartMarketConfig> = {
  BRVM: {
    id: "BRVM",
    currency: "XOF",
    priceDecimals: 0,
    sessionUtcMinutes: { open: 9 * 60 + 30, close: 14 * 60 + 30 },
    accountTools: true,
  },
  NGX: {
    id: "NGX",
    currency: "NGN",
    // NGX : 10h00–14h30 heure de Lagos (UTC+1) = 09h00–13h30 UTC.
    priceDecimals: 2,
    sessionUtcMinutes: { open: 9 * 60, close: 13 * 60 + 30 },
    accountTools: true,
  },
};

export function chartMarketConfig(market: ChartMarket | undefined): ChartMarketConfig {
  return CHART_MARKETS[market ?? "BRVM"];
}

/** `/api/ngx/charts/:symbol` — mêmes paramètres et même forme de réponse que `/api/charts/:ticker`. */
export function ngxChartApiPath(symbol: string, range: string, interval = "1D"): string {
  return `/api/ngx/charts/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
}

/** Fiche NGX d'un titre ou d'un indice. */
export function ngxSymbolHref(symbol: string, kind: "company" | "index"): string {
  return kind === "index"
    ? `/marches/ngx/indices/${encodeURIComponent(symbol)}`
    : `/marches/ngx/actions/${encodeURIComponent(symbol)}`;
}

/** Clé des tracés locaux : préfixe NGX pour ne jamais collisionner avec un ticker BRVM. */
export function chartStorageKey(market: ChartMarket | undefined, symbol: string): string {
  return market === "NGX" ? `NGX:${symbol}` : symbol;
}
