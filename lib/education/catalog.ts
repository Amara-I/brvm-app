// Base éducative OuestBourse — termes BRVM + notions plateforme.
// Organisation par catégories (Bases / Analyse / Risques / Application).
// Orientation : guides BRVM + enrichissements produit.

import { TERM_ENRICHMENTS } from "./term-enrichments";

export type EducationLevel = "debutant" | "intermediaire" | "avance";

export type EducationIllustrationId =
  | "rsi"
  | "macd"
  | "sma-cross"
  | "bollinger"
  | "per-schema"
  | "parcours-analyse"
  | "nav-app";

export interface EducationCategory {
  slug: string;
  title: string;
  blurb: string;
  order: number;
}

export interface EducationTheme {
  slug: string;
  title: string;
  blurb: string;
  categorySlug: string;
}

export interface EducationSource {
  title: string;
  url: string;
}

export interface EducationTerm {
  slug: string;
  title: string;
  level: EducationLevel;
  themeSlug: string;
  definition: string;
  /** Développement pédagogique (formule, lecture, limites) — optionnel. */
  details?: string;
  example: string;
  synonyms: string[];
  resourceUrl: string | null;
  tip: string | null;
  source: "guide" | "plateforme";
  illustration?: EducationIllustrationId;
  /** Références externes citées (Investopedia, StockCharts, etc.). */
  sources?: EducationSource[];
  /** Ordre pédagogique dans le thème (plus petit = plus tôt). */
  sortOrder?: number;
  /** Lien interne vers un outil (calculette, fiche…). */
  ctaHref?: string;
  ctaLabel?: string;
  /** Fiches à proposer en bas de page (« Pour aller plus loin »). */
  relatedSlugs?: string[];
}

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

export const EDUCATION_CATEGORIES: EducationCategory[] = [
  {
    slug: "bases",
    title: "Bases",
    blurb: "Le vocabulaire essentiel pour lire un marché et une fiche titre.",
    order: 1,
  },
  {
    slug: "analyse",
    title: "Analyse",
    blurb:
      "Pourquoi et comment analyser une action : fondamentale, valorisation, technique adaptée à la BRVM.",
    order: 2,
  },
  {
    slug: "risques",
    title: "Risques",
    blurb: "Liquidité, volatilité, taille de position et mesures pour lire le risque sans le sous-estimer.",
    order: 3,
  },
  {
    slug: "application",
    title: "Application",
    blurb: "Où trouver quoi dans OuestBourse : menus, signaux, graphes et portefeuille.",
    order: 4,
  },
];

export const EDUCATION_THEMES: EducationTheme[] = [
  {
    slug: "marche",
    title: "Marché & cotation",
    blurb: "Bourse, titres, cours, indices et fonctionnement BRVM / UEMOA.",
    categorySlug: "bases",
  },
  {
    slug: "rendement",
    title: "Dividendes & rendement",
    blurb: "Dividendes et rendement pour l'actionnaire.",
    categorySlug: "bases",
  },
  {
    slug: "pourquoi-analyser",
    title: "Pourquoi analyser",
    blurb: "Objectifs, limites et pièges d'une analyse — sans conseil d'investissement.",
    categorySlug: "analyse",
  },
  {
    slug: "comment-analyser",
    title: "Comment analyser",
    blurb: "Parcours pas à pas : contexte, fondamentaux, valorisation, technique, signal.",
    categorySlug: "analyse",
  },
  {
    slug: "fondamentale",
    title: "Analyse fondamentale",
    blurb: "Comptes, marges, BPA et lecture des résultats.",
    categorySlug: "analyse",
  },
  {
    slug: "valorisation",
    title: "Valorisation",
    blurb: "PER, capitalisation et modèles de valeur.",
    categorySlug: "analyse",
  },
  {
    slug: "rentabilite",
    title: "Rentabilité",
    blurb: "ROE, ROIC et rendement des capitaux.",
    categorySlug: "analyse",
  },
  {
    slug: "technique",
    title: "Technique adaptée BRVM",
    blurb: "Moyennes, RSI, MACD, Bollinger, chandeliers — indicateurs utiles sur séries liquides.",
    categorySlug: "analyse",
  },
  {
    slug: "technique-avancee",
    title: "Indicateurs avancés (peu adaptés)",
    blurb:
      "Ichimoku, Elliott, Fibonacci, ADX, Stochastique, Williams %R, CCI — à manier avec prudence sur la BRVM.",
    categorySlug: "analyse",
  },
  {
    slug: "strategies",
    title: "Stratégies",
    blurb: "Portefeuille, levier et postures d'investissement.",
    categorySlug: "analyse",
  },
  {
    slug: "risques",
    title: "Mesures de risque",
    blurb: "Liquidité, volatilité, VaR, drawdown et lecture du risque.",
    categorySlug: "risques",
  },
  {
    slug: "taille-position",
    title: "Taille de position",
    blurb:
      "Dimensionner une position BRVM selon un risque de perte acceptable, le cours d’entrée et le stop — formule, exemples et alerte.",
    categorySlug: "risques",
  },
  {
    slug: "navigation-app",
    title: "Menus & navigation",
    blurb: "Où cliquer : Accueil, Marché, Screener, Graphes, fiches, Portefeuille, Alertes.",
    categorySlug: "application",
  },
  {
    slug: "plateforme",
    title: "Signaux & données OuestBourse",
    blurb: "Signaux, scores, N/D, sources et outils de la plateforme.",
    categorySlug: "application",
  },
  {
    slug: "portefeuille-suivi",
    title: "Portefeuille & suivi",
    blurb: "PRU, plus-value latente, YTD, allocation sectorielle et conseils sur vos positions.",
    categorySlug: "application",
  },
];

export const EDUCATION_TERMS: EducationTerm[] = [
  {
    "slug": "action",
    "title": "Action",
    "level": "debutant",
    "themeSlug": "marche",
    "definition": "Titre représentant une fraction du capital d’une société et donnant potentiellement droit à un dividende et à un vote.",
    "example": "Sur OuestBourse, ouvrez la fiche SNTS (Sonatel) : le cours, le signal et l'historique illustrent ce qu'est une action cotée à la BRVM.",
    "synonyms": [
      "Titre",
      "Valeur mobilière"
    ],
    "resourceUrl": "https://www.brvm.org",
    "tip": "Lire la fiche de la valeur et les états financiers avant toute décision.",
    "source": "guide"
  },
  {
    "slug": "dividende",
    "title": "Dividende",
    "level": "debutant",
    "themeSlug": "rendement",
    "definition": "Part du bénéfice distribuée aux actionnaires, selon la décision de l’assemblée générale.",
    "example": "Le calendrier des dividendes OuestBourse liste dates de détachement et montants (ex. ETIT, SNTS) — toujours vérifiés côté sources officielles.",
    "synonyms": [
      "Distribution",
      "Revenu de l’actionnaire"
    ],
    "resourceUrl": "https://www.brvm.org/fr/entreprises-cotees",
    "tip": "Le dividende n’est jamais garanti : il dépend des résultats et de la décision sociale.",
    "source": "guide"
  },
  {
    "slug": "bourse",
    "title": "Bourse",
    "level": "debutant",
    "themeSlug": "marche",
    "definition": "Marché organisé où s’échangent des instruments financiers selon des règles communes.",
    "example": "La BRVM centralise la négociation et la diffusion des informations relatives aux titres cotés dans l’UEMOA.",
    "synonyms": [
      "Marché boursier",
      "Marché organisé"
    ],
    "resourceUrl": "https://www.brvm.org",
    "tip": "Distinguer la bourse (infrastructure et règles) de l’intermédiaire qui transmet l’ordre.",
    "source": "guide"
  },
  {
    "slug": "marche-primaire",
    "title": "Marché primaire",
    "level": "debutant",
    "themeSlug": "marche",
    "definition": "Marché où des titres sont émis pour la première fois afin de financer l’émetteur.",
    "example": "Lors d’une introduction ou d’une émission nouvelle sur la BRVM, les investisseurs souscrivent auprès des intermédiaires habilités.",
    "synonyms": [
      "Émission",
      "Placement initial"
    ],
    "resourceUrl": "https://www.brvm.org",
    "tip": "L’argent de la souscription va à l’émetteur, contrairement à une revente entre investisseurs.",
    "source": "guide"
  },
  {
    "slug": "marche-secondaire",
    "title": "Marché secondaire",
    "level": "debutant",
    "themeSlug": "marche",
    "definition": "Marché où des investisseurs s’échangent des titres déjà émis.",
    "example": "Un client revend une action BRVM à un autre investisseur via son SGI ; le prix résulte des ordres disponibles.",
    "synonyms": [
      "Marché de revente",
      "Négociation"
    ],
    "resourceUrl": "https://www.brvm.org",
    "tip": "C’est le marché secondaire qui permet généralement de retrouver de la liquidité.",
    "source": "guide"
  },
  {
    "slug": "indice-boursier",
    "title": "Indice boursier",
    "level": "debutant",
    "themeSlug": "marche",
    "definition": "Indicateur statistique mesurant l’évolution d’un panier de valeurs selon une méthode donnée.",
    "example": "L’investisseur compare la performance de son portefeuille à un indice de référence de la BRVM.",
    "synonyms": [
      "Benchmark",
      "Indice de marché"
    ],
    "resourceUrl": "https://www.brvm.org/fr/indices",
    "tip": "Toujours vérifier la composition, la pondération et la date de base de l’indice.",
    "source": "guide"
  },
  {
    "slug": "cours",
    "title": "Cours",
    "level": "debutant",
    "themeSlug": "marche",
    "definition": "Prix auquel un titre s’échange à un instant ou à une séance donnée.",
    "example": "Sur /marche et chaque fiche société, le cours affiché est le dernier cours canonique (souvent BRVM officiel après ingestion).",
    "synonyms": [
      "Prix",
      "Cotations"
    ],
    "resourceUrl": "https://www.brvm.org/fr/cours",
    "tip": "Un cours affiché n’est pas nécessairement le prix auquel un ordre sera exécuté.",
    "source": "guide"
  },
  {
    "slug": "liquidite",
    "title": "Liquidité",
    "level": "debutant",
    "themeSlug": "risques",
    "definition": "Facilité avec laquelle un titre peut être acheté ou vendu sans modifier fortement son prix.",
    "example": "Certaines valeurs BRVM « minces » (peu d'échanges) affichent encore N/D sur volumes — la liquidité reste un critère de risque.",
    "synonyms": [
      "Négociabilité",
      "Profondeur du marché",
      "Risque de liquidité"
    ],
    "resourceUrl": "https://www.brvm.org",
    "tip": "La liquidité peut varier fortement selon les séances et les valeurs.",
    "source": "guide"
  },
  {
    "slug": "volatilite",
    "title": "Volatilité",
    "level": "debutant",
    "themeSlug": "risques",
    "definition": "Amplitude et fréquence des variations du prix d’un titre ou d’un indice.",
    "example": "Le score de risque OuestBourse utilise la volatilité historique des clôtures quand la série est assez dense.",
    "synonyms": [
      "Variabilité",
      "Fluctuation"
    ],
    "resourceUrl": "https://www.amf-umoa.org",
    "tip": "Volatilité élevée signifie incertitude plus grande, pas automatiquement rendement supérieur.",
    "source": "guide"
  },
  {
    "slug": "marche-haussier-bull-market",
    "title": "Marché haussier (bull market)",
    "level": "debutant",
    "themeSlug": "marche",
    "definition": "Période caractérisée par une tendance générale et durable à la hausse des cours.",
    "example": "Une progression prolongée de l’indice BRVM, accompagnée d’achats généralisés, peut être qualifiée de marché haussier.",
    "synonyms": [
      "Tendance haussière",
      "Bull"
    ],
    "resourceUrl": "https://www.brvm.org/fr/indices",
    "tip": "La qualification dépend de l’horizon et de l’indicateur retenu.",
    "source": "guide"
  },
  {
    "slug": "marche-baissier-bear-market",
    "title": "Marché baissier (bear market)",
    "level": "debutant",
    "themeSlug": "marche",
    "definition": "Période caractérisée par une tendance générale à la baisse et un pessimisme dominant.",
    "example": "Une baisse prolongée de l’indice et de nombreuses valeurs BRVM correspond à un environnement baissier.",
    "synonyms": [
      "Tendance baissière",
      "Bear"
    ],
    "resourceUrl": "https://www.brvm.org/fr/indices",
    "tip": "Éviter de confondre correction ponctuelle et marché baissier durable.",
    "source": "guide"
  },
  {
    "slug": "ordre-de-bourse",
    "title": "Ordre de bourse",
    "level": "debutant",
    "themeSlug": "marche",
    "definition": "Instruction donnée à un intermédiaire pour acheter ou vendre un titre selon des conditions précises.",
    "example": "Un investisseur transmet un ordre à cours limité sur une action cotée à la BRVM via sa SGI.",
    "synonyms": [
      "Instruction",
      "Ordre d’achat/vente"
    ],
    "resourceUrl": "https://www.brvm.org",
    "tip": "Préciser le sens, la quantité, le prix et la durée de validité.",
    "source": "guide"
  },
  {
    "slug": "portefeuille",
    "title": "Portefeuille",
    "level": "debutant",
    "themeSlug": "strategies",
    "definition": "Ensemble des placements détenus par un investisseur.",
    "example": "La page /portefeuille calcule valeur, plus-value latente, allocation sectorielle et YTD sur vos positions.",
    "synonyms": [
      "Avoirs",
      "Patrimoine financier"
    ],
    "resourceUrl": "https://www.amf-umoa.org",
    "tip": "La diversification réduit le risque spécifique mais n’élimine pas le risque de marché.",
    "source": "guide"
  },
  {
    "slug": "risque",
    "title": "Risque",
    "level": "debutant",
    "themeSlug": "risques",
    "definition": "Possibilité qu’un résultat réel diffère du résultat attendu, y compris une perte.",
    "example": "Le détenteur d’une action BRVM supporte le risque de baisse du cours, de liquidité et de crédit de l’émetteur.",
    "synonyms": [
      "Incertitude",
      "Exposition",
      "Risque d'investissement"
    ],
    "resourceUrl": "https://www.amf-umoa.org",
    "tip": "Un rendement potentiel doit toujours être lu avec les risques associés. Sur OuestBourse, le panneau « Gestion du risque » de la fiche titre détaille score, piliers et mesures (volatilité, VaR, drawdown).",
    "source": "guide",
    relatedSlugs: ["gestion-du-risque", "volatilite", "liquidite", "taille-de-position"],
  },
  {
    "slug": "chiffre-d-affaires",
    "title": "Chiffre d’affaires",
    "level": "intermediaire",
    "themeSlug": "fondamentale",
    "definition": "Montant des ventes réalisées par une entreprise sur une période.",
    "example": "L’investisseur compare la croissance du chiffre d’affaires publiée par un émetteur BRVM avec celle de son secteur.",
    "synonyms": [
      "Revenus",
      "Ventes"
    ],
    "resourceUrl": "https://www.brvm.org/fr/informations-financieres",
    "tip": "La croissance du chiffre d’affaires ne garantit pas une croissance du bénéfice.",
    "source": "guide"
  },
  {
    "slug": "benefice-net",
    "title": "Bénéfice net",
    "level": "intermediaire",
    "themeSlug": "fondamentale",
    "definition": "Résultat restant après déduction des charges, impôts et éléments financiers selon les comptes publiés.",
    "example": "Le bénéfice net annuel d’un émetteur BRVM sert de base à l’analyse du résultat par action et du dividende.",
    "synonyms": [
      "Résultat net",
      "Profit net"
    ],
    "resourceUrl": "https://www.brvm.org/fr/informations-financieres",
    "tip": "Lire les notes annexes pour distinguer éléments récurrents et exceptionnels.",
    "source": "guide"
  },
  {
    "slug": "marge-beneficiaire",
    "title": "Marge bénéficiaire",
    "level": "intermediaire",
    "themeSlug": "fondamentale",
    "definition": "Bénéfice rapporté au chiffre d’affaires, généralement en pourcentage.",
    "example": "Marge nette = bénéfice net / chiffre d’affaires ; elle permet de comparer l’efficacité de sociétés BRVM de taille différente.",
    "synonyms": [
      "Marge nette",
      "Rentabilité des ventes"
    ],
    "resourceUrl": "https://www.brvm.org/fr/informations-financieres",
    "tip": "Comparer des entreprises de secteurs comparables.",
    "source": "guide"
  },
  {
    "slug": "per-price-earnings-ratio",
    "title": "PER (Price/Earnings Ratio)",
    "level": "intermediaire",
    "themeSlug": "valorisation",
    "definition": "Cours de l’action divisé par le bénéfice par action.",
    "example": "Dans le screener et la fiche, le PER alimente le score fondamental : un PER extrême est signalé comme facteur négatif.",
    "synonyms": [
      "P/E",
      "Multiple de bénéfices"
    ],
    "resourceUrl": "https://www.brvm.org",
    "tip": "Un PER bas peut signaler une décote, mais aussi des perspectives ou risques plus faibles.",
    "source": "guide",
    illustration: "per-schema",
  },
  {
    "slug": "bpa-eps",
    "title": "BPA / EPS",
    "level": "intermediaire",
    "themeSlug": "fondamentale",
    "definition": "Bénéfice attribuable à chaque action en circulation.",
    "example": "BPA = bénéfice net attribuable / nombre moyen d’actions ; il permet de comparer le résultat par titre d’un émetteur BRVM.",
    "synonyms": [
      "Bénéfice par action",
      "Earnings per share"
    ],
    "resourceUrl": "https://www.brvm.org/fr/informations-financieres",
    "tip": "Préciser si le BPA est de base ou dilué.",
    "source": "guide"
  },
  {
    "slug": "roe",
    "title": "ROE",
    "level": "intermediaire",
    "themeSlug": "rentabilite",
    "definition": "Rentabilité des capitaux propres : bénéfice net rapporté aux capitaux propres moyens.",
    "example": "Un ROE de 15 % signifie qu’un émetteur BRVM a généré 15 FCFA de résultat pour 100 FCFA de capitaux propres moyens.",
    "synonyms": [
      "Rentabilité financière",
      "Return on equity"
    ],
    "resourceUrl": "https://www.brvm.org/fr/informations-financieres",
    "tip": "Un ROE élevé peut aussi provenir d’un endettement important.",
    "source": "guide"
  },
  {
    "slug": "dette-equite",
    "title": "Dette / Équité",
    "level": "intermediaire",
    "themeSlug": "risques",
    "definition": "Ratio comparant les dettes financières aux capitaux propres.",
    "example": "L’analyse du levier d’un émetteur BRVM aide à évaluer sa sensibilité aux taux et au remboursement.",
    "synonyms": [
      "D/E",
      "Levier financier"
    ],
    "resourceUrl": "https://www.brvm.org/fr/informations-financieres",
    "tip": "Comparer le ratio aux pratiques du secteur et à la maturité des dettes.",
    "source": "guide"
  },
  {
    "slug": "capex-opex",
    "title": "CAPEX / OPEX",
    "level": "intermediaire",
    "themeSlug": "fondamentale",
    "definition": "CAPEX : dépenses d’investissement ; OPEX : dépenses courantes d’exploitation.",
    "example": "Une société BRVM peut augmenter ses CAPEX pour ouvrir une usine, tandis que ses OPEX couvrent salaires, énergie et maintenance.",
    "synonyms": [
      "Investissements",
      "Charges d’exploitation"
    ],
    "resourceUrl": "https://www.brvm.org/fr/informations-financieres",
    "tip": "Les CAPEX sortent souvent en trésorerie avant de produire des revenus.",
    "source": "guide"
  },
  {
    "slug": "rendement-du-dividende",
    "title": "Rendement du dividende",
    "level": "intermediaire",
    "themeSlug": "rendement",
    "definition": "Dividende annuel par action divisé par le cours de l’action.",
    "example": "Colonne rendement du screener et métrique clé du score fondamental (plafonnée pour éviter les extrêmes).",
    "synonyms": [
      "Dividend yield",
      "Taux de distribution au prix"
    ],
    "resourceUrl": "https://www.brvm.org",
    "tip": "Un rendement élevé peut refléter une baisse du cours ou un dividende non récurrent.",
    "source": "guide"
  },
  {
    "slug": "date-ex-dividende",
    "title": "Date ex-dividende",
    "level": "intermediaire",
    "themeSlug": "marche",
    "definition": "Date à partir de laquelle l’acheteur du titre n’a plus droit au dividende annoncé.",
    "example": "L’investisseur vérifie le calendrier publié par l’émetteur et la BRVM avant d’acheter autour de la date ex-dividende.",
    "synonyms": [
      "Ex-date",
      "Détachement"
    ],
    "resourceUrl": "https://www.brvm.org",
    "tip": "Les règles et dates officielles publiées priment sur les calendriers informels.",
    "source": "guide"
  },
  {
    "slug": "moyenne-mobile",
    "title": "Moyenne mobile",
    "level": "intermediaire",
    "themeSlug": "technique",
    "definition": "Moyenne des cours sur un nombre donné de périodes, recalculée au fil du temps.",
    "example": "Sur /graphes, activez SMA 10, 20, 50 ou 200 : la moyenne est calculée avec lookback sur l'historique, puis affichée sur la période choisie.",
    "synonyms": [
      "Moving average",
      "MM"
    ],
    "resourceUrl": "https://www.brvm.org/fr/cours",
    "tip": "Indicateur retardé : il ne prédit pas à lui seul les cours futurs.",
    "source": "guide",
    illustration: "sma-cross",
  },
  {
    slug: "rsi",
    title: "RSI",
    level: "intermediaire",
    themeSlug: "technique",
    definition:
      "Oscillateur de momentum (0–100) qui compare l’ampleur moyenne des hausses et des baisses de cours sur une fenêtre donnée. Créé par J. Welles Wilder Jr. et publié en 1978 dans New Concepts in Technical Trading Systems, il sert surtout à repérer des zones de surachat / survente et des changements de dynamique — pas à prédire un prix cible.",
    details: [
      "Formule (présentation usuelle, documentée par Investopedia et StockCharts) : RSI = 100 − [100 / (1 + RS)], avec RS = moyenne des hausses ÷ moyenne des baisses sur N périodes. Wilder recommande N = 14 ; les pertes sont comptées en valeur positive. Après la première moyenne simple, Wilder applique un lissage spécifique (moyenne de Wilder), devenu le standard des plateformes.",
      "Lecture classique (seuils de Wilder, repris par Fidelity / StockCharts) : au-dessus de ~70, zone de surachat ; en dessous de ~30, zone de survente. Entre 30 et 70, zone souvent jugée neutre ; le niveau 50 marque l’équilibre relatif des forces haussières et baissières. Certains traders utilisent 80/20 sur marchés très volatils pour filtrer le bruit.",
      "Limite importante : en tendance forte, le RSI peut rester longtemps au-dessus de 70 ou sous 30 (StockCharts, Investopedia). Un seuil franchi n’est donc pas un signal d’achat/vente automatique. Lectures complémentaires : divergences prix/RSI (ex. prix en plus haut, RSI en plus bas = divergence baissière), « failure swings » de Wilder, et croisement de la ligne médiane 50.",
      "Horizon (Investopedia) : une période plus courte (ex. 5–9) rend l’indicateur plus sensible (plus de bruit, usage court terme) ; une période plus longue (ex. 21–30) lisse davantage et convient mieux à une lecture de moyen / long terme. Sur OuestBourse, le workbench et le score technique court terme utilisent RSI(14), le paramètre historique de Wilder.",
      "Sur la BRVM, la liquidité limitée de certains titres peut produire des écarts de cours irréguliers : le RSI reste utile en complément (cours + volumes + fondamentaux), jamais comme règle isolée.",
    ].join("\n\n"),
    example:
      "Sur /graphes, activez « RSI 14 » sous le prix : vous voyez la courbe 0–100 avec les repères ~30 / ~70. La même fenêtre RSI(14) alimente aussi la lecture technique court terme du score OuestBourse (zone de survente / surachat / neutre).",
    synonyms: [
      "Relative Strength Index",
      "Indice de force relative",
      "RSI de Wilder",
    ],
    resourceUrl: "https://www.investopedia.com/terms/r/rsi.asp",
    tip:
      "Les seuils 30/70 sont des repères historiques de Wilder (1978), pas des règles universelles. En tendance haussière soutenue, un RSI > 70 peut simplement confirmer un fort momentum ; croisez toujours avec la tendance, le volume et le contexte fondamental. Voir les sources ci-dessous pour la formule et les limites documentées.",
    source: "guide",
    illustration: "rsi",
    sources: [
      {
        title: "Investopedia — Relative Strength Index (RSI) : définition, formule, limites",
        url: "https://www.investopedia.com/terms/r/rsi.asp",
      },
      {
        title: "StockCharts School — Relative Strength Index (RSI) : seuils, divergences, failure swings",
        url: "https://school.stockcharts.com/doku.php?id=technical_indicators:relative_strength_index_rsi",
      },
      {
        title: "Fidelity — RSI Indicator Guide : surachat/survente et tendances fortes",
        url: "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/RSI",
      },
      {
        title: "Wikipedia — Relative strength index (origine Wilder, 1978)",
        url: "https://en.wikipedia.org/wiki/Relative_strength_index",
      },
    ],
  },
  {
    "slug": "macd",
    "title": "MACD",
    "level": "intermediaire",
    "themeSlug": "technique",
    "definition": "Indicateur de momentum fondé sur l’écart entre deux moyennes mobiles exponentielles.",
    "example": "Disponible en overlay /graphes ; l'histogramme MACD entre aussi dans la lecture technique du signal.",
    "synonyms": [
      "Moving Average Convergence Divergence",
      "Convergence-divergence"
    ],
    "resourceUrl": "https://www.brvm.org/fr/cours",
    "tip": "Les signaux peuvent être retardés et produire de faux croisements.",
    "source": "guide",
    illustration: "macd",
  },
  {
    "slug": "support-et-resistance",
    "title": "Support et résistance",
    "level": "intermediaire",
    "themeSlug": "technique",
    "definition": "Zones où la demande ou l’offre ont historiquement freiné un mouvement de prix.",
    "example": "Les anciens plus-bas et plus-hauts d’une action BRVM peuvent servir de zones de support ou de résistance.",
    "synonyms": [
      "Niveaux techniques",
      "Plancher/plafond"
    ],
    "resourceUrl": "https://www.brvm.org/fr/cours",
    "tip": "Parler de zones plutôt que de niveaux parfaitement exacts.",
    "source": "guide"
  },
  {
    "slug": "capitalisation-boursiere",
    "title": "Capitalisation boursière",
    "level": "intermediaire",
    "themeSlug": "valorisation",
    "definition": "Valeur de marché d’une société : cours multiplié par le nombre d’actions.",
    "example": "Affichée en Mds FCFA sur les fiches ; 0 en base = N/D à l'écran (jamais inventé).",
    "synonyms": [
      "Market cap",
      "Valeur de marché"
    ],
    "resourceUrl": "https://www.brvm.org/fr/entreprises-cotees",
    "tip": "Elle évolue avec le cours et ne mesure pas directement la valeur intrinsèque.",
    "source": "guide"
  },
  {
    "slug": "roic",
    "title": "ROIC",
    "level": "avance",
    "themeSlug": "rentabilite",
    "definition": "Rentabilité des capitaux investis : résultat opérationnel après impôt rapporté au capital investi.",
    "example": "Comparer le ROIC d’un émetteur BRVM à son coût du capital aide à évaluer la création de valeur.",
    "synonyms": [
      "Return on invested capital",
      "Rentabilité du capital investi"
    ],
    "resourceUrl": "https://www.brvm.org/fr/informations-financieres",
    "tip": "Les définitions du résultat opérationnel et du capital investi doivent être harmonisées.",
    "source": "guide"
  },
  {
    "slug": "wacc",
    "title": "WACC",
    "level": "avance",
    "themeSlug": "valorisation",
    "definition": "Coût moyen pondéré du capital, combinant coût des fonds propres et coût de la dette après impôt.",
    "example": "Un analyste actualise les flux d’un émetteur BRVM avec un WACC adapté à son risque et à sa structure financière.",
    "synonyms": [
      "CMPC",
      "Coût moyen pondéré du capital"
    ],
    "resourceUrl": "https://www.bceao.int",
    "tip": "Le WACC dépend d’hypothèses sensibles : prime de risque, bêta, taux et structure cible.",
    "source": "guide"
  },
  {
    "slug": "fcfe",
    "title": "FCFE",
    "level": "avance",
    "themeSlug": "valorisation",
    "definition": "Flux de trésorerie disponible pour les actionnaires après investissements et variation de dette.",
    "example": "Une valorisation d’une société BRVM peut actualiser les FCFE pour estimer la valeur des capitaux propres.",
    "synonyms": [
      "Free cash flow to equity",
      "Flux de trésorerie aux actionnaires"
    ],
    "resourceUrl": "https://www.brvm.org/fr/informations-financieres",
    "tip": "Vérifier la cohérence entre le taux d’actualisation et le flux utilisé.",
    "source": "guide"
  },
  {
    "slug": "ev-ebitda",
    "title": "EV/EBITDA",
    "level": "avance",
    "themeSlug": "valorisation",
    "definition": "Multiple de la valeur d’entreprise rapportée à l’EBITDA.",
    "example": "Comparer EV/EBITDA entre sociétés BRVM d’un même secteur neutralise partiellement leurs structures de financement.",
    "synonyms": [
      "Multiple de valeur d’entreprise",
      "VE/EBITDA"
    ],
    "resourceUrl": "https://www.brvm.org/fr/informations-financieres",
    "tip": "Attention aux différences de normes, de périmètre et d’éléments exceptionnels.",
    "source": "guide"
  },
  {
    "slug": "piotroski-f-score",
    "title": "Piotroski F-Score",
    "level": "avance",
    "themeSlug": "fondamentale",
    "definition": "Score de neuf critères binaires évaluant rentabilité, levier/liquidité et efficacité opérationnelle.",
    "example": "L’analyste peut calculer le score à partir de plusieurs exercices publiés par une société BRVM, sans le traiter comme une recommandation.",
    "synonyms": [
      "Score de Piotroski",
      "F-Score"
    ],
    "resourceUrl": "https://www.brvm.org/fr/informations-financieres",
    "tip": "Le score exige des données historiques comparables et n’est pas adapté à tous les secteurs.",
    "source": "guide"
  },
  {
    "slug": "ichimoku-kinko-hyo",
    "title": "Ichimoku Kinko Hyo",
    "level": "avance",
    "themeSlug": "technique-avancee",
    "definition": "Système graphique combinant lignes de tendance, nuage et repères temporels pour apprécier tendance et momentum.",
    "example": "Appliqué à une série de cours BRVM, Ichimoku peut structurer l’observation de la tendance, mais pas garantir un scénario.",
    "synonyms": [
      "Ichimoku",
      "Nuage japonais"
    ],
    "resourceUrl": "https://www.brvm.org/fr/cours",
    "tip": "Peu adapté aux titres BRVM peu liquides : les paramètres standards peuvent produire des signaux trompeurs. Préférez d’abord RSI, MACD et moyennes mobiles.",
    "source": "guide"
  },
  {
    "slug": "retracement-de-fibonacci",
    "title": "Retracement de Fibonacci",
    "level": "avance",
    "themeSlug": "technique-avancee",
    "definition": "Repères proportionnels utilisés pour identifier des zones possibles de correction d’un mouvement.",
    "example": "Sur /graphes, l’outil Fib permet de tracer des niveaux entre deux points — lecture subjective, surtout si les volumes sont faibles.",
    "synonyms": [
      "Fibonacci retracement",
      "Niveaux de Fibonacci"
    ],
    "resourceUrl": "https://www.brvm.org/fr/cours",
    "tip": "Sur BRVM, valider toujours avec volumes, tendance et contexte fondamental : les niveaux seuls ne suffisent pas.",
    "source": "guide"
  },
  {
    "slug": "theorie-des-vagues-d-elliott",
    "title": "Théorie des vagues d’Elliott",
    "level": "avance",
    "themeSlug": "technique-avancee",
    "definition": "Cadre d’analyse proposant que les prix évoluent selon des vagues liées au comportement collectif.",
    "example": "Un analyste peut formuler plusieurs scénarios de vagues sur un indice BRVM, puis les invalider si les niveaux clés sont franchis.",
    "synonyms": [
      "Elliott Wave",
      "Ondes d’Elliott"
    ],
    "resourceUrl": "https://www.brvm.org/fr/indices",
    "tip": "Très interprétatif et peu robuste sur des séries courtes ou illiquides — à classer en lecture secondaire sur la BRVM.",
    "source": "guide"
  },
  {
    "slug": "effet-de-levier",
    "title": "Effet de levier",
    "level": "avance",
    "themeSlug": "strategies",
    "definition": "Utilisation de dette ou d’un instrument financé pour amplifier l’exposition et les résultats.",
    "example": "Une entreprise BRVM endettée peut amplifier son ROE lorsque son rendement des actifs dépasse le coût de la dette, mais aussi amplifier les pertes.",
    "synonyms": [
      "Levier",
      "Gearing"
    ],
    "resourceUrl": "https://www.amf-umoa.org",
    "tip": "Le levier accroît simultanément rendement potentiel et risque de perte.",
    "source": "guide"
  },
  {
    "slug": "vente-a-decouvert",
    "title": "Vente à découvert",
    "level": "avance",
    "themeSlug": "strategies",
    "definition": "Vente d’un titre emprunté avec l’intention de le racheter plus tard à un prix inférieur.",
    "example": "Si le cadre de marché et l’intermédiaire l’autorisent, une position vendeuse sur une valeur BRVM expose à une hausse potentiellement illimitée.",
    "synonyms": [
      "Short selling",
      "Position courte"
    ],
    "resourceUrl": "https://www.brvm.org",
    "tip": "Vérifier l’éligibilité, l’emprunt, les garanties et les règles applicables avant toute opération.",
    "source": "guide"
  },
  {
    "slug": "hedging-couverture",
    "title": "Hedging / couverture",
    "level": "avance",
    "themeSlug": "risques",
    "definition": "Technique visant à réduire une exposition défavorable au moyen d’une position compensatrice.",
    "example": "Une entreprise liée à une devise ou à une matière première peut étudier une couverture pour stabiliser ses flux, sous réserve des instruments disponibles.",
    "synonyms": [
      "Couverture",
      "Protection"
    ],
    "resourceUrl": "https://www.bceao.int",
    "tip": "Une couverture réduit souvent le risque mais peut aussi réduire le gain potentiel et générer un coût.",
    "source": "guide"
  },
  {
    "slug": "beta",
    "title": "Bêta",
    "level": "avance",
    "themeSlug": "risques",
    "definition": "Mesure de la sensibilité d’un titre aux variations d’un marché de référence.",
    "example": "Un analyste estime le bêta d’une action BRVM par régression sur un indice BRVM, avec prudence si les échanges sont peu fréquents.",
    "synonyms": [
      "Coefficient bêta",
      "Sensibilité au marché"
    ],
    "resourceUrl": "https://www.brvm.org/fr/indices",
    "tip": "Les problèmes de liquidité et de non-synchronisation peuvent biaiser l’estimation.",
    "source": "guide"
  },
  {
    "slug": "prime-de-risque",
    "title": "Prime de risque",
    "level": "avance",
    "themeSlug": "valorisation",
    "definition": "Rendement supplémentaire exigé pour investir dans un actif risqué plutôt que dans une référence sans risque.",
    "example": "Dans un modèle BRVM, la prime de risque actions UEMOA doit être justifiée par des sources et une méthode explicites.",
    "synonyms": [
      "Risk premium",
      "Sur-rendement exigé"
    ],
    "resourceUrl": "https://www.bceao.int",
    "tip": "Ne pas additionner mécaniquement des primes qui couvrent le même risque.",
    "source": "guide"
  },
  {
    "slug": "valeur-intrinseque",
    "title": "Valeur intrinsèque",
    "level": "avance",
    "themeSlug": "valorisation",
    "definition": "Estimation de la valeur économique d’un titre à partir de ses flux, actifs, bénéfices et risques.",
    "example": "L’analyste compare sa valeur intrinsèque estimée d’une action BRVM à son cours, avec une marge de sécurité.",
    "synonyms": [
      "Fair value",
      "Valeur fondamentale"
    ],
    "resourceUrl": "https://www.brvm.org/fr/informations-financieres",
    "tip": "Ce n’est pas un prix certain : le résultat dépend des hypothèses et du scénario.",
    "source": "guide"
  },
  {
    "slug": "signal-ouestbourse",
    "title": "Signal d'investissement (OuestBourse)",
    "level": "intermediaire",
    "themeSlug": "plateforme",
    "definition": "Recommandation synthétique affichée sur la plateforme, dérivée d'un score composite (technique, fondamental, risque). Les libellés sont fixes : ACHAT FORT, ACHAT, CONSERVER, ALLÉGER, VENDRE.",
    "example": "Sur la fiche SGBC ou SNTS, le bloc « Signal final » montre le libellé coloré, le score /100, la confiance et les facteurs ▲/▼/●.",
    "synonyms": [
      "Signal final",
      "Recommandation"
    ],
    "resourceUrl": null,
    "tip": "Ce n'est pas un ordre de bourse ni un conseil personnalisé — toujours croiser avec les états financiers et votre profil de risque.",
    "source": "plateforme"
  },
  {
    "slug": "score-composite",
    "title": "Score composite",
    "level": "intermediaire",
    "themeSlug": "plateforme",
    "definition": "Note 0–100 combinant score technique, score fondamental, ajustement au risque et score sectoriel. Plus le score est élevé, plus le signal tend vers l'achat (sous contraintes de risque et de confiance).",
    "example": "Un titre à 69/100 avec confiance Élevée peut afficher ACHAT ; un score élevé avec risque trop fort ne pourra pas être ACHAT FORT.",
    "synonyms": [
      "Score OuestBourse",
      "Note /100"
    ],
    "resourceUrl": null,
    "tip": "Le score évolue avec les données ingérées ; une année d'historique manquante change la confiance plus que le libellé du signal.",
    "source": "plateforme"
  },
  {
    "slug": "confiance-du-signal",
    "title": "Confiance du signal",
    "level": "intermediaire",
    "themeSlug": "plateforme",
    "definition": "Indicateur (Élevée, Moyenne, Faible) lié à la profondeur d'historique de cours. Une confiance faible plafonne les signaux extrêmes (pas d'ACHAT FORT / VENDRE trop agressifs).",
    "example": "Une société ajoutée récemment avec surtout l'année en cours affichera souvent Confiance Faible ou Moyenne.",
    "synonyms": [
      "Fiabilité du signal"
    ],
    "resourceUrl": null,
    "tip": "La confiance ne dit pas si le titre montera : elle dit si l'analyse a assez de passé pour être robuste.",
    "source": "plateforme"
  },
  {
    "slug": "horizons-c-m-l",
    "title": "Horizons court / moyen / long",
    "level": "intermediaire",
    "themeSlug": "plateforme",
    "definition": "Trois sous-scores 0–100 : court terme (performance récente + indicateurs techniques), moyen terme (ex. perf. 5 ans), long terme (ex. perf. 10 ans ou span disponible).",
    "example": "Sur la fiche société, la sidebar Signal détaille Court / Moyen / Long à côté des scores technique et fondamental.",
    "synonyms": [
      "Multi-horizons"
    ],
    "resourceUrl": null,
    "tip": "Un bon score long terme n'efface pas un risque de liquidité court terme sur la BRVM.",
    "source": "plateforme"
  },
  {
    "slug": "score-technique",
    "title": "Score technique",
    "level": "intermediaire",
    "themeSlug": "technique",
    "definition": "Synthèse 0–100 de la lecture graphique et des performances de prix (RSI, MACD, SMA, horizons). Distinct du score fondamental.",
    "example": "Le récap « Analyse graphique » sous le workbench /graphes reprend ce score technique.",
    "synonyms": [
      "Lecture graphique"
    ],
    "resourceUrl": null,
    "tip": "Sans assez de points de cours densifiés, le technique peut retomber sur un repli basé sur les horizons de prix seuls.",
    "source": "plateforme"
  },
  {
    "slug": "score-fondamental",
    "title": "Score fondamental",
    "level": "intermediaire",
    "themeSlug": "fondamentale",
    "definition": "Synthèse 0–100 basée surtout sur le rendement du dividende, la régularité des distributions et le PER — à partir des données disponibles en base.",
    "example": "Le screener vue Solidité et le récap fondamental sous chaque société cotée s'appuient sur ce score.",
    "synonyms": [
      "Analyse fondamentale (score)"
    ],
    "resourceUrl": null,
    "tip": "Si le PER ou les dividendes sont N/D, le fondamental est volontairement plus prudent.",
    "source": "plateforme"
  },
  {
    "slug": "drawdown-maximal",
    "title": "Drawdown maximal",
    "level": "avance",
    "themeSlug": "risques",
    "definition": "Plus forte baisse cumulative observée entre un sommet et un creux sur la période analysée, exprimée en %. Mesure la douleur historique d'un titre.",
    "example": "Dans Gestion du risque (fiche société), le drawdown max complète volatilité et VaR quand la série de clôtures est assez longue.",
    "synonyms": [
      "Perte maximale historique",
      "Max drawdown"
    ],
    "resourceUrl": null,
    "tip": "Un drawdown passé n'est pas une garantie du futur, mais il ancre le risque « pire scénario déjà vécu ».",
    "source": "plateforme"
  },
  {
    "slug": "var-value-at-risk",
    "title": "VaR (Value at Risk)",
    "level": "avance",
    "themeSlug": "risques",
    "definition": "Estimation empirique de la perte (en %) qui n'est dépassée qu'avec une faible probabilité (ex. 5 % pour une VaR 95 %) sur l'historique des rendements.",
    "example": "OuestBourse affiche VaR 95 % et VaR 99 % dans le panneau risque lorsque suffisamment de rendements sont disponibles ; sinon N/D.",
    "synonyms": [
      "Valeur en risque"
    ],
    "resourceUrl": null,
    "tip": "La VaR ne décrit pas l'ampleur des pertes au-delà du seuil — d'où l'intérêt du CVaR.",
    "source": "plateforme"
  },
  {
    "slug": "cvar-expected-shortfall",
    "title": "CVaR (Expected Shortfall)",
    "level": "avance",
    "themeSlug": "risques",
    "definition": "Moyenne des pertes au-delà de la VaR (ex. au-delà des 5 % pires jours). Mesure la sévérité de la queue de distribution.",
    "example": "Affiché à côté de la VaR sur la fiche lorsque calculable ; contribue au score de risque de marché.",
    "synonyms": [
      "Expected Shortfall",
      "ES"
    ],
    "resourceUrl": null,
    "tip": "Utile pour comparer deux titres à VaR proches mais queues de risque différentes.",
    "source": "plateforme"
  },
  {
    "slug": "sante-financiere",
    "title": "Santé financière",
    "level": "intermediaire",
    "themeSlug": "plateforme",
    "definition": "Note sur 10 dérivée de piliers calibrés sur les métriques BRVM disponibles dans OuestBourse — pas un audit comptable complet.",
    "example": "Sidebar de la fiche société : score /10, libellé et détail des piliers.",
    "synonyms": [
      "Financial health"
    ],
    "resourceUrl": null,
    "tip": "Des postes comptables absents restent N/D : la santé affichée ne remplace pas les états financiers officiels.",
    "source": "plateforme"
  },
  {
    "slug": "donnee-n-d",
    "title": "Donnée N/D",
    "level": "debutant",
    "themeSlug": "plateforme",
    "definition": "Mention « N/D » (non disponible) affichée dès qu'une information manque, est invalide ou non encore ingérée. Jamais remplacée par un zéro trompeur côté interface.",
    "example": "Capitalisation à 0 en base, PER manquant ou volume absent → N/D sur la fiche ou le screener.",
    "synonyms": [
      "Non disponible",
      "Non renseigné"
    ],
    "resourceUrl": null,
    "tip": "N/D est une information honnête : mieux vaut savoir ce qui manque que croire un chiffre inventé.",
    "source": "plateforme"
  },
  {
    "slug": "source-canonique",
    "title": "Source canonique",
    "level": "intermediaire",
    "themeSlug": "plateforme",
    "definition": "Valeur retenue après réconciliation multi-sources. Priorité : BRVM officiel > Sikafinance > Richbourse > saisie manuelle. Un écart > 2 % entre sources est journalisé.",
    "example": "Sous le cours d'une société : « Source : BRVM officiel · Synchronisé le … ».",
    "synonyms": [
      "Donnée de référence"
    ],
    "resourceUrl": "https://www.brvm.org",
    "tip": "En cas de doute, privilégiez toujours le Bulletin / site BRVM pour la clôture officielle.",
    "source": "plateforme"
  },
  {
    "slug": "brvm",
    "title": "BRVM",
    "level": "debutant",
    "themeSlug": "marche",
    "definition": "Bourse Régionale des Valeurs Mobilières : marché organisé des titres de l'espace UEMOA (Afrique de l'Ouest), avec cotation centralisée et diffusion d'informations réglementées.",
    "example": "OuestBourse se concentre sur les actions BRVM : cours, analyses et calendrier de dividendes.",
    "synonyms": [
      "Bourse Régionale des Valeurs Mobilières"
    ],
    "resourceUrl": "https://www.brvm.org",
    "tip": "La BRVM n'est pas une banque ni un courtier : ce sont les SGI qui transmettent vos ordres.",
    "source": "plateforme"
  },
  {
    "slug": "uemoa",
    "title": "UEMOA",
    "level": "debutant",
    "themeSlug": "marche",
    "definition": "Union Économique et Monétaire Ouest-Africaine : zone à monnaie commune (FCFA) dont plusieurs pays ont des émetteurs cotés à la BRVM.",
    "example": "Les fiches OuestBourse indiquent le pays (Côte d'Ivoire, Sénégal, etc.) pour chaque ticker.",
    "synonyms": [
      "Union Économique et Monétaire Ouest-Africaine"
    ],
    "resourceUrl": null,
    "tip": "Même devise ne signifie pas même risque pays ou même liquidité par titre.",
    "source": "plateforme"
  },
  {
    "slug": "sgi",
    "title": "SGI",
    "level": "debutant",
    "themeSlug": "marche",
    "definition": "Société de Gestion et d'Intermédiation : intermédiaire habilité à recevoir et transmettre les ordres des investisseurs sur la BRVM.",
    "example": "Pour acheter une action vue sur OuestBourse, vous passez en général par votre SGI ; la plateforme analyse, elle n'exécute pas l'ordre.",
    "synonyms": [
      "Courtier BRVM",
      "Intermédiaire de marché"
    ],
    "resourceUrl": "https://www.brvm.org",
    "tip": "Vérifiez agrément, frais et modalités de règlement-livraison auprès de votre SGI.",
    "source": "plateforme"
  },
  {
    "slug": "bandes-de-bollinger",
    "title": "Bandes de Bollinger",
    "level": "intermediaire",
    "themeSlug": "technique",
    "definition": "Enveloppe autour d'une moyenne mobile (souvent 20 périodes) à ± k écarts-types. Visualise la volatilité et les zones de prix étendus.",
    "example": "Activez « Bollinger (20,2) » dans Indicateurs sur /graphes.",
    "synonyms": [
      "Bollinger Bands"
    ],
    "resourceUrl": null,
    "tip": "Une sortie de bande n'est pas à elle seule un signal d'achat ou de vente.",
    "source": "plateforme",
    illustration: "bollinger",
  },
  {
    "slug": "ema",
    "title": "EMA (moyenne mobile exponentielle)",
    "level": "intermediaire",
    "themeSlug": "technique",
    "definition": "Moyenne mobile qui donne plus de poids aux cours récents que la SMA. Réagit plus vite aux retournements.",
    "example": "EMA 12 et EMA 26 sont proposées dans le menu Indicateurs du workbench graphique.",
    "synonyms": [
      "Exponential Moving Average"
    ],
    "resourceUrl": null,
    "tip": "Le MACD est lui-même construit à partir d'EMA rapides et lentes.",
    "source": "plateforme"
  },
  {
    "slug": "obv",
    "title": "OBV (On-Balance Volume)",
    "level": "avance",
    "themeSlug": "technique",
    "definition": "Indicateur de flux qui cumule le volume selon que le cours clôture en hausse ou en baisse, pour estimer la pression acheteuse ou vendeuse.",
    "example": "Overlay OBV sur /graphes lorsque des volumes réels sont disponibles ; sinon le volume reste N/D.",
    "synonyms": [
      "On-Balance Volume"
    ],
    "resourceUrl": null,
    "tip": "Sans volumes fiables, l'OBV n'a guère de sens — d'où le N/D fréquent sur certaines séries BRVM.",
    "source": "plateforme"
  },
  {
    "slug": "chandeliers-ohlc",
    "title": "Chandeliers (OHLC)",
    "level": "debutant",
    "themeSlug": "technique",
    "definition": "Représentation graphique d'une séance : Ouverture, Plus Haut, Plus Bas, Clôture (Open/High/Low/Close). La couleur indique souvent la hausse ou la baisse sur la période.",
    "example": "Le workbench /graphes affiche des chandeliers ; si seuls les cours de clôture existent, OHLC peut être synthétique (documenté en pied de graphique).",
    "synonyms": [
      "Candlesticks",
      "Bougies japonaises"
    ],
    "resourceUrl": null,
    "tip": "Lisez toujours la note de source : synthétique ≠ cotation intraday officielle.",
    "source": "plateforme"
  },
  {
    "slug": "screener",
    "title": "Screener",
    "level": "debutant",
    "themeSlug": "plateforme",
    "definition": "Outil de filtrage et de classement des valeurs selon des critères (rendement, croissance, valorisation, solidité, etc.) pour cibler un univers d'étude.",
    "example": "Page /screener OuestBourse : filtres secteur/pays/recherche et colonnes de métriques calculées.",
    "synonyms": [
      "Filtre de titres",
      "Stock screener"
    ],
    "resourceUrl": null,
    "tip": "Un screener oriente la recherche ; il ne remplace pas la lecture de la fiche et des risques.",
    "source": "plateforme"
  },
  {
    "slug": "projection-future",
    "title": "Projection future",
    "level": "intermediaire",
    "themeSlug": "plateforme",
    "definition": "Scénarios de cours futurs (central, optimiste, pessimiste) issus d'une régression sur l'historique — illustration pédagogique, pas une prévision garantie.",
    "example": "Onglet « Projection future » sur la fiche société : bandes autour de la tendance estimée.",
    "synonyms": [
      "Scénarios de prix"
    ],
    "resourceUrl": null,
    "tip": "Les projections cassent dès que le régime de marché change ; gardez-les comme hypothèses.",
    "source": "plateforme"
  },
  {
    "slug": "golden-cross-death-cross",
    "title": "Golden cross / Death cross",
    "level": "intermediaire",
    "themeSlug": "technique",
    "definition": "Golden cross : une moyenne mobile courte croise au-dessus d'une longue (signal haussier classique). Death cross : croisement inverse (baissier).",
    "example": "Détecté dans le snapshot technique OuestBourse lorsque SMA rapide et lente se croisent sur la série densifiée.",
    "synonyms": [
      "Croisement de moyennes"
    ],
    "resourceUrl": null,
    "tip": "Sur marchés peu liquides, les croisements peuvent être trompeurs ou tardifs.",
    "source": "plateforme",
    illustration: "sma-cross",
  },
  {
    slug: "pourquoi-analyser-une-action",
    title: "Pourquoi analyser une action",
    level: "debutant",
    themeSlug: "pourquoi-analyser",
    sortOrder: 1,
    definition:
      "Analyser une action, c’est structurer l’information disponible (cours, comptes, liquidité, contexte) pour mieux comprendre le risque et le potentiel — pas pour obtenir une certitude ni un conseil d’achat.",
    example:
      "Avant d’ouvrir une fiche SNTS ou SGBC sur OuestBourse, clarifiez votre horizon (court / moyen / long) et ce que vous voulez vérifier : dividende, valorisation, tendance.",
    synonyms: ["Objectif d’analyse", "Lecture d’un titre"],
    resourceUrl: null,
    tip: "Une analyse pédagogique n’est jamais une recommandation d’investissement. Vérifiez toujours BRVM, états financiers et SGI.",
    source: "plateforme",
  },
  {
    slug: "limites-de-l-analyse",
    title: "Limites de l’analyse",
    level: "debutant",
    themeSlug: "pourquoi-analyser",
    sortOrder: 2,
    definition:
      "Toute analyse repose sur des données partielles, parfois en retard, et sur des hypothèses. Sur la BRVM, la liquidité faible et les données manquantes (affichées N/D) renforcent ces limites.",
    example:
      "Si le PER ou le volume moyen est N/D sur une fiche, le score OuestBourse baisse en confiance : c’est une limite explicitée, pas un bug.",
    synonyms: ["Incertitude", "Données manquantes"],
    resourceUrl: null,
    tip: "Préférez une conclusion prudente avec facteurs ▲/▼ plutôt qu’un verdict binaire.",
    source: "plateforme",
  },
  {
    slug: "parcours-d-analyse",
    title: "Parcours d’analyse (étapes)",
    level: "debutant",
    themeSlug: "comment-analyser",
    sortOrder: 1,
    illustration: "parcours-analyse",
    definition:
      "Enchaînement recommandé : (1) contexte marché et liquidité, (2) fondamentaux et dividendes, (3) valorisation, (4) lecture technique sur /graphes, (5) croisement avec le signal OuestBourse et sa confiance.",
    example:
      "Exemple pédagogique : fiche société → onglet Indicateurs / Dividendes → /graphes (RSI, MACD, SMA) → signal final et raisons ▲/▼.",
    synonyms: ["Méthode d’analyse", "Checklist"],
    resourceUrl: null,
    tip: "Ne sautez pas la liquidité : un indicateur technique sur un titre rarement échangé peut être trompeur.",
    source: "plateforme",
  },
  {
    slug: "type-analyse-fondamentale",
    title: "Type : analyse fondamentale",
    level: "debutant",
    themeSlug: "comment-analyser",
    sortOrder: 2,
    definition:
      "Étudie les comptes, la rentabilité, l’endettement et la capacité à générer des résultats / dividendes — indépendamment du bruit quotidien du cours.",
    example:
      "Sur OuestBourse : PER, capitalisation, rendement dividende, santé financière et score fondamental sur la fiche société.",
    synonyms: ["Lecture des comptes"],
    resourceUrl: null,
    tip: "Poursuivez dans le thème « Analyse fondamentale » pour les termes CA, BPA, marge, etc.",
    source: "plateforme",
  },
  {
    slug: "type-analyse-valorisation",
    title: "Type : valorisation",
    level: "debutant",
    themeSlug: "comment-analyser",
    sortOrder: 3,
    definition:
      "Compare le prix de marché à une mesure de résultat ou d’actif (PER, capitalisation, multiples) pour situer cher / bon marché — toujours relatif au secteur et à la qualité.",
    example:
      "Le PER d’une banque BRVM se lit autrement que celui d’un titre industriel ; le screener permet de comparer des pairs.",
    synonyms: ["Multiples", "Prix relatif"],
    resourceUrl: null,
    tip: "Voir le thème Valorisation (PER, WACC, FCFE…).",
    source: "plateforme",
  },
  {
    slug: "type-analyse-technique",
    title: "Type : analyse technique",
    level: "debutant",
    themeSlug: "comment-analyser",
    sortOrder: 4,
    definition:
      "Lit le comportement du prix et du volume (moyennes, RSI, MACD, supports) pour décrire momentum et niveaux — sans remplacer les fondamentaux.",
    example:
      "Sur /graphes, activez SMA 20 + RSI 14 + MACD : ce trio couvre tendance courte, zones de surachat/survente et momentum.",
    synonyms: ["Chartisme", "Indicateurs de prix"],
    resourceUrl: null,
    tip: "Les indicateurs complexes (Ichimoku, Elliott, Stochastique…) sont regroupés sous « Indicateurs avancés (peu adaptés) ».",
    source: "plateforme",
  },
  {
    slug: "adx",
    title: "ADX (+DI / −DI)",
    level: "avance",
    themeSlug: "technique-avancee",
    sortOrder: 10,
    definition:
      "L’ADX mesure la force d’une tendance (pas sa direction) ; +DI et −DI indiquent la dominance haussière ou baissière. Souvent calculé sur 14 périodes.",
    example:
      "Disponible dans le menu Indicateurs de /graphes. Un ADX élevé signale une tendance marquée ; un ADX bas, un marché sans direction claire.",
    synonyms: ["Average Directional Index", "Indicateur directionnel"],
    resourceUrl: null,
    tip: "Utile en lecture secondaire : sur titres BRVM peu liquides, les DI peuvent osciller sans tendance réelle.",
    source: "guide",
  },
  {
    slug: "stochastique",
    title: "Stochastique (%K / %D)",
    level: "avance",
    themeSlug: "technique-avancee",
    sortOrder: 11,
    definition:
      "Oscillateur comparant le cours de clôture à la fourchette haut-bas récente. %K est la ligne rapide ; %D un lissage de %K.",
    example:
      "Sur /graphes : Stochastique (14,3) avec repères 20/80. Lecture pédagogique uniquement — pas un ordre d’achat/vente.",
    synonyms: ["Stochastic oscillator"],
    resourceUrl: null,
    tip: "Classé peu adapté à la BRVM dans le guide indicateurs : faux signaux fréquents si les volumes sont faibles.",
    source: "guide",
  },
  {
    slug: "williams-r",
    title: "Williams %R",
    level: "avance",
    themeSlug: "technique-avancee",
    sortOrder: 12,
    definition:
      "Oscillateur proche du stochastique, généralement entre −100 et 0, mesurant la position du cours dans la fourchette récente.",
    example:
      "Activable sur /graphes (Williams %R 14). Zones proches de −20 / −80 sont des repères, pas des règles.",
    synonyms: ["Williams Percent Range", "%R"],
    resourceUrl: null,
    tip: "Secondaire sur BRVM : préférez RSI si vous ne voulez qu’un seul oscillateur.",
    source: "guide",
  },
  {
    slug: "cci",
    title: "CCI (Commodity Channel Index)",
    level: "avance",
    themeSlug: "technique-avancee",
    sortOrder: 13,
    definition:
      "Mesure l’écart du prix typique (H+L+C)/3 par rapport à sa moyenne, souvent sur 20 périodes. Valeurs extrêmes (±100) signalent une extension.",
    example:
      "Disponible sur /graphes. Sur un titre liquide, un CCI extrême peut coïncider avec une accélération ; sur un titre mince, méfiez-vous.",
    synonyms: ["Commodity Channel Index"],
    resourceUrl: null,
    tip: "Peu adapté aux séries irrégulières BRVM — à utiliser en confirmation, jamais seul.",
    source: "guide",
  },
  {
    slug: "menu-accueil",
    title: "Menu : Accueil (landing)",
    level: "debutant",
    themeSlug: "navigation-app",
    sortOrder: 1,
    illustration: "nav-app",
    definition:
      "Page d’entrée publique présentant OuestBourse, les modules et un accès rapide vers Marché, Screener, Graphes et le reste de l’app.",
    example:
      "Depuis /, utilisez la navigation du header pour aller vers /marche ou /education sans perdre le thème clair/sombre.",
    synonyms: ["Landing", "Page d’accueil"],
    resourceUrl: null,
    tip: "Les chiffres du bandeau de stats sont calculés sur les vraies données de la base, pas inventés.",
    source: "plateforme",
  },
  {
    slug: "menu-marche",
    title: "Menu : Marché",
    level: "debutant",
    themeSlug: "navigation-app",
    sortOrder: 2,
    definition:
      "Vue d’ensemble des positions BRVM (et sélecteur multi-marchés) : liste des titres, scores, perf/dividendes, accès fiche ou graphe.",
    example:
      "Sur /marche, cliquez une position puis choisissez « Fiche société » ou « Graphe » selon votre besoin.",
    synonyms: ["Board marché", "Positions"],
    resourceUrl: null,
    tip: "Les autres marchés africains peuvent être annoncés « bientôt » : seule la BRVM est live aujourd’hui.",
    source: "plateforme",
  },
  {
    slug: "menu-screener",
    title: "Menu : Screener",
    level: "debutant",
    themeSlug: "navigation-app",
    sortOrder: 3,
    definition:
      "Filtre et compare les sociétés selon rentabilité, dividendes, croissance, valorisation, secteur ou pays — branché sur calcMetrics.",
    example:
      "Sur /screener, filtrez « Dividendes » puis ouvrez une fiche pour lire le signal et la confiance.",
    synonyms: ["Filtre titres", "Screening"],
    resourceUrl: null,
    tip: "Un filtre ne remplace pas la lecture de liquidité et des N/D sur la fiche.",
    source: "plateforme",
  },
  {
    slug: "menu-graphes",
    title: "Menu : Graphes",
    level: "debutant",
    themeSlug: "navigation-app",
    sortOrder: 4,
    definition:
      "Workbench d’analyse graphique : chandeliers, plages, indicateurs (SMA, RSI, MACD, ADX…), tracés et alertes de seuil (compte connecté).",
    example:
      "Sur /graphes, ouvrez Indicateurs pour activer RSI ou ADX ; les pastilles permettent de retirer un overlay d’un clic.",
    synonyms: ["Charting", "Workbench"],
    resourceUrl: null,
    tip: "Les indicateurs avancés sont disponibles mais documentés comme peu adaptés à certains titres BRVM — voir Éducation › Analyse.",
    source: "plateforme",
  },
  {
    slug: "menu-fiche-societe",
    title: "Menu : Fiche société",
    level: "debutant",
    themeSlug: "navigation-app",
    sortOrder: 5,
    definition:
      "Page /actions/[ticker] : cours, performances, données clés, dividendes, santé financière, signal, projection et comparaison.",
    example:
      "Depuis le méga-menu Sociétés cotées ou le Marché, ouvrez SNTS pour voir PER, rendement et explication du signal.",
    synonyms: ["Fiche titre", "Company sheet"],
    resourceUrl: null,
    tip: "Toute donnée absente s’affiche N/D — ne pas inventer un chiffre manquant.",
    source: "plateforme",
  },
  {
    slug: "menu-portefeuille",
    title: "Menu : Portefeuille",
    level: "debutant",
    themeSlug: "navigation-app",
    sortOrder: 6,
    definition:
      "Suivi des positions personnelles (valeur de marché, plus/moins-value vs prix moyen d’achat, allocation sectorielle, YTD) — nécessite une connexion.",
    example:
      "Sur /portefeuille, consultez la fiche PRU dans Éducation › Portefeuille & suivi pour comprendre la colonne +/-value.",
    synonyms: ["Positions personnelles"],
    resourceUrl: null,
    tip: "PRU, plus-value latente, YTD et conseils : thème Éducation « Portefeuille & suivi ».",
    source: "plateforme",
  },
  {
    slug: "menu-alertes",
    title: "Menu : Alertes de prix",
    level: "intermediaire",
    themeSlug: "navigation-app",
    sortOrder: 7,
    definition:
      "Seuils au-dessus / en-dessous d’un cours, créés depuis /graphes (compte connecté) et évalués après rafraîchissement des cotations BRVM.",
    example:
      "Fixez une alerte « au-dessus de X FCFA » sur un ticker : statut ACTIVE puis TRIGGERED lorsque le seuil est franchi.",
    synonyms: ["Price alert", "Seuil de cours"],
    resourceUrl: null,
    tip: "Les alertes ne sont pas des ordres de bourse et n’exécutent aucun trade.",
    source: "plateforme",
  },
  {
    slug: "menu-calendrier-dividendes",
    title: "Menu : Calendrier des dividendes",
    level: "debutant",
    themeSlug: "navigation-app",
    sortOrder: 8,
    definition:
      "Vue des dates et montants de dividendes connus en base — utile pour planifier un suivi de rendement, pas une promesse de distribution future.",
    example:
      "Ouvrez /calendrier-dividendes puis croisez avec la fiche société pour le rendement calculé.",
    synonyms: ["Agenda dividendes"],
    resourceUrl: null,
    tip: "Les dates officielles BRVM / assemblées priment en cas d’écart.",
    source: "plateforme",
  },
  {
    slug: "pru",
    title: "PRU (prix de revient unitaire)",
    level: "debutant",
    themeSlug: "portefeuille-suivi",
    sortOrder: 1,
    definition:
      "Prix moyen d’achat pondéré d’une ligne de portefeuille, en FCFA par action. C’est la référence pour calculer la plus ou moins-value latente — ce n’est pas le cours du jour ni la variation récente du marché.",
    example:
      "Sur /portefeuille, la colonne PRU affiche 14 715 FCFA pour SIBC : la plus-value compare ce prix à votre coût d’entrée, pas à la variation depuis vendredi.",
    synonyms: ["Prix moyen d’achat", "Prix de revient", "Cost basis unitaire"],
    resourceUrl: null,
    tip: "Après plusieurs achats, le PRU se recalcule en moyenne pondérée ; vérifiez-le si vous importez un relevé SGI.",
    source: "plateforme",
  },
  {
    slug: "plus-moins-value-latente",
    title: "Plus/moins-value latente",
    level: "debutant",
    themeSlug: "portefeuille-suivi",
    sortOrder: 2,
    definition:
      "Écart entre la valeur de marché actuelle de vos titres et leur coût d’achat (PRU × quantité), exprimé en FCFA et en pourcentage. « Latente » signifie que la plus ou moins-value n’est réalisée qu’à la vente.",
    example:
      "Une ligne affiche −38 % : cela compare le cours du jour au PRU saisi, pas la variation du titre entre deux séances de bourse.",
    synonyms: ["+/-value", "P&L latent", "Plus-value non réalisée"],
    resourceUrl: null,
    tip: "Un PRU erroné fausse ce pourcentage — corrigez le PRU plutôt que de chercher une chute de marché inexistante.",
    source: "plateforme",
  },
  {
    slug: "cout-d-achat",
    title: "Coût d’achat",
    level: "debutant",
    themeSlug: "portefeuille-suivi",
    sortOrder: 3,
    definition:
      "Montant total investi sur une ligne : quantité × PRU. Il sert de base au calcul de la plus/moins-value en FCFA.",
    example:
      "49 actions SIBC à 14 715 FCFA de PRU → coût d’achat ≈ 721 050 FCFA, comparé à la valeur marché du jour.",
    synonyms: ["Coût de revient", "Base de coût"],
    resourceUrl: null,
    tip: "Frais de courtage et droits non inclus sauf si vous les avez intégrés manuellement au PRU.",
    source: "plateforme",
  },
  {
    slug: "valeur-de-marche",
    title: "Valeur de marché",
    level: "debutant",
    themeSlug: "portefeuille-suivi",
    sortOrder: 4,
    definition:
      "Valorisation actuelle d’une position : quantité × dernier cours canonique connu en base. Elle fluctue avec le cours ; le coût d’achat, lui, ne bouge que si vous modifiez le PRU ou la quantité.",
    example:
      "49 × 9 000 FCFA (cours au 23/08) → valeur marché 441 000 FCFA pour SIBC.",
    synonyms: ["Valorisation", "Market value"],
    resourceUrl: null,
    tip: "Si le cours est N/D, la valeur marché de la ligne reste N/D — pas de chiffre inventé.",
    source: "plateforme",
  },
  {
    slug: "cours-au",
    title: "Cours au (date de référence)",
    level: "debutant",
    themeSlug: "portefeuille-suivi",
    sortOrder: 5,
    definition:
      "Date du dernier cours de clôture canonique utilisé pour valoriser la ligne. Sur la BRVM, l’absence de séance récente peut faire apparaître le vendredi ou le dernier jour ouvré connu.",
    example:
      "« Cours au 23/08/2026 » indique que la valeur marché repose sur la clôture de cette date, pas sur un cours intraday live.",
    synonyms: ["Date de cotation", "As-of date"],
    resourceUrl: null,
    tip: "Comparez cette date au « Acheté le » : ce sont deux informations distinctes (marché vs votre achat).",
    source: "plateforme",
  },
  {
    slug: "performance-ytd",
    title: "Performance YTD",
    level: "intermediaire",
    themeSlug: "portefeuille-suivi",
    sortOrder: 6,
    definition:
      "Year-To-Date : variation en pourcentage de la valeur du portefeuille depuis le dernier cours canonique avant le 1er janvier de l’année en cours. Mesure la performance calendaire, pas la plus-value vs PRU.",
    example:
      "Un YTD de +5 % signifie que vos positions détenues aujourd’hui valent 5 % de plus qu’au repère de début d’année — avec la simplification documentée si des achats ont eu lieu en cours d’année.",
    synonyms: ["YTD", "Performance depuis le 1er janvier"],
    resourceUrl: null,
    tip: "Ne confondez pas YTD (repère 1er janvier) et +/-value (repère PRU).",
    source: "plateforme",
  },
  {
    slug: "allocation-sectorielle",
    title: "Allocation sectorielle",
    level: "debutant",
    themeSlug: "portefeuille-suivi",
    sortOrder: 7,
    definition:
      "Répartition en pourcentage de la valeur de marché du portefeuille par secteur BRVM (Banques, Télécoms, etc.). Utile pour visualiser la concentration et la diversification.",
    example:
      "Un portefeuille à 60 % Banques et 40 % Télécoms montre une forte exposition au secteur bancaire régional.",
    synonyms: ["Répartition sectorielle", "Poids sectoriel"],
    resourceUrl: null,
    tip: "L’allocation ignore les lignes sans cours (N/D) dans le calcul de poids.",
    source: "plateforme",
  },
  {
    slug: "horizon-d-achat",
    title: "Horizon d’achat",
    level: "debutant",
    themeSlug: "portefeuille-suivi",
    sortOrder: 8,
    definition:
      "Horizon que vous déclarez lors de l’ajout ou de l’édition d’une position : Court, Moyen ou Long. Il oriente le conseil portefeuille (Renforcer / Conserver / Sortir) en croisant le signal d’analyse et le score de l’horizon correspondant.",
    example:
      "Une ligne SIBC en horizon Moyen utilise le score moyen terme de la fiche titre pour le badge Conseil — indépendamment de votre plus-value latente.",
    synonyms: ["Horizon de détention", "Buy horizon"],
    resourceUrl: null,
    tip: "Distinct des scores Court / Moyen / Long affichés sur la fiche : ici, c’est votre choix de suivi personnel.",
    source: "plateforme",
  },
  {
    slug: "conseil-portefeuille",
    title: "Conseil portefeuille",
    level: "intermediaire",
    themeSlug: "portefeuille-suivi",
    sortOrder: 9,
    definition:
      "Badge par ligne : Renforcer, Conserver, ou Sortir / Alléger. Il combine le signal OuestBourse (ACHAT FORT … VENDRE) et le score de l’horizon d’achat que vous avez choisi — pas votre plus/moins-value latente.",
    example:
      "Renforcer sur une ligne en perte latente est possible si le signal titre reste acheteur et que le score d’horizon est favorable.",
    synonyms: ["Renforcer", "Conserver", "Sortir / Alléger"],
    resourceUrl: null,
    tip: "Ce n’est pas un ordre de bourse ni un conseil personnalisé — outil pédagogique de suivi.",
    source: "plateforme",
  },
  {
    slug: "evolution-portefeuille",
    title: "Évolution du portefeuille",
    level: "intermediaire",
    themeSlug: "portefeuille-suivi",
    sortOrder: 10,
    definition:
      "Courbe de la valeur quotidienne estimée du portefeuille (NAV) à partir des cours canoniques historiques et des quantités détenues. La série démarre à la date d’achat la plus ancienne de chaque ligne.",
    example:
      "Sur /portefeuille, le graphique d’évolution montre la trajectoire agrégée — utile pour le suivi, pas pour comparer titre par titre au PRU.",
    synonyms: ["NAV portefeuille", "Courbe de valorisation"],
    resourceUrl: null,
    tip: "Les jours sans cotation peuvent laisser des paliers ; les cours manquants excluent temporairement une ligne du calcul.",
    source: "plateforme",
  },
  {
    slug: "taille-de-position",
    title: "Taille de position",
    level: "debutant",
    themeSlug: "taille-position",
    sortOrder: 1,
    definition:
      "Quantité d’actions à acheter pour qu’une perte jusqu’au stop reste limitée à un pourcentage choisi du capital. Formule : Q = (capital × taux %) / (entrée − stop).",
    example:
      "Exemple pédagogique SOGB CI (SOGC) : capital 1 000 000 FCFA, taux 5 %, entrée 8 400 FCFA, stop 7 560 FCFA. Budget = 50 000 FCFA ; risque par titre = 840 FCFA ; Q = 50 000 / 840 ≈ 59,52 → 60 titres. Ouvrez /outils/taille-position pour recalculer avec vos chiffres.",
    synonyms: ["Position sizing", "Dimensionnement", "Money management", "Sizing"],
    resourceUrl: null,
    tip: "Arrondir à l’entier le plus proche peut faire légèrement dépasser le budget (60 × 840 = 50 400 FCFA, soit 5,04 %). Ce n’est pas un conseil d’achat.",
    source: "guide",
    ctaHref: "/outils/taille-position?example=sogb",
    ctaLabel: "Ouvrir la calculette (exemple SOGB)",
    relatedSlugs: ["gestion-du-risque", "taux-perte-acceptable", "stop-loss-brvm"],
  },
  {
    slug: "taux-perte-acceptable",
    title: "Taux de perte acceptable",
    level: "debutant",
    themeSlug: "taille-position",
    sortOrder: 2,
    definition:
      "Pourcentage du capital que vous acceptez de perdre sur un seul trade si le stop est touché. Il fixe le budget de risque : capital × taux %.",
    example:
      "Sur 1 000 000 FCFA, 5 % = 50 000 FCFA de perte max acceptée. À 3 %, le budget tombe à 30 000 FCFA : la quantité recommandée baisse d’autant. Repère courant pour un particulier BRVM : 3 à 5 % par position.",
    synonyms: ["Risque par trade", "Budget de risque", "Risk per trade"],
    resourceUrl: null,
    tip: "Un taux trop élevé (au-delà de ~5–10 %) enchaîne les pertes rapides ; trop bas peut rendre toute position impossible sur un titre cher.",
    source: "guide",
    ctaHref: "/outils/taille-position",
    ctaLabel: "Essayer avec mes chiffres",
  },
  {
    slug: "stop-loss-brvm",
    title: "Stop loss à la BRVM",
    level: "intermediaire",
    themeSlug: "taille-position",
    sortOrder: 3,
    definition:
      "Niveau de cours sous l’entrée (à l’achat) à partir duquel vous acceptez de sortir pour limiter la perte. À la BRVM, il n’existe généralement pas d’ordre stop automatique chez l’intermédiaire : le stop est une règle personnelle, à surveiller.",
    example:
      "Entrée 8 400 FCFA, stop 7 560 FCFA (−10 %). Créez une alerte « cours ≤ 7 560 » depuis la calculette ou la fiche titre : l’alerte prévient, elle n’exécute aucun ordre. Passez ensuite par votre SGI.",
    synonyms: ["Seuil de sortie", "Stop", "Ordre stop"],
    resourceUrl: null,
    tip: "Le stop doit être strictement inférieur à l’entrée pour un achat. Couplé à une alerte OuestBourse, il reste une discipline — pas un ordre de bourse.",
    source: "guide",
    ctaHref: "/outils/taille-position",
    ctaLabel: "Calculer puis alerter au stop",
    relatedSlugs: ["taille-de-position", "taux-perte-acceptable", "gestion-du-risque"],
  },
  {
    slug: "gestion-du-risque",
    title: "Gestion du risque",
    level: "debutant",
    themeSlug: "risques",
    sortOrder: 1,
    definition:
      "Lecture d’ensemble du risque d’un titre BRVM : un score 0–100 (plus haut = plus risqué), un libellé (Très faible → Très élevé) et quatre piliers (marché, liquidité, fondamental, opérationnel). Ce n’est pas un conseil d’achat ni un ordre de sortie — c’est une grille pour dimensionner, comparer et ne pas sous-estimer la perte possible.",
    example:
      "Sur la fiche société, le panneau « Gestion du risque » affiche par exemple 42/100 · Modéré, puis les piliers et, si la série de clôtures est assez longue, le drawdown max et la VaR. Reliez ce score à la calculette de taille de position : un titre plus risqué invite un taux de perte plus bas ou un stop plus proche.",
    synonyms: [
      "Risk management",
      "Pilotage du risque",
      "Score de risque",
      "Panneau risque",
    ],
    resourceUrl: null,
    tip: "Score élevé ≠ « vendre tout de suite ». Il dit : la perte potentielle (volatilité, illiquidité, fondamentaux fragiles, secteur cyclique) est plus forte — réduisez la taille, élargissez l’horizon, ou exigez plus de marge de sécurité.",
    source: "plateforme",
    ctaHref: "/outils/taille-position",
    ctaLabel: "Dimensionner une position (calculette)",
    relatedSlugs: [
      "risque",
      "risque-de-marche",
      "liquidite",
      "risque-fondamental",
      "risque-operationnel",
      "taille-de-position",
      "drawdown-maximal",
      "var-value-at-risk",
    ],
  },
  {
    slug: "risque-de-marche",
    title: "Risque de marché",
    level: "intermediaire",
    themeSlug: "risques",
    sortOrder: 2,
    definition:
      "Pilier du score de risque OuestBourse : amplitude des variations de cours (volatilité historique, drawdown, VaR / CVaR quand la série est assez dense). Il mesure combien le prix a déjà « malmené » l’actionnaire, pas le risque de faillite de l’émetteur.",
    example:
      "Dans Gestion du risque, la ligne « marché » (souvent le poids le plus élevé, ~35 %) monte si les clôtures oscillent fort ou si le pire repli historique est profond. Une valeur calme avec historique long restera plus bas sur ce pilier.",
    synonyms: ["Risque de prix", "Market risk", "Volatilité de marché"],
    resourceUrl: null,
    tip: "Sans assez de clôtures, le pilier peut rester partiel (N/D sur VaR) : la confiance du signal baisse souvent en parallèle.",
    source: "plateforme",
    relatedSlugs: ["gestion-du-risque", "volatilite", "drawdown-maximal", "var-value-at-risk", "cvar-expected-shortfall"],
  },
  {
    slug: "risque-fondamental",
    title: "Risque fondamental",
    level: "intermediaire",
    themeSlug: "risques",
    sortOrder: 3,
    definition:
      "Pilier du score de risque lié à la qualité d’information et aux multiples disponibles : PER extrême ou absent, dividendes irréguliers, historique comptable court. Un titre « bon marché » en apparence peut rester risqué si les données sont trop minces.",
    example:
      "Sur la fiche, un PER N/D ou un historique de dividendes lacunaire alourdit ce pilier et rend le score fondamental plus prudent. Ce n’est pas un audit des comptes — seulement ce que la base OuestBourse peut mesurer sans inventer de chiffre.",
    synonyms: ["Risque de valorisation", "Qualité des données"],
    resourceUrl: null,
    tip: "N/D n’est pas un zéro : c’est une information. Plusieurs N/D d’affilée = analyse moins robuste, pas un « bon plan caché ».",
    source: "plateforme",
    relatedSlugs: ["gestion-du-risque", "per-price-earnings-ratio", "score-fondamental", "donnee-n-d", "confiance-du-signal"],
  },
  {
    slug: "risque-operationnel",
    title: "Risque opérationnel",
    level: "intermediaire",
    themeSlug: "risques",
    sortOrder: 4,
    definition:
      "Pilier sectoriel du score de risque : sensibilité du métier (énergie, industrie, conso. discrétionnaire vs télécoms ou services publics). Proxy pédagogique — pas une note de gouvernance ni un rating crédit.",
    example:
      "Une valeur Énergie ou Agriculture part avec un risque opérationnel plus élevé qu’un titre Télécoms ou Services publics, toutes choses égales par ailleurs. Le poids de ce pilier (~15 %) reste inférieur au risque de marché.",
    synonyms: ["Risque sectoriel", "Risque d’activité"],
    resourceUrl: null,
    tip: "Deux titres du même secteur peuvent diverger fortement sur marché et liquidité : lisez toujours les quatre piliers, pas seulement celui-ci.",
    source: "plateforme",
    relatedSlugs: ["gestion-du-risque", "sante-financiere", "limites-de-l-analyse"],
  },
];

/** Fusionne le terme catalogue avec les détails / sources enrichis (si présents). */
export function applyTermEnrichment(term: EducationTerm): EducationTerm {
  const extra = TERM_ENRICHMENTS[term.slug];
  if (!extra) return term;
  return {
    ...term,
    details: term.details ?? extra.details,
    sources: term.sources && term.sources.length > 0 ? term.sources : extra.sources,
  };
}

export function getAllEducationTerms(): EducationTerm[] {
  return EDUCATION_TERMS.map(applyTermEnrichment);
}

export function getCategoryBySlug(slug: string): EducationCategory | undefined {
  return EDUCATION_CATEGORIES.find((c) => c.slug === slug);
}

export function themesByCategory(categorySlug: string): EducationTheme[] {
  return EDUCATION_THEMES.filter((t) => t.categorySlug === categorySlug);
}

export function getThemeBySlug(slug: string): EducationTheme | undefined {
  return EDUCATION_THEMES.find((t) => t.slug === slug);
}

export function getTermBySlug(slug: string): EducationTerm | undefined {
  const term = EDUCATION_TERMS.find((t) => t.slug === slug);
  return term ? applyTermEnrichment(term) : undefined;
}

export function getCategoryForTheme(themeSlug: string): EducationCategory | undefined {
  const theme = getThemeBySlug(themeSlug);
  if (!theme) return undefined;
  return getCategoryBySlug(theme.categorySlug);
}

export function termsByTheme(themeSlug: string): EducationTerm[] {
  return EDUCATION_TERMS.filter((t) => t.themeSlug === themeSlug)
    .map(applyTermEnrichment)
    .sort((a, b) => {
      const ao = a.sortOrder ?? 999;
      const bo = b.sortOrder ?? 999;
      if (ao !== bo) return ao - bo;
      return a.title.localeCompare(b.title, "fr");
    });
}

export function countTermsByTheme(themeSlug: string): number {
  return EDUCATION_TERMS.filter((t) => t.themeSlug === themeSlug).length;
}

export function countTermsByCategory(categorySlug: string): number {
  const slugs = new Set(themesByCategory(categorySlug).map((t) => t.slug));
  return EDUCATION_TERMS.filter((t) => slugs.has(t.themeSlug)).length;
}

/** @deprecated Préférer `rankEducationSearch` / `searchEducationTerms` dans `lib/education/search.ts`. */
export function searchEducationTerms(query: string): EducationTerm[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return EDUCATION_TERMS.map(applyTermEnrichment)
    .filter((t) => {
      const hay = [t.title, t.definition, t.details ?? "", t.example, ...t.synonyms]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => a.title.localeCompare(b.title, "fr"));
}
