import {
  EDUCATION_THEMES,
  getAllEducationTerms,
  getCategoryForTheme,
  type EducationTerm,
} from "./catalog";

/** Alias de recherche → slug(s). Phrases utilisateur courantes, hors synonymes catalogue. */
export const EDUCATION_SEARCH_ALIASES: Record<string, string[]> = {
  "gestion du risque": ["gestion-du-risque"],
  "gestion des risques": ["gestion-du-risque"],
  "risk management": ["gestion-du-risque", "taille-de-position"],
  "money management": ["taille-de-position", "gestion-du-risque"],
  sizing: ["taille-de-position"],
  "position sizing": ["taille-de-position"],
  dimensionnement: ["taille-de-position"],
  "stop loss": ["stop-loss-brvm"],
  stoploss: ["stop-loss-brvm"],
  var: ["var-value-at-risk"],
  "value at risk": ["var-value-at-risk"],
  cvar: ["cvar-expected-shortfall"],
  "expected shortfall": ["cvar-expected-shortfall"],
  mdd: ["drawdown-maximal"],
  "max drawdown": ["drawdown-maximal"],
  "cours actuel": ["cours"],
  cotation: ["cours"],
  "cap boursiere": ["capitalisation-boursiere"],
  "market cap": ["capitalisation-boursiere"],
  "perf 5 ans": ["horizons-c-m-l"],
  "perf 10 ans": ["horizons-c-m-l"],
  "rendement div": ["rendement-du-dividende"],
  "dividend yield": ["rendement-du-dividende"],
  per: ["per-price-earnings-ratio"],
  pe: ["per-price-earnings-ratio"],
  "price earnings": ["per-price-earnings-ratio"],
  rsi: ["rsi"],
  macd: ["macd"],
  sma: ["moyenne-mobile"],
  "moyenne mobile": ["moyenne-mobile"],
  nd: ["donnee-n-d"],
  "n/d": ["donnee-n-d"],
  "n d": ["donnee-n-d"],
  achat: ["signal-ouestbourse"],
  vendre: ["signal-ouestbourse"],
  conserver: ["signal-ouestbourse"],
  alleger: ["signal-ouestbourse"],
  "allégér": ["signal-ouestbourse"],
  "sante financiere": ["sante-financiere"],
  "santé financière": ["sante-financiere"],
  pru: ["pru"],
  "prix de revient": ["pru"],
};

export type EducationSearchHit = EducationTerm & {
  score: number;
  matchField: "title" | "synonym" | "alias" | "definition" | "details";
};

/** Normalise pour comparaison : casse, accents, ponctuation légère. */
export function foldEducationQuery(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(folded: string): string[] {
  return folded.split(" ").filter((t) => t.length >= 2);
}

function includesToken(hay: string, token: string): boolean {
  if (!token) return false;
  if (hay.includes(token)) return true;
  // Préfixe de mot : « volat » matche « volatilite »
  if (token.length >= 3) {
    const re = new RegExp(`(?:^| )${escapeRe(token)}`);
    return re.test(hay);
  }
  return false;
}

function allTokensMatch(hay: string, tokens: string[]): boolean {
  return tokens.every((t) => includesToken(hay, t));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fieldHaystacks(term: EducationTerm): {
  title: string;
  synonyms: string;
  definition: string;
  details: string;
  all: string;
} {
  const title = foldEducationQuery(term.title);
  const synonyms = foldEducationQuery(term.synonyms.join(" "));
  const definition = foldEducationQuery(term.definition);
  const details = foldEducationQuery(`${term.details ?? ""} ${term.example} ${term.tip ?? ""}`);
  return {
    title,
    synonyms,
    definition,
    details,
    all: `${title} ${synonyms} ${definition} ${details} ${term.slug.replace(/-/g, " ")}`,
  };
}

function aliasBoost(foldedQuery: string, tokens: string[], termSlug: string): number {
  let boost = 0;
  for (const [alias, slugs] of Object.entries(EDUCATION_SEARCH_ALIASES)) {
    if (!slugs.includes(termSlug)) continue;
    const fa = foldEducationQuery(alias);
    if (fa === foldedQuery) boost = Math.max(boost, 95);
    else if (foldedQuery.includes(fa) || fa.includes(foldedQuery)) boost = Math.max(boost, 82);
    else if (tokens.length > 0 && allTokensMatch(fa, tokens)) boost = Math.max(boost, 70);
  }
  return boost;
}

function scoreTerm(term: EducationTerm, foldedQuery: string, tokens: string[]): EducationSearchHit | null {
  const f = fieldHaystacks(term);
  const alias = aliasBoost(foldedQuery, tokens, term.slug);

  if (tokens.length === 0) {
    if (alias <= 0) return null;
    return { ...term, score: alias, matchField: "alias" };
  }

  if (!allTokensMatch(f.all, tokens) && alias === 0) {
    return null;
  }

  let score = 0;
  let matchField: EducationSearchHit["matchField"] = "details";

  if (f.title === foldedQuery) {
    score = 100;
    matchField = "title";
  } else if (f.title.startsWith(foldedQuery)) {
    score = 88;
    matchField = "title";
  } else if (includesToken(f.title, foldedQuery) || allTokensMatch(f.title, tokens)) {
    score = 76;
    matchField = "title";
  } else if (tokens.some((t) => includesToken(f.title, t))) {
    score = 62;
    matchField = "title";
  } else if (f.synonyms && (f.synonyms === foldedQuery || allTokensMatch(f.synonyms, tokens))) {
    score = 68;
    matchField = "synonym";
  } else if (f.synonyms && tokens.some((t) => includesToken(f.synonyms, t))) {
    score = 52;
    matchField = "synonym";
  } else if (allTokensMatch(f.definition, tokens)) {
    score = 36;
    matchField = "definition";
  } else if (allTokensMatch(f.details, tokens)) {
    score = 18;
    matchField = "details";
  }

  if (alias > score) {
    score = alias;
    matchField = "alias";
  }

  if (score <= 0) return null;
  // Bonus : tous les tokens dans le titre
  if (tokens.length > 1 && allTokensMatch(f.title, tokens)) score += 8;
  return { ...term, score, matchField };
}

export function searchEducationTerms(query: string): EducationTerm[] {
  return rankEducationSearch(query).map(({ score: _s, matchField: _m, ...term }) => term);
}

/** Recherche classée (accents, mots partiels, alias). Vide si requête vide. */
export function rankEducationSearch(query: string): EducationSearchHit[] {
  const folded = foldEducationQuery(query);
  if (!folded) return [];
  const tokens = tokenize(folded);

  const hits: EducationSearchHit[] = [];
  for (const term of getAllEducationTerms()) {
    const hit = scoreTerm(term, folded, tokens);
    if (hit) hits.push(hit);
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.title.localeCompare(b.title, "fr");
  });
  return hits;
}

export function educationSearchSuggestions(): string[] {
  return ["PER", "RSI", "dividende", "gestion du risque", "taille de position", "signal", "VaR"];
}

export function searchHitMeta(term: EducationTerm): { themeTitle: string; categoryTitle: string } {
  const theme = EDUCATION_THEMES.find((th) => th.slug === term.themeSlug);
  const cat = getCategoryForTheme(term.themeSlug);
  return {
    themeTitle: theme?.title ?? term.themeSlug,
    categoryTitle: cat?.title ?? "",
  };
}
