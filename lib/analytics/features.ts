export const ANALYTICS_EVENT_NAMES = ["page_view", "nav_click", "feature_click"] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export const ANALYTICS_FEATURES = [
  "landing",
  "marche",
  "indices",
  "screener",
  "graphes",
  "portefeuille",
  "simulation",
  "company_sheet",
  "societes_cotees",
  "actualites",
  "outils",
  "education",
  "dividendes",
  "coming_soon_market",
  "connexion",
  "inscription",
  "search",
  "mentions_legales",
  "other",
] as const;
export type AnalyticsFeature = (typeof ANALYTICS_FEATURES)[number];

export const FEATURE_LABELS: Record<AnalyticsFeature, string> = {
  landing: "Accueil",
  marche: "Marché",
  indices: "Indices",
  screener: "Screener",
  graphes: "Graphes",
  portefeuille: "Portefeuille",
  simulation: "Simulation",
  company_sheet: "Fiche société",
  societes_cotees: "Sociétés cotées",
  actualites: "Actualités",
  outils: "Outils",
  education: "Éducation",
  dividendes: "Calendrier dividendes",
  coming_soon_market: "Marchés bientôt",
  connexion: "Connexion",
  inscription: "Inscription",
  search: "Recherche header",
  mentions_legales: "Mentions légales",
  other: "Autre",
};

const FEATURE_SET = new Set<string>(ANALYTICS_FEATURES);

export function isAnalyticsFeature(value: string): value is AnalyticsFeature {
  return FEATURE_SET.has(value);
}

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return (ANALYTICS_EVENT_NAMES as readonly string[]).includes(value);
}

export function featureFromPath(path: string): AnalyticsFeature {
  if (path === "/") return "landing";
  if (path === "/marche" || path.startsWith("/marche/")) return "marche";
  if (path === "/indices" || path.startsWith("/indices/")) return "indices";
  if (path.startsWith("/screener")) return "screener";
  if (path.startsWith("/graphes")) return "graphes";
  if (path.startsWith("/portefeuille")) return "portefeuille";
  if (path.startsWith("/simulation")) return "simulation";
  if (path.startsWith("/actions/")) return "company_sheet";
  if (path.startsWith("/societes-cotees")) return "societes_cotees";
  if (path.startsWith("/actualites")) return "actualites";
  if (path.startsWith("/outils")) return "outils";
  if (path.startsWith("/education")) return "education";
  if (path.startsWith("/calendrier-dividendes")) return "dividendes";
  if (path.startsWith("/marches/")) return "coming_soon_market";
  if (path.startsWith("/connexion")) return "connexion";
  if (path.startsWith("/inscription")) return "inscription";
  if (path.startsWith("/mentions-legales")) return "mentions_legales";
  return "other";
}

export function shouldTrackPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("/admin")) return false;
  if (path.startsWith("/api")) return false;
  return true;
}

export function featureLabel(feature: string): string {
  return isAnalyticsFeature(feature) ? FEATURE_LABELS[feature] : feature;
}
