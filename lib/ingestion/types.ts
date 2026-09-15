// ═══════════════════════════════════════════════════════════════════════════
// Types partagés par les connecteurs d'ingestion (étape 3 du plan de migration)
// ═══════════════════════════════════════════════════════════════════════════

/// Mêmes valeurs que l'enum Prisma `DataSource` (prisma/schema.prisma) — dupliqué
/// ici en littéral TS pour que ce module reste utilisable indépendamment du
/// client Prisma généré (ex: dans un script CLI léger ou un test unitaire).
export type DataSourceCode =
  | "BRVM_OFFICIEL"
  | "SIKAFINANCE"
  | "OUESTBOURSE"
  | "RICHBOURSE"
  | "MANUEL";

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

/// Composante d'indice récupérée depuis une source (poids souvent absent).
export interface RawIndexConstituent {
  indexCode: string;
  ticker: string;
  weight: number | null;
  source: DataSourceCode;
  /// Date d'effet (YYYY-MM-DD).
  asOf: string;
  note?: string | null;
}

/// Cotation d'une action pour une société/date donnée, récupérée depuis une source.
export interface RawPriceQuote {
  ticker: string;
  closePrice: number;
  volume: number | null;
  source: DataSourceCode;
  date: string; // "YYYY-MM-DD"
  fetchedAt: string;
  /// Variation journalière officielle (%) si la source la publie (ex. BRVM.org).
  changePercent?: number | null;
  /// Cours de la veille (FCFA) si publié à côté de la clôture.
  prevClose?: number | null;
  /// Contourne le collier ±7,5 % (corporate action / correction manuelle).
  collarOverride?: boolean;
}

/// Fondamentaux publiés sur la fiche société (PER + capitalisation).
/// La capitalisation est convertie en milliards de FCFA (unité affichée dans
/// le dashboard, cf. schema FinancialRatio.mktCap).
/// Champs optionnels : enrichissement multi-source (ex. Sikafinance SOCIETE).
export interface RawCompanyFundamentals {
  ticker: string;
  year: number;
  per: number | null;
  /// Capitalisation globale en milliards de FCFA (arrondie).
  mktCapMds: number | null;
  closePrice: number | null;
  source: DataSourceCode;
  fetchedAt: string;
  roe?: number | null;
  netMargin?: number | null;
  revenueGrowth?: number | null;
  /// Chiffre d'affaires en milliards de FCFA.
  revenue?: number | null;
  /// Résultat net en milliards de FCFA.
  netIncome?: number | null;
  /// Résultat d'exploitation en milliards de FCFA.
  operatingIncome?: number | null;
  debtRatio?: number | null;
  pbRatio?: number | null;
  fcf?: number | null;
}

/// Dividende annuel brut récupéré depuis une source (ex. tableau SOCIETE Sika).
export interface RawDividendRow {
  ticker: string;
  year: number;
  amount: number;
  source: DataSourceCode;
  fetchedAt: string;
  /** YYYY-MM-DD — date ex-dividende si publiée (ex. calendrier BRVM). */
  exDate?: string | null;
  /** YYYY-MM-DD — date de paiement si publiée. */
  paymentDate?: string | null;
}

/// Profil texte / identité société (Sikafinance SOCIETE / OB brvm_company_profiles).
export interface RawCompanyProfile {
  ticker: string;
  isin: string | null;
  description: string | null;
  /// Nombre de titres en circulation (si publié).
  sharesOutstanding: number | null;
  /// Flottant en % (si publié).
  floatPercent: number | null;
  phone: string | null;
  fax: string | null;
  address: string | null;
  directors: string | null;
  /// Valorisation brute telle que publiée (ex. "3 698 000 MFCFA").
  valuationLabel: string | null;
  shareholders: Array<{ name: string; percent: number | null }>;
  /// Date de référence de l'actionnariat (ISO date), si connue.
  shareholdersAsOf?: string | null;
  /** Direction générale (CEO), source BRVM/OB. */
  ceo?: string | null;
  /** Présidence du conseil. */
  chairman?: string | null;
  /** Industrie BRVM (ex. TELECOMMUNICATION). */
  industry?: string | null;
  website?: string | null;
  /** Introduction en bourse (YYYY-MM-DD). */
  listingDate?: string | null;
  source: DataSourceCode;
  fetchedAt: string;
}

/// Actualité liée à une valeur (page news_valeur Sikafinance).
export interface RawCompanyNewsItem {
  ticker: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null; // ISO datetime ou date
  sourceName: string;
  fetchedAt: string;
}

/// Événement corporate (page events Sikafinance).
export interface RawCompanyEventItem {
  ticker: string;
  title: string;
  eventDate: string; // ISO date
  endDate: string | null;
  comment: string | null;
  sourceName: string;
  fetchedAt: string;
}

/// Document déposé (catalogue OB / BRVM.org — pas de scrape /docs Sika).
export interface RawCompanyDocument {
  ticker: string;
  title: string | null;
  filename: string | null;
  url: string;
  docType: string | null;
  periodLabel: string | null;
  publishedAt: string | null; // ISO date
  sourceName: string;
  externalId: string | null;
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
