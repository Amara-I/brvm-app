/** Blocs pédagogiques riches (tableaux, listes, formules) pour les fiches Types de portefeuille. */

export type EducationContentBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | {
      type: "table";
      caption?: string;
      headers: string[];
      rows: string[][];
      footnote?: string;
    }
  | { type: "formula"; label?: string; text: string }
  | { type: "callout"; tone: "info" | "warn" | "tip"; text: string };

export const PORTFOLIO_TYPE_ARTICLE_BLOCKS: Record<string, EducationContentBlock[]> = {
  "types-de-portefeuille": [
    {
      type: "p",
      text: "L’objectif n’est pas de rechercher la performance maximale à n’importe quel prix, mais d’obtenir la meilleure croissance possible par rapport au risque, aux frais, au temps disponible et à la liquidité.",
    },
    {
      type: "p",
      text: "À la BRVM, les opérations sur les titres cotés passent par une SGI, avec un compte-titres et un compte espèces. Le marché fonctionne au comptant : il faut disposer des liquidités avant un achat et des titres avant une vente. Les frais doivent donc être intégrés dans toute stratégie, particulièrement dans le trading.",
    },
    {
      type: "callout",
      tone: "info",
      text: "Sur une fiche société, le sélecteur Croissance | Rente | Trading | Croissance Max change le cadrage d’analyse (critères, alertes, liens) sans inventer de chiffres ni modifier le signal OuestBourse.",
    },
    {
      type: "h2",
      text: "Les quatre types",
    },
    {
      type: "ul",
      items: [
        "Croissance — valorisation du capital sur le long terme, via la progression durable du chiffre d’affaires, des bénéfices, des marges et des flux de trésorerie.",
        "Rente — revenus réguliers (dividendes, coupons, éventuellement trésorerie / OPCVM adaptés), avec priorité à la stabilité plutôt qu’à la plus-value rapide.",
        "Trading — variations de prix à court ou moyen terme, règles écrites, liquidité et frais. Activité à risque élevé.",
        "Croissance Max — combinaison organisée des trois moteurs (croissance, dividendes, trading) dans des poches séparées, plus des liquidités.",
      ],
    },
    {
      type: "h2",
      text: "Tableau comparatif",
    },
    {
      type: "table",
      caption: "Synthèse pédagogique des quatre portefeuilles",
      headers: ["Portefeuille", "Objectif principal", "Horizon", "Risque", "Méthode"],
      rows: [
        ["Croissance", "Augmenter la valeur du capital", "Long terme", "Moyen à élevé", "Analyse fondamentale"],
        [
          "Rente",
          "Générer des revenus réguliers",
          "Moyen / long terme",
          "Faible à moyen",
          "Dividendes, obligations, stabilité",
        ],
        [
          "Trading",
          "Profiter des mouvements de cours",
          "Court / moyen terme",
          "Élevé",
          "Règles d’entrée, sortie et gestion du risque",
        ],
        [
          "Croissance Max",
          "Optimiser la croissance globale",
          "Tous horizons",
          "Moyen à élevé",
          "Combinaison organisée des trois poches",
        ],
      ],
      footnote:
        "Aucune allocation ne garantit un rendement. Les pourcentages des fiches détaillées sont des modèles pédagogiques, à adapter à la situation personnelle, au capital, à l’horizon et à la capacité à supporter les pertes.",
    },
    {
      type: "h2",
      text: "Structure solide (Croissance Max)",
    },
    {
      type: "ul",
      items: [
        "Une majorité en croissance long terme",
        "Une part significative en dividendes et obligations",
        "Une poche Trading limitée et strictement contrôlée",
        "Une réserve de liquidités",
        "Un rééquilibrage périodique",
        "Une évaluation de la performance après frais",
      ],
    },
    {
      type: "callout",
      tone: "warn",
      text: "Contenu pédagogique — pas un conseil d’investissement. Vérifiez les sources officielles (BRVM, états financiers, SGI) avant toute décision.",
    },
  ],
  "portefeuille-croissance": [
    {
      type: "h2",
      text: "Définition",
    },
    {
      type: "p",
      text: "Le portefeuille Croissance investit principalement dans des sociétés capables d’augmenter durablement leur chiffre d’affaires, leurs bénéfices, leurs marges, leur part de marché et leur capacité à générer des flux de trésorerie.",
    },
    {
      type: "p",
      text: "L’objectif principal est la valorisation du capital sur le long terme, généralement sur une période d’au moins cinq ans. Le dividende est secondaire : une entreprise de croissance peut distribuer peu de dividendes si elle réinvestit efficacement ses bénéfices.",
    },
    {
      type: "h2",
      text: "Profil recherché",
    },
    {
      type: "ul",
      items: [
        "Progression régulière",
        "Bon positionnement dans le secteur",
        "Capacité à financer le développement",
        "Direction crédible",
        "Potentiel de croissance supérieur à la moyenne du marché",
      ],
    },
    {
      type: "callout",
      tone: "info",
      text: "La BRVM distingue notamment le compartiment Croissance, destiné aux PME et aux entreprises à fort potentiel. Cette classification officielle ne suffit pas à elle seule pour sélectionner un titre : elle doit être complétée par une analyse financière (brvm.org).",
    },
    {
      type: "h2",
      text: "Comment le réaliser",
    },
    {
      type: "h3",
      text: "Étape 1 — Établir une liste de sélection",
    },
    {
      type: "table",
      caption: "Grille de questions (aucune case n’invente un chiffre : N/D si la donnée manque)",
      headers: ["Critère", "Question à poser"],
      rows: [
        ["Chiffre d’affaires", "Progresse-t-il régulièrement ?"],
        ["Résultat net", "Les bénéfices augmentent-ils ?"],
        ["Marge", "L’entreprise devient-elle plus rentable ?"],
        ["Dette", "La dette est-elle maîtrisée ?"],
        ["Trésorerie", "L’activité génère-t-elle réellement du cash ?"],
        ["Secteur", "Le secteur a-t-il encore un potentiel ?"],
        ["Gouvernance", "Les informations financières sont-elles régulières et fiables ?"],
        ["Valorisation", "Le cours n’intègre-t-il pas déjà toute la croissance attendue ?"],
      ],
    },
    {
      type: "h3",
      text: "Étape 2 — Éviter de confondre croissance et hausse du cours",
    },
    {
      type: "p",
      text: "Une action dont le cours augmente rapidement n’est pas nécessairement une action de croissance. Il faut vérifier que la hausse repose sur :",
    },
    {
      type: "ul",
      items: [
        "Une progression des bénéfices",
        "Une amélioration des perspectives",
        "Une situation financière solide",
        "Une demande durable pour les produits ou services",
      ],
    },
    {
      type: "h3",
      text: "Étape 3 — Acheter progressivement",
    },
    {
      type: "p",
      text: "Une méthode prudente consiste à investir par tranches : 30 % de la position initiale ; 30 % après confirmation des résultats ou du scénario ; 40 % progressivement si les fondamentaux restent favorables. Cela réduit le risque d’acheter tout le capital au mauvais moment.",
    },
    {
      type: "h2",
      text: "Allocation indicative",
    },
    {
      type: "table",
      headers: ["Composante", "Allocation"],
      rows: [
        ["Actions de croissance principales", "60 %"],
        ["Actions de croissance secondaires", "20 %"],
        ["Actions défensives de qualité", "10 %"],
        ["Liquidités", "10 %"],
      ],
      footnote:
        "Éviter qu’une seule société représente une part excessive. Limite indicative : 10 % à 15 % par ligne, selon la taille du portefeuille et le niveau de conviction. Modèle pédagogique, pas une garantie.",
    },
    {
      type: "h2",
      text: "Règles de sortie",
    },
    {
      type: "p",
      text: "Vendre ou réduire une position lorsque :",
    },
    {
      type: "ul",
      items: [
        "Les bénéfices se dégradent durablement",
        "La dette devient excessive",
        "La thèse d’investissement n’est plus valide",
        "La gouvernance devient préoccupante",
        "Le cours devient excessivement valorisé",
        "Une meilleure opportunité présente un rapport rendement-risque supérieur",
      ],
    },
    {
      type: "callout",
      tone: "tip",
      text: "Il ne faut pas vendre uniquement parce que le cours a baissé. La vraie question est : les fondamentaux ont-ils changé ?",
    },
  ],
  "portefeuille-rente": [
    {
      type: "h2",
      text: "Définition",
    },
    {
      type: "p",
      text: "Le portefeuille Rente vise à générer des revenus réguliers grâce aux dividendes des actions, aux coupons des obligations, et éventuellement aux produits de trésorerie ou OPCVM adaptés. L’objectif prioritaire n’est pas la plus-value rapide, mais la stabilité et la durabilité des revenus.",
    },
    {
      type: "h2",
      text: "Profil recherché",
    },
    {
      type: "p",
      text: "Ce portefeuille convient davantage à une personne qui :",
    },
    {
      type: "ul",
      items: [
        "Souhaite percevoir des revenus réguliers",
        "Accepte une croissance plus modérée du capital",
        "Investit avec un horizon long",
        "Veut limiter les opérations fréquentes",
        "Préfère la visibilité au potentiel spéculatif",
      ],
    },
    {
      type: "h2",
      text: "Comment le réaliser",
    },
    {
      type: "h3",
      text: "Étape 1 — Analyser la qualité du dividende",
    },
    {
      type: "p",
      text: "Ne pas retenir uniquement les actions offrant le rendement le plus élevé. Il faut vérifier :",
    },
    {
      type: "ul",
      items: [
        "La régularité des dividendes sur plusieurs années",
        "Le taux de distribution",
        "La progression du bénéfice",
        "La capacité à générer du cash",
        "Le niveau d’endettement",
        "La stabilité du secteur",
      ],
    },
    {
      type: "callout",
      tone: "warn",
      text: "Un dividende élevé peut être exceptionnel et non récurrent. Il peut également refléter un cours fortement déprécié.",
    },
    {
      type: "h3",
      text: "Étape 2 — Diversifier les sources de revenus",
    },
    {
      type: "p",
      text: "Un portefeuille de rente ne devrait pas dépendre d’une seule entreprise, d’un seul secteur, d’une seule échéance obligataire, ni d’un seul pays ou risque économique.",
    },
    {
      type: "p",
      text: "La BRVM comporte un marché actions et un marché obligataire. Les obligations peuvent donc compléter les actions à dividendes, mais elles doivent également être étudiées selon l’émetteur, la maturité, le coupon et le risque de remboursement (brvm.org).",
    },
    {
      type: "h3",
      text: "Étape 3 — Réinvestir les revenus",
    },
    {
      type: "p",
      text: "Pendant la phase de constitution du capital, les dividendes et coupons peuvent être réinvestis dans les lignes sous-pondérées, les actions de qualité temporairement moins chères, les obligations, ou la trésorerie en attente d’opportunités.",
    },
    {
      type: "h2",
      text: "Allocation indicative",
    },
    {
      type: "table",
      headers: ["Composante", "Allocation"],
      rows: [
        ["Actions à dividendes durables", "45 %"],
        ["Obligations", "35 %"],
        ["Actions défensives", "10 %"],
        ["Liquidités", "10 %"],
      ],
      footnote:
        "Pour une personne déjà à la retraite ou ayant besoin d’un revenu stable, la part obligataire peut être plus importante. Pour une personne encore en phase d’accumulation, la part actions peut être renforcée.",
    },
    {
      type: "h2",
      text: "Indicateurs importants",
    },
    {
      type: "p",
      text: "Le rendement du portefeuille doit être calculé ainsi :",
    },
    {
      type: "formula",
      label: "Rendement courant",
      text: "Rendement courant = (dividendes annuels + coupons annuels) / valeur actuelle du portefeuille",
    },
    {
      type: "p",
      text: "Mais il faut aussi suivre le rendement total :",
    },
    {
      type: "formula",
      label: "Rendement total",
      text: "Rendement total = (revenus encaissés + plus-value ou moins-value) / capital investi",
    },
    {
      type: "callout",
      tone: "warn",
      text: "Un portefeuille qui verse 8 % de revenus mais perd 15 % en capital n’est pas nécessairement performant. Ces pourcentages sont un exemple pédagogique, pas une prévision.",
    },
  ],
  "portefeuille-trading": [
    {
      type: "h2",
      text: "Définition",
    },
    {
      type: "p",
      text: "Le portefeuille Trading cherche à profiter des variations de prix à court ou moyen terme. Il ne repose pas principalement sur les dividendes ou la valeur intrinsèque de l’entreprise, mais sur les tendances de cours, les volumes, les niveaux de support et de résistance, les annonces financières, les mouvements sectoriels et la liquidité du titre.",
    },
    {
      type: "callout",
      tone: "warn",
      text: "Le trading doit être considéré comme une activité à risque élevé. À la BRVM, la liquidité de certaines valeurs peut être limitée : un investisseur peut ne pas trouver rapidement une contrepartie au prix souhaité. Il faut donc privilégier les titres suffisamment échangés et consulter les bulletins officiels de la cote. La BRVM publie notamment le BRVM-30, qui regroupe les valeurs les plus échangées sur un trimestre (brvm.org).",
    },
    {
      type: "h2",
      text: "Comment le réaliser correctement",
    },
    {
      type: "h3",
      text: "1. Définir un horizon",
    },
    {
      type: "ul",
      items: [
        "Court terme : quelques jours à quelques semaines",
        "Swing trading : quelques semaines à quelques mois",
        "Position trading : plusieurs mois",
      ],
    },
    {
      type: "p",
      text: "Il faut éviter de changer de méthode après chaque perte.",
    },
    {
      type: "h3",
      text: "2. Utiliser uniquement des règles écrites",
    },
    {
      type: "p",
      text: "Avant chaque opération, définir : le prix d’entrée ; la raison de l’achat ; le niveau d’invalidation ; l’objectif de gain ; la durée maximale de détention ; la taille de la position.",
    },
    {
      type: "callout",
      tone: "info",
      text: "Exemple pédagogique (pas une recommandation) : achat à 5 000 FCFA, scénario invalidé sous 4 600 FCFA, objectif initial à 5 800 FCFA, risque maximal égal à 1 % du portefeuille.",
    },
    {
      type: "h3",
      text: "3. Limiter le risque par opération",
    },
    {
      type: "p",
      text: "Une règle prudente consiste à ne pas risquer plus de 0,5 % à 1 % du capital total par opération. La taille de la position peut être calculée ainsi :",
    },
    {
      type: "formula",
      label: "Taille de position",
      text: "Taille de position = (capital × risque maximal) / (prix d’entrée − prix d’invalidation)",
    },
    {
      type: "p",
      text: "Exemple pédagogique : capital 10 000 000 FCFA ; risque maximal 1 % = 100 000 FCFA ; achat 5 000 FCFA ; invalidation 4 500 FCFA ; risque par action 500 FCFA.",
    },
    {
      type: "formula",
      label: "Nombre maximal d’actions",
      text: "Nombre maximal d’actions = 100 000 / 500 = 200 actions",
    },
    {
      type: "p",
      text: "Cette méthode permet de contrôler le risque indépendamment du prix du titre. Sur OuestBourse, la calculette /outils/taille-position applique la même logique.",
    },
    {
      type: "h3",
      text: "4. Intégrer les frais et la liquidité",
    },
    {
      type: "p",
      text: "Une opération n’est intéressante que si le gain potentiel dépasse suffisamment : les frais de courtage ; les commissions de marché ; les taxes éventuelles ; l’écart entre prix d’achat et prix de vente ; le risque de mauvaise exécution.",
    },
    {
      type: "p",
      text: "La BRVM indique que l’avis d’opéré doit présenter notamment le cours exécuté, les frais de courtage, les commissions liées à la BRVM et au Dépositaire Central / Banque de Règlement, ainsi que les taxes et le montant net de la transaction (brvm.org).",
    },
    {
      type: "h3",
      text: "5. Mesurer la performance réelle",
    },
    {
      type: "ul",
      items: [
        "Taux de réussite",
        "Gain moyen et perte moyenne",
        "Ratio gain / perte",
        "Perte maximale",
        "Rendement après frais",
        "Nombre d’opérations",
        "Performance par rapport au BRVM-30 ou au BRVM Composite",
      ],
    },
    {
      type: "h2",
      text: "Allocation indicative",
    },
    {
      type: "p",
      text: "Le portefeuille Trading ne devrait généralement pas représenter la totalité du patrimoine investi :",
    },
    {
      type: "table",
      headers: ["Composante", "Allocation"],
      rows: [
        ["Positions de trading", "60 % du portefeuille trading"],
        ["Liquidités disponibles", "30 %"],
        ["Réserve d’opportunité ou protection", "10 %"],
      ],
      footnote:
        "Il est préférable de commencer avec une taille réduite et d’augmenter progressivement uniquement après avoir démontré une performance régulière après frais.",
    },
  ],
  "portefeuille-croissance-max": [
    {
      type: "h2",
      text: "Définition",
    },
    {
      type: "p",
      text: "Le portefeuille Croissance Max combine trois moteurs : Croissance (valorisation durable du capital) ; Dividendes (revenus et réinvestissement) ; Trading (exploitation d’opportunités à court ou moyen terme).",
    },
    {
      type: "p",
      text: "Son objectif n’est pas de prendre le maximum de risque, mais de rechercher une croissance optimisée du portefeuille, grâce à une séparation claire des rôles.",
    },
    {
      type: "callout",
      tone: "warn",
      text: "La principale erreur serait de mélanger toutes les positions sans règles distinctes. Une action achetée pour le trading ne doit pas automatiquement devenir une action de long terme parce que son cours baisse.",
    },
    {
      type: "h2",
      text: "Structure recommandée",
    },
    {
      type: "h3",
      text: "Modèle équilibré",
    },
    {
      type: "table",
      headers: ["Poche", "Fonction", "Allocation"],
      rows: [
        ["Croissance long terme", "Création de valeur", "50 %"],
        ["Dividendes et rente", "Revenus et stabilité", "25 %"],
        ["Trading", "Opportunités tactiques", "15 %"],
        ["Liquidités", "Protection et opportunités", "10 %"],
      ],
    },
    {
      type: "h3",
      text: "Modèle plus offensif",
    },
    {
      type: "table",
      headers: ["Poche", "Allocation"],
      rows: [
        ["Croissance", "55 %"],
        ["Dividendes", "20 %"],
        ["Trading", "20 %"],
        ["Liquidités", "5 %"],
      ],
    },
    {
      type: "h3",
      text: "Modèle plus prudent",
    },
    {
      type: "table",
      headers: ["Poche", "Allocation"],
      rows: [
        ["Croissance", "40 %"],
        ["Dividendes et obligations", "35 %"],
        ["Trading", "10 %"],
        ["Liquidités", "15 %"],
      ],
      footnote:
        "La répartition optimale dépend de l’horizon, du capital, des revenus, de la tolérance aux pertes et du temps disponible. Modèles pédagogiques uniquement.",
    },
    {
      type: "h2",
      text: "Méthode optimale de fonctionnement",
    },
    {
      type: "h3",
      text: "1. Séparer les poches",
    },
    {
      type: "ul",
      items: [
        "Poche Croissance : décisions trimestrielles ou semestrielles",
        "Poche Rente : suivi des dividendes, coupons et risques",
        "Poche Trading : décisions régies par un plan écrit",
        "Poche Liquidités : réserve non investie",
      ],
    },
    {
      type: "p",
      text: "Cette séparation évite de vendre une bonne action de long terme à cause d’un mouvement temporaire, ou de conserver une mauvaise position de trading par émotion.",
    },
    {
      type: "h3",
      text: "2. Utiliser un système de notation",
    },
    {
      type: "p",
      text: "Chaque action peut être notée sur 100 (grille pédagogique — à renseigner seulement avec des données réelles, sinon N/D) :",
    },
    {
      type: "table",
      headers: ["Critère", "Pondération"],
      rows: [
        ["Croissance du chiffre d’affaires et du bénéfice", "25"],
        ["Rentabilité et marges", "20"],
        ["Solidité financière", "15"],
        ["Régularité du dividende", "15"],
        ["Valorisation", "15"],
        ["Liquidité et qualité de l’information", "10"],
      ],
    },
    {
      type: "ul",
      items: [
        "80 à 100 : priorité élevée",
        "65 à 79 : surveillance ou achat progressif",
        "50 à 64 : position limitée",
        "Moins de 50 : éviter ou vendre selon la situation",
      ],
    },
    {
      type: "callout",
      tone: "tip",
      text: "Ce système ne remplace pas l’analyse, mais il réduit les décisions émotionnelles. OuestBourse n’attribue pas automatiquement cette note de 100 : le score plateforme (0–100) est un autre calcul, documenté dans Éducation.",
    },
    {
      type: "h3",
      text: "3. Construire progressivement",
    },
    {
      type: "ol",
      items: [
        "Investir d’abord une partie dans la poche Croissance",
        "Constituer la poche Rente",
        "Conserver une réserve de liquidités",
        "Commencer le trading avec une petite allocation",
        "Augmenter la poche Trading uniquement si les résultats sont réguliers",
      ],
    },
    {
      type: "p",
      text: "Il est préférable de ne pas investir tout le capital le même jour. Un investissement progressif permet de réduire le risque lié au mauvais timing.",
    },
    {
      type: "h3",
      text: "4. Rééquilibrer périodiquement",
    },
    {
      type: "p",
      text: "Un rééquilibrage peut être effectué tous les six mois ou une fois par an. Exemple pédagogique : objectif Trading 15 % ; la poche monte à 25 % après une hausse ; vendre une partie pour revenir vers 15 % ; transférer éventuellement les gains vers la croissance ou la rente.",
    },
    {
      type: "p",
      text: "Le rééquilibrage impose de prendre des bénéfices et évite qu’une seule stratégie domine tout le portefeuille.",
    },
    {
      type: "h3",
      text: "5. Mesurer le rendement total",
    },
    {
      type: "p",
      text: "Il faut inclure les dividendes, les coupons, les plus-values réalisées, les plus-values latentes, les frais, les pertes et les liquidités non investies.",
    },
    {
      type: "formula",
      label: "Rendement net",
      text: "Rendement net = (valeur finale + revenus encaissés − capital investi − frais) / capital investi",
    },
    {
      type: "p",
      text: "Il est également utile de comparer la performance à un indice de référence, par exemple le BRVM Composite ou le BRVM-30. La BRVM publie ces indices ainsi que des indices sectoriels et un indice Composite Total Return (brvm.org).",
    },
  ],
  "portefeuille-regles-communes": [
    {
      type: "h2",
      text: "Diversification raisonnable",
    },
    {
      type: "p",
      text: "La diversification doit porter sur plusieurs sociétés, plusieurs secteurs, plusieurs pays de l’UEMOA lorsque cela est pertinent, plusieurs types de revenus, et plusieurs échéances pour les obligations.",
    },
    {
      type: "callout",
      tone: "info",
      text: "Une diversification excessive rend le portefeuille difficile à suivre. Une dizaine à une quinzaine de lignes bien étudiées peut être plus efficace que plusieurs dizaines de positions mal suivies.",
    },
    {
      type: "h2",
      text: "Ne jamais investir l’argent nécessaire à court terme",
    },
    {
      type: "p",
      text: "La BRVM recommande notamment d’investir une épargne dont l’investisseur n’a pas besoin au quotidien et de diversifier sans se disperser (brvm.org).",
    },
    {
      type: "h2",
      text: "Éviter l’achat sur recommandation seule",
    },
    {
      type: "p",
      text: "Avant chaque achat, il faut pouvoir répondre à quatre questions :",
    },
    {
      type: "ol",
      items: [
        "Pourquoi acheter ce titre ?",
        "Quel est le scénario attendu ?",
        "Quel risque peut invalider ce scénario ?",
        "Dans quelles conditions vais-je vendre ?",
      ],
    },
    {
      type: "h2",
      text: "Journal de portefeuille",
    },
    {
      type: "p",
      text: "Pour chaque opération, conserver : date ; titre ; quantité ; prix ; frais ; stratégie utilisée ; objectif ; niveau de risque ; résultat ; erreur éventuelle. Ce journal est particulièrement important pour le portefeuille Trading.",
    },
    {
      type: "h2",
      text: "Rappel de synthèse",
    },
    {
      type: "table",
      headers: ["Portefeuille", "Objectif", "Horizon", "Risque"],
      rows: [
        ["Croissance", "Augmenter la valeur du capital", "Long terme", "Moyen à élevé"],
        ["Rente", "Générer des revenus réguliers", "Moyen / long terme", "Faible à moyen"],
        ["Trading", "Profiter des mouvements de cours", "Court / moyen terme", "Élevé"],
        ["Croissance Max", "Optimiser la croissance globale", "Tous horizons", "Moyen à élevé"],
      ],
    },
    {
      type: "callout",
      tone: "warn",
      text: "Important : aucune allocation ne garantit un rendement. Les pourcentages proposés sont des modèles pédagogiques et doivent être adaptés à la situation personnelle, au capital disponible, à l’horizon et à la capacité de supporter les pertes.",
    },
  ],
};
