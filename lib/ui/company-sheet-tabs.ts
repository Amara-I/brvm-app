/**
 * Onglets de la fiche BRVM (`/actions/[ticker]`).
 *
 * Pour en ajouter un (ex. « Analyse fondamentale ») : étendre
 * `CompanySheetTabKey`, ajouter une entrée dans `COMPANY_SHEET_TABS`,
 * le libellé `company.tabs.<clé>` (français et anglais) et une branche
 * dans `CompanySheetClient`. Les anciens identifiants (query `?tab=`,
 * hash, localStorage) restent dans `LEGACY_SHEET_TABS` et ouvrent
 * Vue d'ensemble.
 */
export type CompanySheetTabKey = "overview" | "fundamental" | "charts" | "projection" | "comparison";

export const COMPANY_SHEET_TABS: Array<{ key: CompanySheetTabKey; label: string }> = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "fundamental", label: "Analyse fondamentale" },
  { key: "charts", label: "Analyse Graphique" },
  { key: "projection", label: "🔮 Projection future" },
  { key: "comparison", label: "⚖️ Comparaison" },
];

/** Anciens onglets retirés de l'interface. Tous renvoient à Vue d'ensemble. */
const LEGACY_SHEET_TABS: Record<string, CompanySheetTabKey> = {
  dividends: "overview",
  interims: "overview",
  financials: "overview",
  societe: "overview",
  société: "overview",
  actualites: "overview",
  actualités: "overview",
  actualite: "overview",
  documents: "overview",
  document: "overview",
  news: "overview",
  company: "overview",
};

const LIVE_TAB_KEYS = new Set<string>(COMPANY_SHEET_TABS.map((tab) => tab.key));

/** Ancres prévues avant l'onglet, désormais ouvertes sur Analyse fondamentale. */
const FUNDAMENTAL_ALIASES = new Set(["analyse-fondamentale", "fundamental-analysis"]);

export function canonicalizeSheetTabToken(raw: string | undefined | null): string {
  if (!raw) return "";
  const stripped = raw.trim().replace(/^#/, "");
  if (!stripped) return "";
  let decoded = stripped;
  try {
    decoded = decodeURIComponent(stripped);
  } catch {
    decoded = stripped;
  }
  return decoded.trim().toLowerCase();
}

export function isLegacySheetTab(raw: string | undefined | null): boolean {
  const key = canonicalizeSheetTabToken(raw);
  return key.length > 0 && Object.prototype.hasOwnProperty.call(LEGACY_SHEET_TABS, key);
}

export function normalizeSheetTab(raw: string | undefined | null): CompanySheetTabKey {
  const key = canonicalizeSheetTabToken(raw);
  if (!key) return "overview";
  if (LIVE_TAB_KEYS.has(key)) return key as CompanySheetTabKey;
  if (FUNDAMENTAL_ALIASES.has(key)) return "fundamental";
  return LEGACY_SHEET_TABS[key] ?? "overview";
}

/**
 * Fragment d'URL (`#societe`, `#charts`).
 * `null` si le hash est absent ou ne correspond à aucun onglet connu :
 * on ne force alors pas l'onglet (ancre future, ex. analyse fondamentale).
 */
export function sheetTabFromHash(hash: string | undefined | null): CompanySheetTabKey | null {
  const key = canonicalizeSheetTabToken(hash);
  if (!key) return null;
  if (LIVE_TAB_KEYS.has(key)) return key as CompanySheetTabKey;
  if (FUNDAMENTAL_ALIASES.has(key)) return "fundamental";
  if (Object.prototype.hasOwnProperty.call(LEGACY_SHEET_TABS, key)) return LEGACY_SHEET_TABS[key] ?? "overview";
  return null;
}
