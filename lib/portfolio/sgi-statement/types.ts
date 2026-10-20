/** Types purs de l'import de relevé SGI — sans dépendance PDF ni Prisma. */

export type MatchConfidence = "haute" | "moyenne" | "faible" | "aucune";

export type MatchReason = "isin" | "ticker" | "alias" | "nom" | "approche" | "aucune";

export type SecurityCatalogEntry = {
  id: string;
  ticker: string;
  name: string;
  isin?: string | null;
};

export type SecurityCandidate = {
  companyId: string;
  ticker: string;
  name: string;
  score: number;
};

export type SecurityMatch = {
  companyId: string | null;
  ticker: string | null;
  name: string | null;
  confidence: MatchConfidence;
  score: number;
  ambiguous: boolean;
  reason: MatchReason;
  candidates: SecurityCandidate[];
};

/** Action cotée, obligation, ou fonds commun de placement. */
export type InstrumentKind = "action" | "obligation" | "fcp";

export type DocumentKind = "positions" | "historique" | "mixte";

export type IgnoreReason =
  | "vide"
  | "en-tete"
  | "adresse"
  | "page"
  | "disclaimer"
  | "especes"
  | "frais"
  | "total"
  | "section"
  | "sans-instrument"
  | "soldee"
  | "couverte";

export type IgnoredLine = {
  raw: string;
  reason: IgnoreReason;
};

export type StatementRowDraft = {
  id: string;
  /** Ligne source (tronquée) — utile pour corriger, jamais stockée en base. */
  rawLine: string;
  label: string;
  isin: string | null;
  quantity: number | null;
  /** Prix de revient unitaire, FCFA. */
  avgBuyPrice: number | null;
  lastPrice: number | null;
  valuation: number | null;
  /** Première date d'achat lue (YYYY-MM-DD), si le relevé est un historique. */
  tradeDate: string | null;
  instrumentKind: InstrumentKind;
  /**
   * `false` pour une obligation ou un FCP : la ligne est montrée, décochée,
   * et n'est pas enregistrée tant que l'utilisateur n'a pas choisi une société.
   */
  tracked: boolean;
  match: SecurityMatch;
  warnings: string[];
};

export type StatementParseResult = {
  issuer: string | null;
  /** YYYY-MM-DD si lu dans l'en-tête. */
  statementDate: string | null;
  layoutId: string;
  layoutLabel: string;
  /** `positions` = quantités déjà nettes ; `historique` = achats/ventes agrégés. */
  documentKind: DocumentKind;
  rows: StatementRowDraft[];
  /** Lignes écartées (plafond d'affichage). Le compteur peut être plus grand. */
  ignored: IgnoredLine[];
  ignoredCount: number;
  warnings: string[];
};

export type StatementCompanyOption = {
  id: string;
  ticker: string;
  name: string;
};

export type StatementPreview = StatementParseResult & {
  companies: StatementCompanyOption[];
};

export type StatementImportCode =
  | "EMPTY"
  | "TOO_LARGE"
  | "UNSUPPORTED"
  | "INVALID_PDF"
  | "SCANNED_PDF"
  | "UNRECOGNIZED"
  | "UNREADABLE"
  | "HEIC";
