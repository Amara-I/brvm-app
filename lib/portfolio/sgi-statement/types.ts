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
  match: SecurityMatch;
  warnings: string[];
};

export type StatementParseResult = {
  issuer: string | null;
  /** YYYY-MM-DD si lu dans l'en-tête. */
  statementDate: string | null;
  layoutId: string;
  layoutLabel: string;
  rows: StatementRowDraft[];
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
  | "UNREADABLE";
