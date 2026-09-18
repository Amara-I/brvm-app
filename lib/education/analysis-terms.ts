/** Correspondance labels d’analyse (fiche / marché) → slugs Éducation. */

export const OVERVIEW_KEY_TERM_SLUGS = [
  "gestion-du-risque",
  "signal-ouestbourse",
  "score-composite",
  "confiance-du-signal",
  "sante-financiere",
  "rendement-du-dividende",
  "per-price-earnings-ratio",
  "taille-de-position",
] as const;

const EXACT_LABEL_SLUGS: Record<string, string> = {
  "Perf. 5 ans": "horizons-c-m-l",
  "Rend. div.": "rendement-du-dividende",
  Risque: "risque",
  Confiance: "confiance-du-signal",
  "Cap. boursière": "capitalisation-boursiere",
  "Perf. 10 ans": "horizons-c-m-l",
  "Rendement div.": "rendement-du-dividende",
  PER: "per-price-earnings-ratio",
  Volatilité: "volatilite",
  "Risque (volatilité)": "volatilite",
  "Gestion du risque": "gestion-du-risque",
  "Horizons C/M/L": "horizons-c-m-l",
  "Score / Signal": "signal-ouestbourse",
  "Santé financière": "sante-financiere",
  Signal: "signal-ouestbourse",
  "Dividende / action": "dividende",
  "Rendement dividende": "rendement-du-dividende",
  Capitalisation: "capitalisation-boursiere",
  ROE: "roe",
  "Marge nette": "marge-beneficiaire",
  "Ratio d'endettement": "dette-equite",
  "Croissance CA": "chiffre-d-affaires",
  "Free Cash Flow": "fcfe",
  "Volume moyen (20 j)": "liquidite",
  "Score d'analyse": "score-composite",
  "Court terme": "horizons-c-m-l",
  "Moyen terme": "horizons-c-m-l",
  "Long terme": "horizons-c-m-l",
  Technique: "score-technique",
  Fondamental: "score-fondamental",
  Sectoriel: "score-fondamental",
  Rentabilité: "rendement-du-dividende",
  Croissance: "chiffre-d-affaires",
  Solvabilité: "gestion-du-risque",
  Liquidité: "liquidite",
  "Risque de marché": "risque-de-marche",
  "Risque de liquidité": "liquidite",
  "Risque fondamental": "risque-fondamental",
  "Risque opérationnel": "risque-operationnel",
  marché: "risque-de-marche",
  liquidité: "liquidite",
  fondamental: "risque-fondamental",
  opérationnel: "risque-operationnel",
};

const RISK_PILLAR_SLUGS: Record<string, string> = {
  marche: "risque-de-marche",
  liquidite: "liquidite",
  fondamental: "risque-fondamental",
  operationnel: "risque-operationnel",
};

export function educationSlugForAnalysisLabel(label: string): string | null {
  const trimmed = label.trim();
  if (EXACT_LABEL_SLUGS[trimmed]) return EXACT_LABEL_SLUGS[trimmed]!;
  if (trimmed.startsWith("Cours de clôture")) return "cours";
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("drawdown")) return "drawdown-maximal";
  if (lower.startsWith("var 95") || lower.startsWith("var 99")) return "var-value-at-risk";
  if (lower.startsWith("cvar")) return "cvar-expected-shortfall";
  return null;
}

export function educationSlugForRiskPillar(key: string): string | null {
  return RISK_PILLAR_SLUGS[key] ?? null;
}
