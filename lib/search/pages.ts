import { AFRICAN_EXCHANGES } from "@/lib/markets/african-exchanges";
import { marketHomeHref, marketIndicesListHref, normalizeExchange } from "@/lib/search/routes";
import type { SiteSearchDocument } from "@/lib/search/types";

interface ExtraRoute {
  slug: string;
  title: string;
  titleEn: string;
  keywords: string[];
}

/**
 * Pages qui existent vraiment sous `/marches/{code}/…`, en plus de la vue
 * d'ensemble et de la liste d'indices (dérivées pour chaque place).
 * Une place absente de cette table a quand même ses pages marché.
 */
const EXTRA_MARKET_ROUTES: Record<string, ExtraRoute[]> = {
  NGX: [
    {
      slug: "screener",
      title: "Screener NGX",
      titleEn: "NGX screener",
      keywords: ["screener", "filtre", "filter", "ngx"],
    },
    {
      slug: "dividendes",
      title: "Dividendes NGX",
      titleEn: "NGX dividends",
      keywords: ["dividendes", "dividende", "dividends", "calendrier", "calendar", "ngx"],
    },
  ],
};

const BRVM_PAGES: SiteSearchDocument[] = [
  {
    id: "page:brvm",
    kind: "page",
    exchange: "BRVM",
    title: "Marché BRVM",
    titleEn: "BRVM market",
    subtitle: "Vue d'ensemble",
    subtitleEn: "Overview",
    href: "/marche",
    keywords: ["brvm", "marche", "market", "overview", "vue d ensemble", "cotations"],
  },
  {
    id: "page:brvm-indices",
    kind: "page",
    exchange: "BRVM",
    title: "Indices BRVM",
    titleEn: "BRVM indices",
    subtitle: "Liste des indices",
    subtitleEn: "Index list",
    href: "/indices",
    keywords: ["indices", "index", "brvm composite", "brvm 30"],
  },
  {
    id: "page:brvm-screener",
    kind: "page",
    exchange: "BRVM",
    title: "Screener BRVM",
    titleEn: "BRVM screener",
    subtitle: "Filtres",
    subtitleEn: "Filters",
    href: "/screener",
    keywords: ["screener", "filtre", "filter", "valorisation"],
  },
  {
    id: "page:brvm-charts",
    kind: "page",
    exchange: "BRVM",
    title: "Graphiques",
    titleEn: "Charts",
    subtitle: "Courbes et indicateurs",
    subtitleEn: "Charts and indicators",
    href: "/graphes",
    keywords: ["graphes", "graphique", "graphiques", "charts", "courbe", "chandeliers"],
  },
  {
    id: "page:brvm-companies",
    kind: "page",
    exchange: "BRVM",
    title: "Sociétés cotées",
    titleEn: "Listed companies",
    subtitle: "BRVM",
    href: "/societes-cotees",
    keywords: ["societes", "societe", "companies", "annuaire", "liste", "brvm"],
  },
  {
    id: "page:brvm-dividends",
    kind: "page",
    exchange: "BRVM",
    title: "Calendrier des dividendes",
    titleEn: "Dividend calendar",
    subtitle: "BRVM",
    href: "/calendrier-dividendes",
    keywords: ["dividendes", "dividende", "dividends", "calendrier", "calendar", "detachement"],
  },
];

const GLOBAL_PAGES: SiteSearchDocument[] = [
  {
    id: "page:home",
    kind: "page",
    title: "Accueil",
    titleEn: "Home",
    subtitle: "OuestBourse",
    href: "/",
    keywords: ["accueil", "home", "ouestbourse"],
  },
  {
    id: "page:portfolio",
    kind: "page",
    title: "Portefeuille",
    titleEn: "Portfolio",
    subtitle: "Positions",
    subtitleEn: "Holdings",
    href: "/portefeuille",
    keywords: ["portefeuille", "portfolio", "positions", "pru"],
  },
  {
    id: "page:portfolio-analysis",
    kind: "page",
    title: "Analyse de portefeuille",
    titleEn: "Portfolio analysis",
    subtitle: "Taille de position",
    subtitleEn: "Position size",
    href: "/portefeuille/analyse",
    keywords: ["analyse", "portefeuille", "taille", "position", "risque", "liquidite", "analysis", "sizing"],
  },
  {
    id: "page:simulation",
    kind: "page",
    title: "Simulation",
    titleEn: "Simulation",
    subtitle: "Rendements",
    subtitleEn: "Returns",
    href: "/simulation",
    keywords: ["simulation", "rendement", "returns"],
  },
  {
    id: "page:tools",
    kind: "page",
    title: "Outils",
    titleEn: "Tools",
    subtitle: "Plateforme",
    subtitleEn: "Platform",
    href: "/outils",
    keywords: ["outils", "tools", "export", "excel"],
  },
  {
    id: "page:position-size",
    kind: "page",
    title: "Taille de position",
    titleEn: "Position size",
    subtitle: "Outils",
    subtitleEn: "Tools",
    href: "/outils/taille-position",
    keywords: ["taille de position", "position sizing", "sizing", "risque", "calculette", "outils", "stop"],
  },
  {
    id: "page:excel",
    kind: "page",
    title: "Export Excel",
    titleEn: "Excel export",
    subtitle: "Outils",
    subtitleEn: "Tools",
    href: "/api/export/excel",
    keywords: ["excel", "export", "telecharger", "download", "outils", "classeur"],
  },
  {
    id: "page:news",
    kind: "page",
    title: "Actualités",
    titleEn: "News",
    href: "/actualites",
    keywords: ["actualites", "actualite", "news", "breves"],
  },
  {
    id: "page:reports",
    kind: "page",
    title: "Rapports",
    titleEn: "Reports",
    href: "/rapports",
    keywords: ["rapports", "reports", "documents", "publications"],
  },
  {
    id: "page:alerts",
    kind: "page",
    title: "Notifications",
    titleEn: "Notifications",
    subtitle: "Alertes",
    subtitleEn: "Alerts",
    href: "/notifications",
    keywords: ["notifications", "alertes", "alerts", "seuil"],
  },
  {
    id: "page:profile",
    kind: "page",
    title: "Profil",
    titleEn: "Profile",
    href: "/profil",
    keywords: ["profil", "profile", "compte", "account"],
  },
  {
    id: "page:settings",
    kind: "page",
    title: "Réglages",
    titleEn: "Settings",
    href: "/reglages",
    keywords: ["reglages", "settings", "preferences"],
  },
  {
    id: "page:legal",
    kind: "page",
    title: "Mentions légales",
    titleEn: "Legal notice",
    href: "/mentions-legales",
    keywords: ["mentions legales", "legal", "rgpd", "disclaimer"],
  },
  {
    id: "page:login",
    kind: "page",
    title: "Connexion",
    titleEn: "Sign in",
    href: "/connexion",
    keywords: ["connexion", "login", "sign in", "compte"],
  },
  {
    id: "page:register",
    kind: "page",
    title: "Inscription",
    titleEn: "Create an account",
    href: "/inscription",
    keywords: ["inscription", "register", "creer un compte", "signup"],
  },
];

function pagesForExchange(exchange: string): SiteSearchDocument[] {
  const code = normalizeExchange(exchange);
  if (code === "BRVM") return BRVM_PAGES;
  const lower = code.toLowerCase();
  const home = marketHomeHref(code);
  const indices = marketIndicesListHref(code);
  const docs: SiteSearchDocument[] = [
    {
      id: `page:${lower}`,
      kind: "page",
      exchange: code,
      title: `Marché ${code}`,
      titleEn: `${code} market`,
      subtitle: "Vue d'ensemble",
      subtitleEn: "Overview",
      href: home,
      keywords: [lower, "marche", "market", "overview", "vue d ensemble"],
    },
    {
      id: `page:${lower}-indices`,
      kind: "page",
      exchange: code,
      title: `Indices ${code}`,
      titleEn: `${code} indices`,
      subtitle: "Liste des indices",
      subtitleEn: "Index list",
      href: indices,
      keywords: [lower, "indices", "index"],
    },
  ];
  for (const extra of EXTRA_MARKET_ROUTES[code] ?? []) {
    docs.push({
      id: `page:${lower}-${extra.slug}`,
      kind: "page",
      exchange: code,
      title: extra.title,
      titleEn: extra.titleEn,
      subtitle: code,
      href: `${home}/${extra.slug}`,
      keywords: extra.keywords,
    });
  }
  return docs;
}

function dedupe(docs: SiteSearchDocument[]): SiteSearchDocument[] {
  const seen = new Set<string>();
  const out: SiteSearchDocument[] = [];
  for (const doc of docs) {
    if (seen.has(doc.href) || seen.has(doc.id)) continue;
    seen.add(doc.href);
    seen.add(doc.id);
    out.push(doc);
  }
  return out;
}

/**
 * Pages statiques + une entrée par place.
 * `exchanges` vient des sociétés et des indices réellement en base :
 * une place inconnue du catalogue africain est quand même proposée.
 */
export function pageDocuments(exchanges: string[] = []): SiteSearchDocument[] {
  const codes = new Set<string>(AFRICAN_EXCHANGES.map((exchange) => exchange.code));
  for (const exchange of exchanges) codes.add(normalizeExchange(exchange));
  const docs: SiteSearchDocument[] = [];
  for (const code of [...codes].sort((a, b) => a.localeCompare(b, "fr"))) {
    docs.push(...pagesForExchange(code));
  }
  docs.push(...GLOBAL_PAGES);
  return dedupe(docs);
}
