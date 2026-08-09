// ═══════════════════════════════════════════════════════════════════════════
// Types partagés par les connecteurs d'ingestion (étape 3 du plan de migration)
// ═══════════════════════════════════════════════════════════════════════════

/// Mêmes valeurs que l'enum Prisma `DataSource` (prisma/schema.prisma) — dupliqué
/// ici en littéral TS pour que ce module reste utilisable indépendamment du
/// client Prisma généré (ex: dans un script CLI léger ou un test unitaire).
export type DataSourceCode = "BRVM_OFFICIEL" | "SIKAFINANCE" | "RICHBOURSE" | "MANUEL";

/// Cotation d'un indice de marché récupérée depuis une source.
export interface RawIndexQuote {
  /// Code de l'indice tel que normalisé par notre app (ex: "BRVM_COMPOSITE",
  /// "BRVM_30"). Chaque connecteur mappe le libellé propre à son site vers
  /// ce code commun (cf. `normalizeIndexCode` dans chaque connecteur).
  code: string;
  /// Libellé humain tel qu'affiché par la source (ex: "BRVM - COMPOSITE").
  label: string;
  value: number;
  changePercent: number | null;
  source: DataSourceCode;
  /// Date de la séance concernée (pas la date de récupération).
  date: string; // format ISO "YYYY-MM-DD"
  fetchedAt: string; // ISO datetime
}

/// Cotation d'une action pour une société/date donnée, récupérée depuis une source.
export interface RawPriceQuote {
  ticker: string;
  closePrice: number;
  volume: number | null;
  source: DataSourceCode;
  date: string; // "YYYY-MM-DD"
  fetchedAt: string;
}

/// Résultat générique d'un appel de connecteur : succès + données, ou échec
/// explicite (jamais d'exception qui remonte silencieusement — cf. brief
/// "gestion des erreurs 403/429/500").
export type ConnectorResult<T> =
  | { ok: true; source: DataSourceCode; data: T; fetchedAt: string }
  | { ok: false; source: DataSourceCode; error: string; httpStatus?: number; fetchedAt: string };

/// Interface commune que chaque connecteur (brvm/sikafinance/richbourse)
/// implémente, afin que le script d'ingestion et la réconciliation puissent
/// traiter les 3 sources de façon interchangeable.
export interface MarketDataConnector {
  readonly source: DataSourceCode;
  /// Récupère les indices du jour (ou d'une date donnée). Peut retourner un
  /// sous-ensemble des indices si la source n'en publie qu'une partie
  /// publiquement (cf. Sikafinance).
  fetchIndices(date?: string): Promise<ConnectorResult<RawIndexQuote[]>>;
  /// Récupère le cours de clôture d'une liste de tickers pour une date
  /// donnée. Les tickers introuvables sur cette source ne provoquent PAS
  /// d'échec global : ils sont simplement absents du tableau retourné.
  fetchQuotes(tickers: string[], date?: string): Promise<ConnectorResult<RawPriceQuote[]>>;
}
