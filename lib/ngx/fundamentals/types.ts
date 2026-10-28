// Types partagés du chargeur de fondamentaux NGX (étapes 1-4 : découverte, téléchargement,
// extraction, validation). Aucun accès base de données ici.

export type NgxDocType = "AUDITED_FS" | "ANNUAL_REPORT" | "EARNINGS_RELEASE";

/** Ligne brute de la liste SharePoint `XFinancial_News` (champs utiles uniquement). */
export interface NgxListItem {
  URL: { Description: string | null; Url: string };
  Type_of_Submission: string | null;
  CompanyName: string | null;
  CompanySymbol: string | null;
  Created: string;
}

export interface NgxManifestEntry {
  ticker: string;
  /** Symbole sous lequel le document a été déposé (peut être un symbole historique). */
  filedSymbol: string;
  docType: NgxDocType;
  /** Exercice déduit du titre / de la date de dépôt (heuristique ; l'extraction relit l'exercice réel). */
  guessedFiscalYear: number;
  createdAt: string;
  title: string;
  url: string;
  /** Nom de fichier local (relatif à <stage>/docs/<TICKER>/). */
  file: string;
}

export type NgxCompanyKind = "corporate" | "bank" | "insurance";

export interface NgxCompanyConfig {
  ticker: string;
  name: string;
  kind: NgxCompanyKind;
  /** Symboles NGX à interroger (le courant en premier, puis les historiques). */
  symbols: string[];
  /** Devise de présentation de la colonne retenue. */
  currency: "NGN" | "USD";
  /** Mois de clôture (12 = 31 décembre, 3 = 31 mars...). */
  fyEndMonth: number;
  /** Note libre reprise dans le CSV. */
  note?: string;
}

export type Confidence = "high" | "medium" | "low" | "none";

export type FieldName = "revenue" | "operatingProfit" | "netProfit" | "netProfitOwners" | "equity" | "eps";

/** Valeur lue dans le PDF, dans l'unité d'origine (avant conversion). */
export interface RawField {
  /** [exercice courant, exercice précédent] (colonne retenue). */
  values: [number | null, number | null];
  label: string;
  /** Page PDF (1-based) d'où provient la valeur. */
  page: number;
}

export interface StatementExtraction {
  fiscalYear: number | null;
  currency: "NGN" | "USD" | null;
  /** Multiplicateur vers l'unité de base (ex. 1_000_000 pour « ₦ million »). */
  unitMultiplier: number | null;
  unitLabel: string | null;
  fields: Partial<Record<FieldName, RawField>>;
  revenueBasis: string | null;
  operatingBasis: string | null;
  pages: { income: number | null; balance: number | null };
  /** « Dividendes payés » (tableau des flux de trésorerie, valeurs absolues dans l'unité du document). */
  dividendsPaid?: RawField;
  /** Colonne retenue ("group" par défaut), avec la raison si ambigu. */
  columnNote: string | null;
  /** Mois de clôture (1-12) lu dans l'en-tête, si présent. */
  periodEndMonth: number | null;
  /** Document intermédiaire (semestriel / trimestriel) : exclu des séries annuelles. */
  interim: boolean;
  /** Texte issu d'un OCR (PDF image seule) : confiance plafonnée à « medium » sauf confirmation par un comparatif. */
  ocr?: boolean;
  /** En-tête « Unaudited … » (états préliminaires non audités) : écarté au profit d'un document audité du même exercice. */
  unaudited?: boolean;
  warnings: string[];
}
