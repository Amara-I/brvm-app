export const screener = {
  title: "Screener",
  metaTitle: "Screener — OuestBourse",
  metaDescription:
    "Filtrez les sociétés cotées à la BRVM par rentabilité, dividendes, croissance ou valorisation.",
  kicker: "BRVM · UEMOA",
  lead:
    "Filtrez les {count} sociétés cotées par rentabilité, dividendes, croissance, valorisation ou solidité — puis affinez par secteur et pays. Cliquez un ticker pour ouvrir sa fiche détaillée.",
  emptyTitle: "Aucune société disponible",
  emptyBody:
    "Les données de marché n’ont pas encore été chargées. Les champs vides s’affichent N/D — aucun cours n’est inventé.",
  filters: {
    profitability: "Rentabilité",
    dividends: "Dividendes",
    growth: "Croissance",
    valuation: "Valorisation",
    quality: "Solidité",
  },
  sector: "Secteur",
  country: "Pays",
  search: "Recherche",
  searchPlaceholder: "Ticker ou nom…",
  all: "Tous",
  resultsOne: "{count} résultat",
  resultsMany: "{count} résultats",
  emptyRow: "Aucun titre ne correspond à ces filtres.",
  columns: {
    company: "Société",
    sector: "Secteur",
    country: "Pays",
    score: "Score",
    perf5: "Perf. 5 ans",
    yield: "Rend. div.",
    per: "PER",
    signal: "Signal",
    risk: "Risque",
    confidence: "Confiance",
  },
} as const;
