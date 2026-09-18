export type CompanySheetTabKey =
  | "overview"
  | "charts"
  | "projection"
  | "comparison"
  | "societe"
  | "actualites"
  | "documents";

export const COMPANY_SHEET_TABS: Array<{ key: CompanySheetTabKey; label: string }> = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "charts", label: "Graphes" },
  { key: "projection", label: "🔮 Projection future" },
  { key: "comparison", label: "⚖️ Comparaison" },
  { key: "societe", label: "Société" },
  { key: "actualites", label: "Actualités" },
  { key: "documents", label: "Documents" },
];

const LEGACY_TABS: Record<string, CompanySheetTabKey> = {
  dividends: "overview",
  interims: "overview",
  financials: "overview",
};

export function normalizeSheetTab(raw: string | undefined): CompanySheetTabKey {
  if (!raw) return "overview";
  if (COMPANY_SHEET_TABS.some((t) => t.key === raw)) return raw as CompanySheetTabKey;
  return LEGACY_TABS[raw] ?? "overview";
}
