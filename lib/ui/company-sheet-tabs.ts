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

// ───────────── Fiche NGX (`/marches/ngx/actions/[ticker]`) ─────────────

/**
 * Même structure que la fiche BRVM : Vue d'ensemble, Analyse fondamentale,
 * Analyse Graphique. Projection future et Comparaison restent propres à la BRVM
 * (elles reposent sur le jeu de données BRVM) : leurs identifiants ouvrent Vue d'ensemble.
 */
export type NgxSheetTabKey = "overview" | "fundamental" | "charts";

export const NGX_SHEET_TABS: Array<{ key: NgxSheetTabKey; label: string }> = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "fundamental", label: "Analyse fondamentale" },
  { key: "charts", label: "Analyse Graphique" },
];

const NGX_LIVE = new Set<string>(NGX_SHEET_TABS.map((tab) => tab.key));

/** Anciennes ancres de la fiche NGX en une page (sections 1 à 8, graphe). */
const NGX_LEGACY_ANCHORS: Record<string, NgxSheetTabKey> = {
  "ngx-presentation": "overview",
  "ngx-performance": "fundamental",
  "ngx-outlook": "fundamental",
  "ngx-price": "fundamental",
  "ngx-valuation": "fundamental",
  "ngx-sector": "fundamental",
  "ngx-dividends": "fundamental",
  "ngx-conclusion": "fundamental",
  "ngx-chart": "charts",
  graphe: "charts",
};

function ngxKey(key: string): NgxSheetTabKey | null {
  if (NGX_LIVE.has(key)) return key as NgxSheetTabKey;
  if (FUNDAMENTAL_ALIASES.has(key)) return "fundamental";
  if (Object.prototype.hasOwnProperty.call(NGX_LEGACY_ANCHORS, key)) return NGX_LEGACY_ANCHORS[key]!;
  if (Object.prototype.hasOwnProperty.call(LEGACY_SHEET_TABS, key)) return "overview";
  if (key === "projection" || key === "comparison") return "overview";
  return null;
}

export function normalizeNgxSheetTab(raw: string | undefined | null): NgxSheetTabKey {
  const key = canonicalizeSheetTabToken(raw);
  if (!key) return "overview";
  return ngxKey(key) ?? "overview";
}

/** `null` si le hash ne désigne aucun onglet connu (ancre interne d'une section). */
export function ngxSheetTabFromHash(hash: string | undefined | null): NgxSheetTabKey | null {
  const key = canonicalizeSheetTabToken(hash);
  if (!key) return null;
  return ngxKey(key);
}
