export type TermEnrichment = {
  details: string; // paragraphs separated by \n\n
  sources: { title: string; url: string }[]; // { title: string; url: string }
};

export const ENRICHMENTS_PART1: Record<string, TermEnrichment> = {
  action: {
    details: [
      "Une action est une part du capital d’une société. En la détenant, vous devenez actionnaire : vous pouvez recevoir un dividende si l’assemblée générale le décide, et parfois exercer un droit de vote.",
      "À la BRVM, chaque titre coté (ex. SNTS, SGBC) s’échange via une SGI. Le cours reflète l’offre et la demande du jour, pas une « valeur vraie » garantie.",
      "Sur OuestBourse, la fiche société regroupe cours, historiques, ratios et signal pour lire une action sans confondre prix et fondamentaux.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Stock (action)",
        url: "https://www.investopedia.com/terms/s/stock.asp",
      },
      {
        title: "BRVM — Entreprises cotées",
        url: "https://www.brvm.org/fr/entreprises-cotees",
      },
    ],
  },

  dividende: {
    details: [
      "Le dividende est la part du bénéfice (ou des réserves) qu’une société distribue à ses actionnaires. Il n’est jamais automatique : l’assemblée générale décide du montant et du calendrier.",
      "À la BRVM, les dates de détachement et de paiement sont publiées par l’émetteur et relayées par la place. Un dividende élevé n’implique pas une société plus « sûre ».",
      "OuestBourse affiche rendements et calendriers à partir des données disponibles ; vérifiez toujours les avis officiels avant d’anticiper un paiement.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Dividend",
        url: "https://www.investopedia.com/terms/d/dividend.asp",
      },
      {
        title: "BRVM — Entreprises cotées",
        url: "https://www.brvm.org/fr/entreprises-cotees",
      },
    ],
  },

  bourse: {
    details: [
      "Une bourse est un marché organisé où s’échangent des titres selon des règles communes : horaires, transparence des cours, intermédiaires habilités et supervision.",
      "En Afrique de l’Ouest, la BRVM joue ce rôle pour les titres cotés de l’UEMOA. Elle n’est pas votre courtier : c’est l’infrastructure de négociation et d’information.",
      "Distinguer bourse (place) et SGI (intermédiaire) évite les confusions lorsqu’on place un ordre ou qu’on lit un bulletin de cote.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Stock exchange",
        url: "https://www.investopedia.com/terms/s/stockexchange.asp",
      },
      {
        title: "BRVM — Site officiel",
        url: "https://www.brvm.org",
      },
    ],
  },

  "marche-primaire": {
    details: [
      "Le marché primaire est celui où des titres sont créés et vendus pour la première fois. L’argent de la souscription va à l’émetteur (introduction en bourse, augmentation de capital, etc.).",
      "Sur la BRVM, ces opérations passent par des intermédiaires habilités et un cadre réglementaire précis. Ce n’est pas encore le marché quotidien des échanges entre investisseurs.",
      "Comprendre le primaire aide à lire les prospectus et à distinguer financement de l’entreprise et simple revente d’actions déjà émises.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Primary market",
        url: "https://www.investopedia.com/terms/p/primarymarket.asp",
      },
      {
        title: "BRVM — Site officiel",
        url: "https://www.brvm.org",
      },
    ],
  },

  "marche-secondaire": {
    details: [
      "Le marché secondaire est celui où les investisseurs s’échangent des titres déjà émis. L’émetteur ne reçoit pas le produit de ces reventes : le prix se forme entre acheteurs et vendeurs.",
      "C’est le marché que vous voyez chaque jour à la BRVM : cotations, volumes, indices. La liquidité y dépend de la profondeur des carnets d’ordres.",
      "Sans marché secondaire liquide, il serait difficile de sortir d’une position ou de découvrir un prix de référence fiable.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Secondary market",
        url: "https://www.investopedia.com/terms/s/secondarymarket.asp",
      },
      {
        title: "BRVM — Cours",
        url: "https://www.brvm.org/fr/cours",
      },
    ],
  },

  "indice-boursier": {
    details: [
      "Un indice boursier synthétise l’évolution d’un panier de valeurs selon une méthode (pondération, base, composition). Il sert de thermomètre du marché ou de secteur.",
      "À la BRVM, les indices (Composite, sectoriels, etc.) permettent de situer une action ou un portefeuille face à un benchmark, sans remplacer l’analyse individuelle.",
      "Toujours vérifier composition et règles de calcul : deux indices « BRVM » ne mesurent pas forcément la même chose.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Stock index",
        url: "https://www.investopedia.com/terms/s/stockindex.asp",
      },
      {
        title: "BRVM — Indices",
        url: "https://www.brvm.org/fr/indices",
      },
    ],
  },

  cours: {
    details: [
      "Le cours est le prix auquel un titre s’échange à un instant ou à une séance. Il résulte de la confrontation des ordres, pas d’une formule comptable.",
      "Sur la BRVM, le cours de clôture officiel fait souvent référence pour l’analyse et les publications. Un cours affiché n’est pas une garantie d’exécution au même prix.",
      "OuestBourse privilégie les cours canoniques (souvent source BRVM) après réconciliation multi-sources, et affiche N/D si la donnée manque.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Market price",
        url: "https://www.investopedia.com/terms/m/marketprice.asp",
      },
      {
        title: "BRVM — Cours",
        url: "https://www.brvm.org/fr/cours",
      },
    ],
  },

  liquidite: {
    details: [
      "La liquidité mesure la facilité d’acheter ou de vendre un titre sans faire bouger fortement son prix. Elle dépend des volumes, de la profondeur du carnet et de l’écart acheteur/vendeur.",
      "Certaines valeurs BRVM se négocient peu : sortir d’une position peut alors prendre du temps ou coûter cher en écart de prix.",
      "Sur OuestBourse, volumes manquants ou irréguliers se lisent souvent comme N/D : c’est un signal de prudence, pas une absence d’intérêt pour le titre.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Liquidity",
        url: "https://www.investopedia.com/terms/l/liquidity.asp",
      },
      {
        title: "Fidelity — Understanding liquidity",
        url: "https://www.fidelity.com/learning-center/trading-investing/trading/liquidity",
      },
    ],
  },

  volatilite: {
    details: [
      "La volatilité décrit l’amplitude et la fréquence des variations de prix. Une volatilité élevée signifie des mouvements plus larges — donc une incertitude plus grande sur le prochain cours.",
      "Elle n’est pas un jugement moral : un titre peut être volatil et solide fondamentalement, ou calme et fragile. C’est une mesure de dispersion, pas de « qualité ».",
      "OuestBourse utilise la volatilité historique des clôtures (quand la série est assez dense) pour enrichir le score de risque, jamais comme promesse de rendement.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Volatility",
        url: "https://www.investopedia.com/terms/v/volatility.asp",
      },
      {
        title: "StockCharts School — Historical Volatility",
        url: "https://school.stockcharts.com/doku.php?id=technical_indicators:historical_volatility",
      },
    ],
  },

  "marche-haussier-bull-market": {
    details: [
      "Un marché haussier (bull market) désigne une période où les cours progressent de façon durable, souvent accompagnée d’un climat d’optimisme et d’achats généralisés.",
      "Il n’existe pas de définition unique du seuil ou de la durée : l’horizon et l’indice retenus comptent. Une hausse courte n’est pas automatiquement un bull market.",
      "Même en tendance haussière, des corrections surviennent. Sur la BRVM comme ailleurs, le contexte (liquidité, secteurs) reste à croiser avec l’indice.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Bull market",
        url: "https://www.investopedia.com/terms/b/bullmarket.asp",
      },
      {
        title: "BRVM — Indices",
        url: "https://www.brvm.org/fr/indices",
      },
    ],
  },

  "marche-baissier-bear-market": {
    details: [
      "Un marché baissier (bear market) caractérise une baisse durable et généralisée des cours, souvent associée à un pessimisme dominant et à des ventes massives.",
      "Il ne faut pas confondre une correction ponctuelle avec un bear market. La qualification dépend de l’indice, de l’amplitude et de la durée observées.",
      "En phase baissière, la liquidité et la discipline de portefeuille comptent autant que le « timing ». Les indices BRVM aident à situer le climat, pas à prédire le retournement.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Bear market",
        url: "https://www.investopedia.com/terms/b/bearmarket.asp",
      },
      {
        title: "BRVM — Indices",
        url: "https://www.brvm.org/fr/indices",
      },
    ],
  },

  "ordre-de-bourse": {
    details: [
      "Un ordre de bourse est l’instruction donnée à un intermédiaire (SGI) pour acheter ou vendre un titre : sens, quantité, prix éventuel, durée de validité.",
      "Les types courants (au marché, à cours limité, etc.) conditionnent le prix d’exécution et le risque de non-exécution. Un cours affiché ≠ prix garanti.",
      "À la BRVM, l’ordre transitent via les SGI habilitées. Clarifier chaque paramètre avant validation limite les surprises en séance.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Order (finance)",
        url: "https://www.investopedia.com/terms/o/order.asp",
      },
      {
        title: "BRVM — Site officiel",
        url: "https://www.brvm.org",
      },
    ],
  },

  portefeuille: {
    details: [
      "Un portefeuille regroupe les placements détenus (actions, liquidités, etc.). Sa composition détermine le couple rendement/risque réellement supporté.",
      "La diversification réduit le risque spécifique à une valeur, mais pas le risque de marché global. Rééquilibrer et suivre l’allocation restent des gestes de base.",
      "Sur OuestBourse, /portefeuille calcule valeur, plus-value latente, répartition sectorielle et performance YTD à partir de vos positions enregistrées.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Portfolio",
        url: "https://www.investopedia.com/terms/p/portfolio.asp",
      },
      {
        title: "Fidelity — Portfolio diversification",
        url: "https://www.fidelity.com/learning-center/investment-products/mutual-funds/diversification",
      },
    ],
  },

  risque: {
    details: [
      "Le risque est la possibilité que le résultat réel diffère de celui attendu — y compris une perte en capital. Il n’existe pas de rendement sans exposition.",
      "Sur actions BRVM, on croise souvent risque de marché, de liquidité, de change (selon le contexte) et risque propre à l’émetteur.",
      "OuestBourse affiche des scores et signaux pour structurer la lecture ; ils n’éliminent pas le risque et ne constituent pas un conseil d’investissement.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Risk",
        url: "https://www.investopedia.com/terms/r/risk.asp",
      },
      {
        title: "Fidelity — Investment risk",
        url: "https://www.fidelity.com/learning-center/investment-products/mutual-funds/understanding-risk",
      },
    ],
  },

  "chiffre-d-affaires": {
    details: [
      "Le chiffre d’affaires (CA) mesure les ventes réalisées sur une période. C’est souvent le premier indicateur de dynamisme commercial d’une entreprise.",
      "Une croissance du CA n’implique pas automatiquement un bénéfice en hausse : les coûts, les marges et les éléments exceptionnels comptent.",
      "Pour les émetteurs BRVM, comparez le CA dans le temps et face au secteur, en vous appuyant sur les états financiers publiés plutôt que sur des rumeurs.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Revenue",
        url: "https://www.investopedia.com/terms/r/revenue.asp",
      },
      {
        title: "BRVM — Informations financières",
        url: "https://www.brvm.org/fr/informations-financieres",
      },
    ],
  },

  "benefice-net": {
    details: [
      "Le bénéfice net est le résultat restant après charges, éléments financiers et impôts, selon les comptes publiés. C’est un point de départ pour BPA et capacité de distribution.",
      "Lisez les annexes : un bénéfice peut être porté par des éléments non récurrents. Inversement, des charges exceptionnelles peuvent masquer une activité saine.",
      "Sur la BRVM, le bénéfice net annuel sert souvent de base à l’analyse de rentabilité et au débat sur le dividende en assemblée.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Net income",
        url: "https://www.investopedia.com/terms/n/netincome.asp",
      },
      {
        title: "BRVM — Informations financières",
        url: "https://www.brvm.org/fr/informations-financieres",
      },
    ],
  },

  "marge-beneficiaire": {
    details: [
      "La marge bénéficiaire rapporte le bénéfice au chiffre d’affaires (souvent en %). Elle mesure l’efficacité à transformer les ventes en résultat.",
      "On distingue notamment marge brute, opérationnelle et nette. Comparez surtout des sociétés du même secteur : les normes de marge varient fortement.",
      "Une marge qui s’érode peut signaler une pression concurrentielle ou des coûts en hausse, même si le CA progresse.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Profit margin",
        url: "https://www.investopedia.com/terms/p/profitmargin.asp",
      },
      {
        title: "BRVM — Informations financières",
        url: "https://www.brvm.org/fr/informations-financieres",
      },
    ],
  },

  "per-price-earnings-ratio": {
    details: [
      "Le PER (Price/Earnings) divise le cours de l’action par le bénéfice par action. Il indique combien le marché paie pour une unité de bénéfice.",
      "Un PER bas peut refléter une décote… ou des perspectives faibles / un risque élevé. Un PER élevé peut traduire de la croissance attendue ou une surévaluation.",
      "Sur OuestBourse, le PER alimente le score fondamental ; les extrêmes sont signalés comme facteurs à examiner, pas comme verdicts automatiques.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Price-to-Earnings Ratio (P/E)",
        url: "https://www.investopedia.com/terms/p/price-earningsratio.asp",
      },
      {
        title: "Fidelity — Understanding P/E ratio",
        url: "https://www.fidelity.com/learning-center/investment-products/stocks/about-price-earnings-ratio",
      },
    ],
  },

  "bpa-eps": {
    details: [
      "Le BPA (bénéfice par action, EPS en anglais) attribue le résultat net à chaque action en circulation. Formule usuelle : bénéfice attribuable / nombre moyen d’actions.",
      "Précisez si le BPA est de base ou dilué (options, convertibles). Un BPA en hausse n’implique pas toujours une hausse du cours.",
      "Sur les émetteurs BRVM, le BPA relie comptes publiés et comparaison entre titres de tailles différentes.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Earnings Per Share (EPS)",
        url: "https://www.investopedia.com/terms/e/eps.asp",
      },
      {
        title: "BRVM — Informations financières",
        url: "https://www.brvm.org/fr/informations-financieres",
      },
    ],
  },

  roe: {
    details: [
      "Le ROE (Return on Equity) mesure la rentabilité des capitaux propres : bénéfice net / capitaux propres (souvent moyens). Il indique ce que l’entreprise génère pour ses actionnaires.",
      "Un ROE élevé peut venir d’une activité rentable… ou d’un fort levier d’endettement. Croisez-le avec la dette et la qualité du bénéfice.",
      "Comparez le ROE dans le temps et au sein du même secteur BRVM pour éviter les conclusions trompeuses.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Return on Equity (ROE)",
        url: "https://www.investopedia.com/terms/r/returnonequity.asp",
      },
      {
        title: "BRVM — Informations financières",
        url: "https://www.brvm.org/fr/informations-financieres",
      },
    ],
  },

  "dette-equite": {
    details: [
      "Le ratio dette / équité (D/E) compare les dettes financières aux capitaux propres. Il synthétise le levier : plus il est élevé, plus l’entreprise s’appuie sur l’emprunt.",
      "Un levier peut amplifier les gains… et les pertes. La lecture dépend du secteur, des taux et de l’échéance des dettes.",
      "Pour un émetteur BRVM, croisez D/E avec la capacité de remboursement et la stabilité des flux plutôt que de juger un chiffre isolé.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Debt-to-Equity Ratio (D/E)",
        url: "https://www.investopedia.com/terms/d/debtequityratio.asp",
      },
      {
        title: "BRVM — Informations financières",
        url: "https://www.brvm.org/fr/informations-financieres",
      },
    ],
  },

  "capex-opex": {
    details: [
      "Les CAPEX (capital expenditures) sont des dépenses d’investissement (usines, équipements, réseaux). Les OPEX (operating expenses) couvrent les charges courantes d’exploitation.",
      "Des CAPEX élevés peuvent préparer la croissance future tout en pesant sur la trésorerie à court terme. Les OPEX impactent directement la marge opérationnelle.",
      "Lire ensemble CAPEX, OPEX et cash-flow évite de confondre investissement stratégique et dérive des coûts sur une société cotée BRVM.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — CapEx",
        url: "https://www.investopedia.com/terms/c/capitalexpenditure.asp",
      },
      {
        title: "Investopedia — Operating Expense (OPEX)",
        url: "https://www.investopedia.com/terms/o/operating_expense.asp",
      },
    ],
  },

  "rendement-du-dividende": {
    details: [
      "Le rendement du dividende = dividende annuel par action / cours. Il exprime le revenu distribué relatif au prix payé (hors plus-value de cours).",
      "Un rendement élevé peut venir d’un dividende généreux… ou d’une chute du cours. Vérifiez la récurrence et la couverture par les bénéfices.",
      "Sur OuestBourse, le rendement alimente le screener et le score ; les extrêmes sont plafonnés pour limiter les signaux trompeurs.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Dividend yield",
        url: "https://www.investopedia.com/terms/d/dividendyield.asp",
      },
      {
        title: "Fidelity — Dividend yield",
        url: "https://www.fidelity.com/learning-center/investment-products/stocks/dividend-yield",
      },
    ],
  },

  "date-ex-dividende": {
    details: [
      "La date ex-dividende (ex-date) est le jour à partir duquel l’acheteur du titre n’a plus droit au dividende annoncé. Le détenteur avant cette date reste éligible, sous réserve des règles de place.",
      "Autour de l’ex-date, le cours peut ajuster le montant du dividende détaché. Ce n’est pas une stratégie de gain « gratuit ».",
      "À la BRVM, priorisez toujours les dates officielles publiées par l’émetteur et la place plutôt qu’un calendrier informel.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Ex-Dividend Date",
        url: "https://www.investopedia.com/terms/e/ex-dividend.asp",
      },
      {
        title: "BRVM — Site officiel",
        url: "https://www.brvm.org",
      },
    ],
  },

  "capitalisation-boursiere": {
    details: [
      "La capitalisation boursière = cours × nombre d’actions. Elle estime la valeur de marché de l’entreprise telle que le marché la valorise à un instant donné.",
      "Elle évolue avec le cours et ne mesure pas à elle seule la valeur intrinsèque, la dette nette ou la liquidité du flottant.",
      "Sur OuestBourse, une capitalisation absente en base s’affiche N/D (jamais inventée). Comparez des tailles voisines au sein d’un même secteur BRVM.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Market capitalization",
        url: "https://www.investopedia.com/terms/m/marketcapitalization.asp",
      },
      {
        title: "BRVM — Entreprises cotées",
        url: "https://www.brvm.org/fr/entreprises-cotees",
      },
    ],
  },

  brvm: {
    details: [
      "La BRVM (Bourse Régionale des Valeurs Mobilières) est la bourse commune des États de l’UEMOA. Elle organise la cotation, la diffusion des informations et le cadre de négociation des titres.",
      "Siège à Abidjan, elle dessert plusieurs pays de l’union monétaire ouest-africaine. Les cours officiels et indices publiés par la BRVM sont une référence centrale pour OuestBourse.",
      "Investir via la BRVM passe par des intermédiaires habilités (SGI) et un cadre réglementaire régional — pas par un simple « site de cours » isolé.",
    ].join("\n\n"),
    sources: [
      {
        title: "BRVM — Site officiel",
        url: "https://www.brvm.org",
      },
      {
        title: "Wikipedia — Bourse régionale des valeurs mobilières",
        url: "https://fr.wikipedia.org/wiki/Bourse_r%C3%A9gionale_des_valeurs_mobili%C3%A8res",
      },
    ],
  },

  uemoa: {
    details: [
      "L’UEMOA (Union Économique et Monétaire Ouest-Africaine) regroupe des États partageant notamment le franc CFA et des politiques économiques coordonnées.",
      "Dans ce cadre, la BRVM constitue le marché boursier régional. La BCEAO assure notamment la politique monétaire de l’union.",
      "Comprendre l’UEMOA aide à situer la BRVM : une place unique pour plusieurs économies nationales liées par une monnaie commune.",
    ].join("\n\n"),
    sources: [
      {
        title: "BCEAO — Site officiel",
        url: "https://www.bceao.int",
      },
      {
        title: "Wikipedia — Union économique et monétaire ouest-africaine",
        url: "https://fr.wikipedia.org/wiki/Union_%C3%A9conomique_et_mon%C3%A9taire_ouest-africaine",
      },
    ],
  },

  sgi: {
    details: [
      "Une SGI (Société de Gestion et d’Intermédiation) est un intermédiaire habilité à recevoir et transmettre les ordres de bourse, conseiller et parfois gérer des portefeuilles dans le cadre réglementaire régional.",
      "C’est via une SGI que l’investisseur particulier ou institutionnel accède en pratique à la BRVM : ouverture de compte, ordres, conservation.",
      "Choisir une SGI implique de vérifier agrément, frais et services — la BRVM fournit le marché, la SGI exécute la relation client.",
    ].join("\n\n"),
    sources: [
      {
        title: "BRVM — Site officiel",
        url: "https://www.brvm.org",
      },
      {
        title: "Wikipedia — Société de gestion et d’intermédiation",
        url: "https://fr.wikipedia.org/wiki/Soci%C3%A9t%C3%A9_de_gestion_et_d%27interm%C3%A9diation",
      },
    ],
  },
};
