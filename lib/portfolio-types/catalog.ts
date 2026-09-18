import type { PortfolioTypeId } from "./constants";

export const PORTFOLIO_TYPE_THEME_SLUG = "types-de-portefeuille";

export type AllocationRow = { component: string; allocation: string };

export type PortfolioTypeCta = {
  href: string;
  label: string;
};

export interface PortfolioTypeDef {
  id: PortfolioTypeId;
  label: string;
  shortLabel: string;
  tagline: string;
  objective: string;
  horizon: string;
  risk: string;
  method: string;
  educationSlug: string;
  educationHref: string;
  /** Métriques existantes à mettre en avant (présentation uniquement). */
  emphasisKeys: Array<
    | "perf5"
    | "perf10"
    | "yield"
    | "risk"
    | "confidence"
    | "fundamental"
    | "technical"
    | "liquidity"
    | "longHorizon"
    | "shortHorizon"
  >;
  checklist: string[];
  warnings: string[];
  filterHints: string[];
  ctas: PortfolioTypeCta[];
  allocation: AllocationRow[];
  allocationNote: string;
  simulationLead: string;
  simulationHints: string[];
  /** Paramètres pédagogiques proposés — l’utilisateur peut les appliquer ou les ignorer. */
  simulationSuggest: {
    years: string;
    fees: string;
    spread: string;
    note: string;
  };
}

const EDU = (slug: string) => `/education/${PORTFOLIO_TYPE_THEME_SLUG}/${slug}`;

export const PORTFOLIO_TYPE_DEFS: Record<PortfolioTypeId, PortfolioTypeDef> = {
  CROISSANCE: {
    id: "CROISSANCE",
    label: "Croissance",
    shortLabel: "Croissance",
    tagline: "Valoriser le capital sur le long terme via les fondamentaux.",
    objective: "Augmenter la valeur du capital",
    horizon: "Long terme (généralement au moins cinq ans)",
    risk: "Moyen à élevé",
    method: "Analyse fondamentale",
    educationSlug: "portefeuille-croissance",
    educationHref: EDU("portefeuille-croissance"),
    emphasisKeys: ["perf5", "fundamental", "longHorizon", "confidence", "risk"],
    checklist: [
      "Le chiffre d’affaires progresse-t-il régulièrement ?",
      "Les bénéfices (résultat net) augmentent-ils ?",
      "L’entreprise devient-elle plus rentable (marges) ?",
      "La dette est-elle maîtrisée ?",
      "L’activité génère-t-elle réellement du cash ?",
      "Le secteur a-t-il encore un potentiel ?",
      "Les informations financières sont-elles régulières et fiables ?",
      "Le cours n’intègre-t-il pas déjà toute la croissance attendue ?",
    ],
    warnings: [
      "Une hausse rapide du cours n’est pas, à elle seule, une thèse de croissance.",
      "Le dividende est secondaire : une entreprise de croissance peut distribuer peu si elle réinvestit efficacement.",
      "Le compartiment Croissance de la BRVM ne suffit pas à sélectionner un titre — il faut l’analyse financière.",
      "Ne vendez pas uniquement parce que le cours a baissé : les fondamentaux ont-ils changé ?",
    ],
    filterHints: [
      "Privilégier un historique de comptes et de cours assez long pour juger la progression.",
      "Comparer la valorisation (PER) au secteur plutôt que de retenir le titre « qui monte ».",
      "Limiter une ligne à environ 10–15 % du portefeuille (modèle pédagogique).",
    ],
    ctas: [
      { href: EDU("portefeuille-croissance"), label: "Guide Croissance" },
      { href: "/screener", label: "Screener (croissance / valorisation)" },
    ],
    allocation: [
      { component: "Actions de croissance principales", allocation: "60 %" },
      { component: "Actions de croissance secondaires", allocation: "20 %" },
      { component: "Actions défensives de qualité", allocation: "10 %" },
      { component: "Liquidités", allocation: "10 %" },
    ],
    allocationNote:
      "Modèle pédagogique. Achat progressif indicatif : 30 % / 30 % / 40 %. Aucune allocation ne garantit un rendement.",
    simulationLead:
      "Projection de capital à long terme : l’horizon et les versements comptent plus qu’un rendement « maximal ».",
    simulationHints: [
      "Horizon pédagogique : au moins 5 ans — cohérent avec une thèse de croissance.",
      "Investir par tranches plutôt que tout le capital le même jour.",
      "Conserver une poche de liquidités (~10 % dans le modèle) pour lisser le timing.",
    ],
    simulationSuggest: {
      years: "10",
      fees: "0.5",
      spread: "3",
      note: "Hypothèse longue (10 ans) et frais modérés — à adapter à votre SGI, pas un rendement promis.",
    },
  },
  RENTE: {
    id: "RENTE",
    label: "Rente",
    shortLabel: "Rente",
    tagline: "Revenus réguliers : qualité du dividende, pas le rendement le plus élevé.",
    objective: "Générer des revenus réguliers",
    horizon: "Moyen / long terme",
    risk: "Faible à moyen",
    method: "Dividendes, obligations, stabilité",
    educationSlug: "portefeuille-rente",
    educationHref: EDU("portefeuille-rente"),
    emphasisKeys: ["yield", "risk", "confidence", "fundamental", "perf5"],
    checklist: [
      "Le dividende est-il régulier sur plusieurs années ?",
      "Le taux de distribution est-il soutenable ?",
      "Le bénéfice progresse-t-il, ou le rendement élevé vient-il d’un cours déprécié ?",
      "L’entreprise génère-t-elle du cash pour payer le coupon / dividende ?",
      "L’endettement reste-t-il compatible avec une distribution durable ?",
      "Le secteur est-il relativement stable ?",
      "Les revenus ne dépendent-ils pas d’une seule entreprise, d’un seul secteur ou d’un seul pays ?",
    ],
    warnings: [
      "Un dividende élevé peut être exceptionnel, non récurrent, ou le miroir d’un cours fortement déprécié.",
      "Un portefeuille qui verse 8 % de revenus mais perd 15 % en capital n’est pas nécessairement performant.",
      "Distinguer rendement courant (revenus / valeur actuelle) et rendement total (revenus + variation de capital).",
      "Les obligations BRVM peuvent compléter les actions à dividendes : étudier émetteur, maturité, coupon et risque de remboursement.",
    ],
    filterHints: [
      "Ne pas trier uniquement par rendement du dividende le plus élevé.",
      "Vérifier la régularité des distributions et la profondeur d’historique.",
      "Diversifier les sources de revenus (sociétés, secteurs, pays UEMOA, échéances obligataires).",
    ],
    ctas: [
      { href: EDU("portefeuille-rente"), label: "Guide Rente" },
      { href: "/screener", label: "Screener (dividendes)" },
    ],
    allocation: [
      { component: "Actions à dividendes durables", allocation: "45 %" },
      { component: "Obligations", allocation: "35 %" },
      { component: "Actions défensives", allocation: "10 %" },
      { component: "Liquidités", allocation: "10 %" },
    ],
    allocationNote:
      "À la retraite, la part obligataire peut être plus importante ; en phase d’accumulation, la part actions peut être renforcée. Modèle pédagogique.",
    simulationLead:
      "La simulation projette le capital : pour une rente, relisez aussi le rendement courant vs le rendement total (plus-value ou moins-value incluse).",
    simulationHints: [
      "Pendant la constitution du capital, les dividendes peuvent être réinvestis (lignes sous-pondérées, qualité temporairement moins chère, obligations, trésorerie).",
      "Un rendement de revenus élevé ne compense pas forcément une baisse de capital.",
      "Horizon pédagogique : moyen / long terme, peu d’opérations fréquentes.",
    ],
    simulationSuggest: {
      years: "12",
      fees: "0.5",
      spread: "2",
      note: "Horizon long et écart de scénarios plus serré — illustration de stabilité, pas une promesse de coupon.",
    },
  },
  TRADING: {
    id: "TRADING",
    label: "Trading",
    shortLabel: "Trading",
    tagline: "Mouvements de cours, liquidité, taille de position et règles écrites.",
    objective: "Profiter des mouvements de cours",
    horizon: "Court / moyen terme",
    risk: "Élevé",
    method: "Règles d’entrée, de sortie et de gestion du risque",
    educationSlug: "portefeuille-trading",
    educationHref: EDU("portefeuille-trading"),
    emphasisKeys: ["risk", "liquidity", "technical", "shortHorizon", "confidence"],
    checklist: [
      "Le titre est-il suffisamment échangé (liquidité, BRVM-30 / bulletin officiel de la cote) ?",
      "L’horizon est-il écrit (court terme, swing, position) — et tenu après une perte ?",
      "Prix d’entrée, raison, invalidation, objectif, durée max et taille sont-ils définis avant l’ordre ?",
      "Le risque par opération reste-t-il ≤ 0,5 % à 1 % du capital ?",
      "Le gain potentiel dépasse-t-il frais SGI + commissions BRVM/DCBR + taxes + fourchette + risque d’exécution ?",
      "La performance est-elle mesurée après frais (taux de réussite, gain/perte moyen, drawdown) ?",
    ],
    warnings: [
      "Activité à risque élevé : la liquidité BRVM de certaines valeurs est limitée — contrepartie au prix souhaité non garantie.",
      "Intégrer les frais dans chaque opération : avis d’opéré (cours, courtage, commissions, taxes, net).",
      "Le portefeuille Trading ne devrait généralement pas représenter la totalité du patrimoine investi.",
      "Une action achetée pour le trading ne doit pas devenir automatiquement une action de long terme parce que son cours baisse.",
    ],
    filterHints: [
      "Privilégier les titres suffisamment échangés ; consulter les bulletins officiels et le BRVM-30.",
      "Dimensionner la position à partir du risque (capital × risque max / distance d’invalidation), pas du « nombre d’actions qu’on aime ».",
      "Commencer petit ; n’augmenter la taille qu’après une performance régulière après frais.",
    ],
    ctas: [
      { href: EDU("portefeuille-trading"), label: "Guide Trading" },
      { href: "/outils/taille-position", label: "Calculette taille de position" },
      { href: "/graphes", label: "Graphes (tendance, volumes)" },
    ],
    allocation: [
      { component: "Positions de trading", allocation: "60 % du portefeuille trading" },
      { component: "Liquidités disponibles", allocation: "30 %" },
      { component: "Réserve d’opportunité ou protection", allocation: "10 %" },
    ],
    allocationNote:
      "Ceci encadre le portefeuille de trading, pas l’ensemble du patrimoine. Modèle pédagogique.",
    simulationLead:
      "Une projection buy-and-hold sous-estime les frais de rotation : ici, le cadrage insiste sur coûts, liquidité et risque par trade.",
    simulationHints: [
      "Ne pas interpréter la courbe comme un plan de trading : c’est une projection pédagogique de capital.",
      "Frais : plus la rotation est fréquente, plus le rendement net s’érode — relevez le % de frais pour l’illustrer.",
      "Règle prudente : 0,5 % à 1 % du capital risqué par opération (voir calculette).",
    ],
    simulationSuggest: {
      years: "3",
      fees: "1.5",
      spread: "5",
      note: "Horizon plus court, frais et écart plus élevés pour illustrer le coût du trading — pas un scénario réel de vos trades.",
    },
  },
  CROISSANCE_MAX: {
    id: "CROISSANCE_MAX",
    label: "Croissance Max",
    shortLabel: "Croiss. Max",
    tagline: "Trois poches distinctes : croissance, rente, trading — plus des liquidités.",
    objective: "Optimiser la croissance globale du portefeuille",
    horizon: "Tous horizons",
    risk: "Moyen à élevé",
    method: "Combinaison organisée des trois poches",
    educationSlug: "portefeuille-croissance-max",
    educationHref: EDU("portefeuille-croissance-max"),
    emphasisKeys: ["fundamental", "yield", "technical", "risk", "confidence"],
    checklist: [
      "Dans quelle poche classer ce titre (croissance, rente, trading) — et pourquoi ?",
      "Les règles de la poche sont-elles écrites et distinctes ?",
      "Une baisse de cours ferait-elle glisser à tort une position de trading vers le long terme ?",
      "La notation 100 pts (CA/bénéfice, marges, solidité, dividende, valorisation, liquidité) est-elle renseignée sans inventer de chiffre ?",
      "Le rééquilibrage périodique (6–12 mois) est-il prévu si une poche dérive ?",
    ],
    warnings: [
      "L’erreur principale : mélanger toutes les positions sans règles distinctes.",
      "Ce n’est pas « prendre le maximum de risque » : c’est séparer les rôles pour une croissance organisée.",
      "Le système de notation (80–100 priorité, etc.) ne remplace pas l’analyse.",
      "Mesurer le rendement net après frais, y compris liquidités non investies, et comparer à un indice (BRVM Composite / BRVM-30).",
    ],
    filterHints: [
      "Poche Croissance : décisions trimestrielles ou semestrielles.",
      "Poche Rente : suivi des dividendes, coupons et risques.",
      "Poche Trading : plan écrit, taille limitée, résultats après frais avant d’augmenter l’allocation.",
      "Poche Liquidités : réserve non investie, protection et opportunités.",
    ],
    ctas: [
      { href: EDU("portefeuille-croissance-max"), label: "Guide Croissance Max" },
      { href: EDU("portefeuille-regles-communes"), label: "Règles communes" },
      { href: "/simulation", label: "Simulation (perspective poches)" },
    ],
    allocation: [
      { component: "Croissance long terme (création de valeur)", allocation: "50 %" },
      { component: "Dividendes et rente (revenus et stabilité)", allocation: "25 %" },
      { component: "Trading (opportunités tactiques)", allocation: "15 %" },
      { component: "Liquidités (protection et opportunités)", allocation: "10 %" },
    ],
    allocationNote:
      "Modèle équilibré. Variantes pédagogiques : offensif 55/20/20/5 ; prudent 40/35/10/15. À adapter à l’horizon, au capital et au temps disponible.",
    simulationLead:
      "La courbe unique ne montre pas les poches : lisez l’allocation et rééquilibrez plutôt que de tout traiter comme une seule stratégie.",
    simulationHints: [
      "Construire progressivement : croissance d’abord, puis rente, réserve, trading petit, augmenter le trading seulement si les résultats sont réguliers.",
      "Si le trading passe de 15 % à 25 % après une hausse, l’exemple pédagogique consiste à ramener vers 15 %.",
      "Rendement net = (valeur finale + revenus − capital investi − frais) / capital investi.",
    ],
    simulationSuggest: {
      years: "8",
      fees: "0.8",
      spread: "4",
      note: "Horizon mixte et frais un peu plus élevés qu’un buy-and-hold pur (poche trading) — illustration, pas un backtest.",
    },
  },
};

export const PORTFOLIO_TYPE_LIST: PortfolioTypeDef[] = PORTFOLIO_TYPE_IDS_TO_LIST();

function PORTFOLIO_TYPE_IDS_TO_LIST(): PortfolioTypeDef[] {
  return (["CROISSANCE", "RENTE", "TRADING", "CROISSANCE_MAX"] as const).map(
    (id) => PORTFOLIO_TYPE_DEFS[id]
  );
}

export function getPortfolioTypeDef(id: PortfolioTypeId): PortfolioTypeDef {
  return PORTFOLIO_TYPE_DEFS[id];
}

export const PORTFOLIO_TYPE_COMPARISON_HEADERS = [
  "Portefeuille",
  "Objectif principal",
  "Horizon",
  "Risque",
  "Méthode",
] as const;

export const PORTFOLIO_TYPE_COMPARISON_ROWS: string[][] = PORTFOLIO_TYPE_LIST.map((d) => [
  d.label,
  d.objective,
  d.horizon,
  d.risk,
  d.method,
]);

export const COMMON_PORTFOLIO_RULES = [
  "Diversifier sans se disperser : plusieurs sociétés, secteurs, pays UEMOA si pertinent, types de revenus et échéances obligataires — une dizaine à une quinzaine de lignes bien suivies vaut mieux que des dizaines de positions mal suivies.",
  "Ne jamais investir l’argent nécessaire à court terme. La BRVM recommande d’investir une épargne dont on n’a pas besoin au quotidien.",
  "Avant chaque achat : pourquoi ce titre ? quel scénario ? quel risque l’invalide ? dans quelles conditions vendre ?",
  "Tenir un journal (date, titre, quantité, prix, frais, stratégie, objectif, risque, résultat, erreur) — surtout pour le trading.",
];
