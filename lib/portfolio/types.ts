/**
 * Quatre cadres pédagogiques de portefeuille BRVM.
 * Contenu produit : documents « Types de portefeuille » (FR).
 * Ce module ne calcule aucun score — il oriente présentation, hypothèses
 * de simulation et liens Éducation.
 */

export const PORTFOLIO_TYPES = ["CROISSANCE", "RENTE", "TRADING", "CROISSANCE_MAX"] as const;

export type PortfolioTypeId = (typeof PORTFOLIO_TYPES)[number];

export function isPortfolioType(value: unknown): value is PortfolioTypeId {
  return typeof value === "string" && (PORTFOLIO_TYPES as readonly string[]).includes(value);
}

export function parsePortfolioType(value: unknown): PortfolioTypeId | null {
  return isPortfolioType(value) ? value : null;
}

export const PORTFOLIO_TYPE_THEME_SLUG = "types-de-portefeuille";

export const PORTFOLIO_TYPE_EDUCATION_HREF = `/education/${PORTFOLIO_TYPE_THEME_SLUG}`;

export interface PortfolioTypeSimulationDefaults {
  years: string;
  rate: string;
  fees: string;
  spread: string;
  contribution: string;
  frequency: "mensuel" | "trimestriel" | "annuel";
  rateLabel: string;
  gainLabel: string;
  riskTitle: string;
  riskBody: string;
}

export interface PortfolioTypeAnalysisHint {
  lead: string;
  body: string;
  warning: string | null;
  /** Slugs Éducation à mettre en avant (sans inventer de métriques). */
  emphasisSlugs: string[];
}

export interface PortfolioTypeMeta {
  id: PortfolioTypeId;
  label: string;
  shortBlurb: string;
  objective: string;
  horizon: string;
  risk: string;
  method: string;
  educationSlug: string;
  educationHref: string;
  simulation: PortfolioTypeSimulationDefaults;
  analysis: PortfolioTypeAnalysisHint;
}

const THEME = PORTFOLIO_TYPE_EDUCATION_HREF;

export const PORTFOLIO_TYPE_META: Record<PortfolioTypeId, PortfolioTypeMeta> = {
  CROISSANCE: {
    id: "CROISSANCE",
    label: "Croissance",
    shortBlurb:
      "Valoriser le capital sur le long terme (≥ 5 ans). Le dividende est secondaire si l’entreprise réinvestit efficacement.",
    objective: "Augmenter la valeur du capital",
    horizon: "Long terme (≥ 5 ans)",
    risk: "Moyen à élevé",
    method: "Analyse fondamentale",
    educationSlug: "portefeuille-croissance",
    educationHref: `${THEME}/portefeuille-croissance`,
    simulation: {
      years: "10",
      rate: "8",
      fees: "0.5",
      spread: "4",
      contribution: "50000",
      frequency: "mensuel",
      rateLabel: "Rendement annuel hypothétique — valorisation du capital (%)",
      gainLabel: "Plus-value estimée (hors dividendes isolés)",
      riskTitle: "Lecture Croissance",
      riskBody:
        "Horizon long : une baisse de cours n’invalide pas à elle seule le scénario. Les hypothèses de rendement ne sont pas un objectif BRVM — c’est un outil pédagogique. Les frais restent à intégrer, même si les opérations sont peu fréquentes.",
    },
    analysis: {
      lead: "Cadre Croissance — capital à long terme",
      body: "Le dividende est secondaire. Vérifiez que la hausse du cours repose sur les bénéfices, les perspectives et une situation financière solide — pas seulement sur le prix. Une baisse de cours n’est pas, à elle seule, une raison de vendre : la question est « les fondamentaux ont-ils changé ? ».",
      warning: null,
      emphasisSlugs: [
        "portefeuille-croissance",
        "chiffre-d-affaires",
        "score-fondamental",
        "per-price-earnings-ratio",
        "horizons-c-m-l",
      ],
    },
  },
  RENTE: {
    id: "RENTE",
    label: "Rente",
    shortBlurb:
      "Revenus réguliers (dividendes, coupons, liquidités). Stabilité et durabilité plutôt que plus-value rapide.",
    objective: "Générer des revenus réguliers",
    horizon: "Moyen / long terme",
    risk: "Faible à moyen",
    method: "Dividendes, obligations, stabilité",
    educationSlug: "portefeuille-rente",
    educationHref: `${THEME}/portefeuille-rente`,
    simulation: {
      years: "15",
      rate: "5",
      fees: "0.4",
      spread: "2",
      contribution: "40000",
      frequency: "mensuel",
      rateLabel: "Rendement total hypothétique (% / an, revenus réinvestis)",
      gainLabel: "Écart vs. capital versé (revenus + variation)",
      riskTitle: "Lecture Rente",
      riskBody:
        "Un rendement courant élevé n’est pas une performance si le capital recule davantage. Les pourcentages saisis sont des hypothèses pédagogiques, pas un coupon BRVM garanti. Diversifiez les sources de revenus (titres, secteurs, échéances).",
    },
    analysis: {
      lead: "Cadre Rente — revenus et stabilité",
      body: "Ne retenez pas uniquement le rendement le plus élevé : un dividende généreux peut être exceptionnel, ou refléter un cours fortement déprécié. Suivez la régularité, le cash et l’endettement. Le rendement total (revenus + variation de capital) complète le rendement courant.",
      warning: null,
      emphasisSlugs: [
        "portefeuille-rente",
        "rendement-du-dividende",
        "dividende",
        "sante-financiere",
        "gestion-du-risque",
      ],
    },
  },
  TRADING: {
    id: "TRADING",
    label: "Trading",
    shortBlurb:
      "Variations de cours à court ou moyen terme, avec règles écrites, frais et liquidité. Risque élevé.",
    objective: "Profiter des mouvements de cours",
    horizon: "Court / moyen terme",
    risk: "Élevé",
    method: "Règles d’entrée, de sortie et de gestion du risque",
    educationSlug: "portefeuille-trading",
    educationHref: `${THEME}/portefeuille-trading`,
    simulation: {
      years: "3",
      rate: "6",
      fees: "2",
      spread: "8",
      contribution: "0",
      frequency: "mensuel",
      rateLabel: "Hypothèse nette après frais (% / an) — pas un P&L de trading",
      gainLabel: "Résultat illustratif après frais saisis",
      riskTitle: "Lecture Trading — risque élevé",
      riskBody:
        "Cette courbe n’est pas un journal de trades. À la BRVM, la liquidité peut manquer et les frais (courtage, marché, DC/BR, taxes, écart achat/vente) mangent le scénario. Une opération n’est intéressante que si le gain potentiel les dépasse suffisamment. Ne risquez pas plus de 0,5 % à 1 % du capital par opération.",
    },
    analysis: {
      lead: "Cadre Trading — règles, frais, liquidité",
      body: "Le trading ne repose pas principalement sur le dividende ou la valeur intrinsèque, mais sur tendance, volumes, supports/résistances, annonces et liquidité. Avant chaque opération : entrée, raison, invalidation, objectif, durée max, taille. Une baisse de cours ne transforme pas un trade en ligne de long terme.",
      warning:
        "Risque élevé. Certaines valeurs BRVM sont peu échangées : vous pouvez ne pas trouver de contrepartie au prix souhaité. Repère : titres du BRVM-30 et bulletins officiels de la cote. Intégrez les frais de l’avis d’opéré.",
      emphasisSlugs: [
        "portefeuille-trading",
        "taille-de-position",
        "liquidite",
        "gestion-du-risque",
        "stop-loss-brvm",
      ],
    },
  },
  CROISSANCE_MAX: {
    id: "CROISSANCE_MAX",
    label: "Croissance Max",
    shortBlurb:
      "Mélange organisé : poche Croissance + poche Rente + poche Trading + liquidités, avec rééquilibrage.",
    objective: "Optimiser la croissance globale",
    horizon: "Tous horizons",
    risk: "Moyen à élevé",
    method: "Combinaison organisée des trois poches",
    educationSlug: "portefeuille-croissance-max",
    educationHref: `${THEME}/portefeuille-croissance-max`,
    simulation: {
      years: "10",
      rate: "7",
      fees: "0.8",
      spread: "5",
      contribution: "50000",
      frequency: "mensuel",
      rateLabel: "Rendement total hypothétique du mix (% / an)",
      gainLabel: "Résultat net illustratif (après frais saisis)",
      riskTitle: "Lecture Croissance Max",
      riskBody:
        "La simulation agrège un mix ; elle ne sépare pas les poches. En réel, tenez un suivi distinct (Croissance / Rente / Trading / liquidités) et rééquilibrez tous les six mois ou une fois par an. Les allocations du guide sont des modèles pédagogiques, pas une garantie de rendement.",
    },
    analysis: {
      lead: "Cadre Croissance Max — poches séparées",
      body: "Trois moteurs : croissance long terme, dividendes/rente, trading tactique — plus une réserve de liquidités. La principale erreur est de mélanger les règles : une action achetée pour le trading ne doit pas devenir automatiquement une action de long terme parce que son cours baisse.",
      warning: null,
      emphasisSlugs: [
        "portefeuille-croissance-max",
        "croissance-max-structure-reequilibrage",
        "gestion-du-risque",
        "taille-de-position",
        "rendement-du-dividende",
      ],
    },
  },
};

export const PORTFOLIO_TYPE_LIST: PortfolioTypeMeta[] = PORTFOLIO_TYPES.map(
  (id) => PORTFOLIO_TYPE_META[id]
);

export function portfolioTypeEducationHref(type: PortfolioTypeId | null): string {
  if (!type) return PORTFOLIO_TYPE_EDUCATION_HREF;
  return PORTFOLIO_TYPE_META[type].educationHref;
}
