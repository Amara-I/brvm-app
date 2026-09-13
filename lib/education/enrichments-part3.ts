export type TermEnrichment = {
  details: string;
  sources: { title: string; url: string }[];
};

export const ENRICHMENTS_PART3: Record<string, TermEnrichment> = {
  "signal-ouestbourse": {
    details:
      "Le signal OuestBourse (ACHAT FORT, ACHAT, CONSERVER, ALLÉGER, VENDRE) résume un score composite et des facteurs ▲/▼/● affichés sur la fiche. Il sert d’aide pédagogique à la décision, pas d’ordre de bourse ni de conseil personnalisé.\n\nLisez toujours le libellé avec la confiance et les raisons affichées : un ACHAT à confiance faible n’a pas le même poids qu’un ACHAT à confiance élevée. Croisez ensuite avec liquidité, états financiers et votre horizon.\n\nAucune recommandation OuestBourse ne remplace un interlocuteur habilité (SGI, conseiller) ni les publications officielles de la BRVM.",
    sources: [
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
      {
        title: "Investopedia — Investment Analysis",
        url: "https://www.investopedia.com/terms/i/investment-analysis.asp",
      },
    ],
  },

  "score-composite": {
    details:
      "Le score composite (0–100) agrège score technique, score fondamental, ajustement au risque et une composante sectorielle. Plus il est élevé, plus le signal tend vers l’achat — sous réserve de risque et de confiance.\n\nUn score fort avec risque trop élevé ou historique trop court ne pourra pas produire un ACHAT FORT. Inversement, un score moyen avec facteurs stables peut justifier CONSERVER.\n\nLe score évolue avec les données ingérées : une année manquante ou un PER en N/D modifie souvent la confiance autant que le chiffre lui-même. Utilisez-le comme grille de lecture, pas comme note définitive.",
    sources: [
      {
        title: "Investopedia — Composite Score (concept)",
        url: "https://www.investopedia.com/terms/c/composite.asp",
      },
      {
        title: "BRVM — informations financières",
        url: "https://www.brvm.org/fr/informations-financieres",
      },
    ],
  },

  "confiance-du-signal": {
    details:
      "La confiance (Élevée, Moyenne, Faible) mesure surtout la profondeur d’historique de cours disponible pour le titre. Elle ne prédit pas la hausse : elle indique si l’analyse a assez de passé pour être robuste.\n\nUne confiance faible plafonne les signaux extrêmes : pas d’ACHAT FORT ni de VENDRE trop agressifs lorsque les séries sont trop courtes ou trop lacunaires.\n\nSur la BRVM, de nombreuses valeurs ont un historique partiel : une confiance Moyenne ou Faible est souvent honnête, pas un défaut d’affichage. Privilégiez alors prudence et croisement avec d’autres sources.",
    sources: [
      {
        title: "Investopedia — Sample Size / Data Quality (overview)",
        url: "https://www.investopedia.com/terms/s/samplesize.asp",
      },
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
    ],
  },

  "horizons-c-m-l": {
    details:
      "OuestBourse détaille trois sous-scores 0–100 : court terme (performance récente et indicateurs techniques), moyen terme (souvent perf. 5 ans) et long terme (perf. 10 ans ou span réellement disponible).\n\nIls aident à voir si un titre « tient » sur plusieurs horizons ou seulement sur une fenêtre courte. Un bon long terme n’efface pas un risque de liquidité court terme typique de la BRVM.\n\nSur la fiche, comparez Court / Moyen / Long à côté des scores technique et fondamental : des divergences fortes appellent à lire les facteurs ▲/▼ avant de conclure.",
    sources: [
      {
        title: "Investopedia — Investment Horizon",
        url: "https://www.investopedia.com/terms/i/investmenthorizon.asp",
      },
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
    ],
  },

  "score-technique": {
    details:
      "Le score technique (0–100) synthétise la lecture graphique et les performances de prix (RSI, MACD, SMA, horizons). Il est distinct du score fondamental : un titre peut être « bon marché » en fondamentaux et faible techniquement, ou l’inverse.\n\nSans assez de points de cours densifiés, le moteur peut se replier sur les seuls horizons de prix. Sur titres peu liquides, les indicateurs oscillent plus facilement : interprétez avec prudence.\n\nLe récap « Analyse graphique » sur /graphes reprend ce score. Ce n’est pas un signal d’ordre : c’est une aide à situer momentum et tendance dans le parcours d’analyse.",
    sources: [
      {
        title: "Investopedia — Technical Analysis",
        url: "https://www.investopedia.com/terms/t/technicalanalysis.asp",
      },
      {
        title: "StockCharts — ChartSchool (Technical Analysis)",
        url: "https://chartschool.stockcharts.com/table-of-contents/overview/technical-analysis",
      },
    ],
  },

  "score-fondamental": {
    details:
      "Le score fondamental (0–100) s’appuie surtout sur le rendement du dividende, la régularité des distributions et le PER — à partir des données réellement présentes en base.\n\nSi PER ou dividendes sont N/D, le score devient volontairement plus prudent : OuestBourse préfère baisser la note plutôt qu’inventer un multiple. Le screener vue Solidité et le récap fondamental de la fiche s’en nourrissent.\n\nCe score ne remplace pas la lecture des comptes officiels ni le contexte sectoriel. Croisez-le avec santé financière, liquidité et documents BRVM avant toute conclusion.",
    sources: [
      {
        title: "Investopedia — Fundamental Analysis",
        url: "https://www.investopedia.com/terms/f/fundamentalanalysis.asp",
      },
      {
        title: "BRVM — informations financières",
        url: "https://www.brvm.org/fr/informations-financieres",
      },
    ],
  },

  "sante-financiere": {
    details:
      "La santé financière OuestBourse est une note sur 10 dérivée de piliers calibrés sur les métriques BRVM disponibles (pas un audit comptable complet). Elle apparaît en sidebar de la fiche société avec libellé et détail des piliers.\n\nDes postes absents restent N/D : la note ne comble jamais un trou de données. Elle sert à situer rapidement solidité relative, pas à certifier la qualité des états financiers.\n\nPour une décision réelle, retournez aux publications de l’émetteur et au site BRVM. La santé affichée est un filtre pédagogique, complémentaire du score fondamental et du signal.",
    sources: [
      {
        title: "Investopedia — Financial Health",
        url: "https://www.investopedia.com/terms/f/financialhealth.asp",
      },
      {
        title: "BRVM — informations financières",
        url: "https://www.brvm.org/fr/informations-financieres",
      },
    ],
  },

  "donnee-n-d": {
    details:
      "« N/D » signifie non disponible : l’interface affiche cette mention dès qu’une information manque, est invalide ou n’est pas encore ingérée. Elle n’est jamais remplacée par un zéro trompeur côté UI.\n\nExemples courants : capitalisation à 0 en base, PER manquant, volume absent. N/D est une information honnête — mieux vaut savoir ce qui manque que croire un chiffre inventé.\n\nQuand plusieurs N/D apparaissent sur une fiche, attendez-vous souvent à une confiance du signal plus faible et à des scores plus prudents. Complétez alors avec BRVM.org et les documents de l’émetteur.",
    sources: [
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
      {
        title: "Investopedia — Incomplete Information (decision-making)",
        url: "https://www.investopedia.com/terms/a/asymmetricinformation.asp",
      },
    ],
  },

  "source-canonique": {
    details:
      "La source canonique est la valeur retenue après réconciliation multi-sources. Priorité : BRVM officiel > Sikafinance > Richbourse > saisie manuelle. Un écart supérieur à 2 % entre sources est journalisé pour audit.\n\nSous le cours d’une société, OuestBourse affiche typiquement « Source : BRVM officiel · Synchronisé le … ». En cas de doute sur une clôture, le Bulletin / site BRVM prime toujours.\n\nComprendre la canonique évite de confondre une cote différée d’un agrégateur avec le prix de référence officiel. Pour l’investisseur, c’est la base de toute comparaison honnête entre titres.",
    sources: [
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
      {
        title: "BRVM — informations financières",
        url: "https://www.brvm.org/fr/informations-financieres",
      },
    ],
  },

  screener: {
    details:
      "Le screener filtre et classe les valeurs selon des critères (rendement, croissance, valorisation, solidité, secteur, pays) pour cibler un univers d’étude. Sur OuestBourse, la page /screener s’appuie sur les mêmes métriques que le Marché et les fiches.\n\nIl oriente la recherche : il ne remplace pas la lecture de la fiche, de la liquidité ni des N/D. Un titre en tête de liste « Dividendes » peut rester trop illiquide pour votre profil.\n\nUtilisez le screener pour shortlister, puis ouvrez fiche et graphes pour croiser signal, confiance et risques avant toute décision.",
    sources: [
      {
        title: "Investopedia — Stock Screener",
        url: "https://www.investopedia.com/terms/s/stockscreener.asp",
      },
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
    ],
  },

  "projection-future": {
    details:
      "La projection future propose des scénarios de cours (central, optimiste, pessimiste) issus d’une régression sur l’historique. C’est une illustration pédagogique, pas une prévision garantie ni un conseil d’achat.\n\nSur la fiche société, l’onglet Projection montre des bandes autour de la tendance estimée. Ces bandes cassent dès que le régime de marché change : liquidité, résultats, ou choc macro peuvent invalider la pente.\n\nGardez les projections comme hypothèses à confronter aux fondamentaux et au signal. Ne les confondez jamais avec un prix cible officiel de la BRVM ou d’un analyste réglementé.",
    sources: [
      {
        title: "Investopedia — Linear Regression (concept)",
        url: "https://www.investopedia.com/terms/l/linearregression.asp",
      },
      {
        title: "Investopedia — Forecasting",
        url: "https://www.investopedia.com/terms/f/forecasting.asp",
      },
    ],
  },

  "pourquoi-analyser-une-action": {
    details:
      "Analyser une action, c’est structurer l’information disponible (cours, comptes, liquidité, contexte) pour mieux comprendre risque et potentiel — pas pour obtenir une certitude ni un conseil d’achat automatique.\n\nAvant d’ouvrir une fiche (SNTS, SGBC…), clarifiez votre horizon (court / moyen / long) et ce que vous voulez vérifier : dividende, valorisation, tendance, ou liquidité.\n\nSur OuestBourse, l’analyse reste pédagogique et d’aide à la décision. Vérifiez toujours les publications BRVM, les états financiers et, le cas échéant, votre SGI avant d’agir.",
    sources: [
      {
        title: "Investopedia — Investment Analysis",
        url: "https://www.investopedia.com/terms/i/investment-analysis.asp",
      },
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
    ],
  },

  "limites-de-l-analyse": {
    details:
      "Toute analyse repose sur des données partielles, parfois en retard, et sur des hypothèses. Sur la BRVM, liquidité faible et données manquantes (affichées N/D) renforcent ces limites.\n\nSi PER ou volume moyen est N/D, la confiance du signal baisse souvent : c’est une limite explicitée, pas un bug. Un score élevé avec historique court reste fragile.\n\nPréférez une conclusion prudente avec facteurs ▲/▼ plutôt qu’un verdict binaire. Les outils OuestBourse aident à lire ; ils ne garantissent ni performance ni exhaustivité des comptes.",
    sources: [
      {
        title: "Investopedia — Limitations of Financial Analysis",
        url: "https://www.investopedia.com/articles/fundamental/03/082703.asp",
      },
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
    ],
  },

  "parcours-d-analyse": {
    details:
      "Parcours recommandé : (1) contexte marché et liquidité, (2) fondamentaux et dividendes, (3) valorisation, (4) lecture technique sur /graphes, (5) croisement avec le signal OuestBourse et sa confiance.\n\nExemple pédagogique : fiche société → Indicateurs / Dividendes → graphes (RSI, MACD, SMA) → signal final et raisons ▲/▼. Ne sautez pas la liquidité : un indicateur sur un titre rarement échangé peut tromper.\n\nCe parcours structure l’apprentissage ; il n’impose pas d’ordre d’achat. Adaptez les étapes à votre horizon et à la qualité des données (N/D, confiance).",
    sources: [
      {
        title: "Investopedia — How to Analyze a Stock",
        url: "https://www.investopedia.com/articles/basics/06/invest1000.asp",
      },
      {
        title: "Investopedia — Fundamental Analysis",
        url: "https://www.investopedia.com/terms/f/fundamentalanalysis.asp",
      },
      {
        title: "Investopedia — Technical Analysis",
        url: "https://www.investopedia.com/terms/t/technicalanalysis.asp",
      },
    ],
  },

  "type-analyse-fondamentale": {
    details:
      "L’analyse fondamentale étudie comptes, rentabilité, endettement et capacité à générer résultats / dividendes — indépendamment du bruit quotidien du cours.\n\nSur OuestBourse : PER, capitalisation, rendement dividende, santé financière et score fondamental sur la fiche. Les postes absents restent N/D ; la plateforme n’invente pas de bilans.\n\nPoursuivez dans le thème « Analyse fondamentale » (CA, BPA, marges…) et croisez toujours avec les publications officielles BRVM / émetteur. Le fondamental informe ; il ne remplace pas un conseil personnalisé.",
    sources: [
      {
        title: "Investopedia — Fundamental Analysis",
        url: "https://www.investopedia.com/terms/f/fundamentalanalysis.asp",
      },
      {
        title: "BRVM — informations financières",
        url: "https://www.brvm.org/fr/informations-financieres",
      },
    ],
  },

  "type-analyse-valorisation": {
    details:
      "La valorisation compare le prix de marché à une mesure de résultat ou d’actif (PER, capitalisation, multiples) pour situer cher / bon marché — toujours relatif au secteur et à la qualité.\n\nLe PER d’une banque BRVM ne se lit pas comme celui d’un titre industriel ; le screener aide à comparer des pairs. Un multiple bas sans liquidité ni comptes solides n’est pas automatiquement une « affaire ».\n\nSur OuestBourse, croisez valorisation, score fondamental et N/D éventuels. C’est un type d’analyse pédagogique, pas une estimation de juste valeur garantie.",
    sources: [
      {
        title: "Investopedia — Valuation",
        url: "https://www.investopedia.com/terms/v/valuation.asp",
      },
      {
        title: "Investopedia — Price-to-Earnings Ratio (P/E)",
        url: "https://www.investopedia.com/terms/p/price-earningsratio.asp",
      },
    ],
  },

  "type-analyse-technique": {
    details:
      "L’analyse technique lit le comportement du prix et du volume (moyennes, RSI, MACD, supports) pour décrire momentum et niveaux — sans remplacer les fondamentaux.\n\nSur /graphes, un trio SMA 20 + RSI 14 + MACD couvre tendance courte, zones de surachat/survente et momentum. Sur titres BRVM peu liquides, les signaux peuvent être tardifs ou bruités.\n\nLes indicateurs avancés (Ichimoku, Elliott, Stochastique…) restent disponibles mais sont documentés comme souvent peu adaptés. La technique OuestBourse est une aide visuelle, pas un conseil d’ordre.",
    sources: [
      {
        title: "Investopedia — Technical Analysis",
        url: "https://www.investopedia.com/terms/t/technicalanalysis.asp",
      },
      {
        title: "StockCharts — ChartSchool",
        url: "https://chartschool.stockcharts.com/table-of-contents/overview/technical-analysis",
      },
    ],
  },

  "menu-accueil": {
    details:
      "L’Accueil (/) est la landing publique : présentation d’OuestBourse, accès rapide vers Marché, Screener, Graphes et le reste de l’application via le header.\n\nLes chiffres du bandeau de stats sont calculés sur les vraies données de la base (nombre de sociétés, années couvertes, etc.), jamais inventés. Le thème clair/sombre se conserve en naviguant.\n\nServez-vous de cette page comme porte d’entrée pédagogique, puis approfondissez titres et signaux dans les menus métier — sans confondre présentation produit et conseil d’investissement.",
    sources: [
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
    ],
  },

  "menu-marche": {
    details:
      "Le menu Marché (/marche) offre une vue d’ensemble des positions BRVM : liste des titres, scores, performances et dividendes, avec un sélecteur multi-marchés (seule la BRVM est live aujourd’hui).\n\nCliquez une position puis choisissez « Fiche société » ou « Graphe » selon votre besoin. Les autres places africaines peuvent apparaître « bientôt » sans données live.\n\nLe Marché oriente la lecture quotidienne ; il ne place aucun ordre. Pour approfondir un titre, ouvrez la fiche et vérifiez source canonique, N/D et confiance du signal.",
    sources: [
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
      {
        title: "Investopedia — Stock Market",
        url: "https://www.investopedia.com/terms/s/stockmarket.asp",
      },
    ],
  },

  "menu-screener": {
    details:
      "Le menu Screener ouvre /screener : filtres et comparaisons selon rentabilité, dividendes, croissance, valorisation, secteur ou pays, branchés sur les métriques calculées (calcMetrics).\n\nFiltrez par exemple « Dividendes », puis ouvrez une fiche pour lire signal et confiance. Un filtre ne remplace pas liquidité ni N/D sur la fiche.\n\nUtilisez le screener pour réduire l’univers BRVM, pas pour automatiser une décision. Croisez toujours avec graphes, fondamentaux et sources officielles.",
    sources: [
      {
        title: "Investopedia — Stock Screener",
        url: "https://www.investopedia.com/terms/s/stockscreener.asp",
      },
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
    ],
  },

  "menu-graphes": {
    details:
      "Le menu Graphes ouvre le workbench /graphes : chandeliers, plages, indicateurs (SMA, RSI, MACD, ADX…), overlays et alertes de seuil (compte connecté).\n\nActivez les indicateurs via le menu dédié ; les pastilles permettent de retirer un overlay d’un clic. Les indicateurs avancés sont disponibles mais souvent peu adaptés aux titres BRVM peu liquides — voir Éducation › Analyse.\n\nLes graphes aident à lire momentum et niveaux ; ils n’exécutent aucun trade. Lisez la note de source (série densifiée, OHLC synthétique éventuel) avant d’interpréter.",
    sources: [
      {
        title: "Investopedia — Technical Analysis",
        url: "https://www.investopedia.com/terms/t/technicalanalysis.asp",
      },
      {
        title: "StockCharts — Candlestick Charts",
        url: "https://chartschool.stockcharts.com/table-of-contents/chart-analysis/candlestick-charts",
      },
    ],
  },

  "menu-fiche-societe": {
    details:
      "La fiche société (/actions/[ticker]) regroupe cours, performances, données clés, dividendes, santé financière, signal, projection et comparaison pour un titre donné.\n\nAccessible depuis le méga-menu Sociétés cotées, le Marché ou le screener. Toute donnée absente s’affiche N/D — ne pas inventer un chiffre manquant.\n\nC’est le cœur de lecture pédagogique d’un titre BRVM : croisez signal / confiance, fondamentaux et graphes. Ce n’est ni un conseil personnalisé ni un ordre de bourse.",
    sources: [
      {
        title: "BRVM — informations financières",
        url: "https://www.brvm.org/fr/informations-financieres",
      },
      {
        title: "Investopedia — Stock Analysis",
        url: "https://www.investopedia.com/terms/s/stock-analysis.asp",
      },
    ],
  },

  "menu-portefeuille": {
    details:
      "Le menu Portefeuille (/portefeuille) suit vos positions personnelles : valeur de marché, plus/moins-value vs prix moyen d’achat (PRU), allocation sectorielle et YTD — connexion requise.\n\nSans compte, une démo peut s’afficher avec le libellé « Chiffres illustratifs ». La plus-value compare la valeur actuelle au PRU, avec la date du cours de référence.\n\nLe portefeuille est un outil de suivi, pas un carnet d’ordres : pour acheter ou vendre, passez par votre SGI. Les métriques restent basées sur les cours canoniques de la base.",
    sources: [
      {
        title: "Investopedia — Portfolio",
        url: "https://www.investopedia.com/terms/p/portfolio.asp",
      },
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
    ],
  },

  "menu-alertes": {
    details:
      "Les alertes de prix sont des seuils au-dessus ou en-dessous d’un cours, créés depuis /graphes (compte connecté) et évalués après rafraîchissement des cotations BRVM.\n\nExemple : alerte « au-dessus de X FCFA » — statut ACTIVE puis TRIGGERED lorsque le seuil est franchi. Les alertes ne sont pas des ordres de bourse et n’exécutent aucun trade.\n\nServez-vous-en pour surveiller un niveau pédagogique ou de discipline personnelle, puis validez toujours sur la source canonique et auprès de votre SGI avant d’agir.",
    sources: [
      {
        title: "Investopedia — Price Alert / Stop Concepts",
        url: "https://www.investopedia.com/terms/s/stoporder.asp",
      },
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
    ],
  },

  "menu-calendrier-dividendes": {
    details:
      "Le calendrier des dividendes (/calendrier-dividendes) liste dates et montants connus en base — utile pour planifier un suivi de rendement, pas une promesse de distribution future.\n\nCroisez avec la fiche société pour le rendement calculé. En cas d’écart, les dates officielles BRVM / assemblées générales priment.\n\nUn dividende passé n’implique pas le prochain. Utilisez le calendrier comme agenda pédagogique, puis vérifiez avis et publications sur brvm.org avant toute décision liée au rendement.",
    sources: [
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
      {
        title: "Investopedia — Dividend",
        url: "https://www.investopedia.com/terms/d/dividend.asp",
      },
    ],
  },

  pru: {
    details:
      "Le PRU (prix de revient unitaire), aussi appelé prix moyen d’achat pondéré, est le coût moyen auquel vous détenez une action. Formule après plusieurs achats : PRU = (ancienne quantité × ancien PRU + nouvelles actions × prix d’achat) / quantité totale.\n\nSur OuestBourse, la colonne +/-value compare le cours du jour (colonne « Cours au ») à ce PRU — pas la variation du titre entre deux dates de bourse. Si le PRU est surévalué (relevé mal importé, mauvaise saisie), la plus-value affichée sera fausse même si le marché est stable.\n\nVérifiez le PRU sur votre relevé SGI et corrigez-le via le menu … de la ligne. Les frais de courtage ne sont inclus que si vous les avez intégrés au PRU saisi.",
    sources: [
      {
        title: "Investopedia — Average Cost Basis",
        url: "https://www.investopedia.com/terms/a/averagecostbasis.asp",
      },
      {
        title: "Investopedia — Cost Basis",
        url: "https://www.investopedia.com/terms/c/costbasis.asp",
      },
    ],
  },

  "plus-moins-value-latente": {
    details:
      "La plus ou moins-value latente mesure l’écart entre valeur de marché et coût d’achat : (cours × quantité) − (PRU × quantité), souvent exprimé en %. « Latente » = non réalisée tant que vous ne vendez pas.\n\nCe n’est pas la performance du titre sur une période (ex. vendredi → lundi). Exemple : PRU 14 715 et cours 9 000 → environ −38 %, même si le cours n’a baissé que de 1 % sur la semaine.\n\nNe confondez pas avec la Performance YTD du portefeuille (repère 1er janvier) ni avec le conseil Renforcer/Conserver (signal d’analyse + horizon).",
    sources: [
      {
        title: "Investopedia — Unrealized Gain",
        url: "https://www.investopedia.com/terms/u/unrealizedgain.asp",
      },
      {
        title: "Investopedia — Capital Gain",
        url: "https://www.investopedia.com/terms/c/capitalgain.asp",
      },
    ],
  },

  "cout-d-achat": {
    details:
      "Le coût d’achat d’une ligne = quantité × PRU. C’est le capital engagé pour cette position, base du calcul de la plus/moins-value en FCFA.\n\nIl reste fixe tant que vous ne modifiez pas la quantité ou le PRU (renforcement avec nouveau prix moyen, correction manuelle). La valeur de marché, elle, évolue avec le cours.\n\nSur un portefeuille multi-lignes, la somme des coûts d’achat alimente le KPI « coût total » implicite derrière la plus-value globale.",
    sources: [
      {
        title: "Investopedia — Cost Basis",
        url: "https://www.investopedia.com/terms/c/costbasis.asp",
      },
    ],
  },

  "valeur-de-marche": {
    details:
      "La valeur de marché valorise vos titres au dernier cours canonique connu : quantité × clôture de référence. OuestBourse utilise les cours réconciliés (priorité BRVM officiel) et affiche la date dans « Cours au ».\n\nSans cours disponible → N/D, jamais un zéro trompeur. Sur titres peu liquides, la dernière cotation peut dater de plusieurs séances : la valorisation reste honnête mais peut être légèrement décalée.\n\nLa valeur de marché ne tient pas compte de vos frais de vente futurs ni de l’écart bid-ask réel au moment d’une transaction.",
    sources: [
      {
        title: "Investopedia — Market Value",
        url: "https://www.investopedia.com/terms/m/marketvalue.asp",
      },
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
    ],
  },

  "cours-au": {
    details:
      "« Cours au JJ/MM/AAAA » indique la date de la clôture utilisée pour valoriser la ligne. Ce n’est pas la date de votre achat (« Acheté le ») ni un flux temps réel.\n\nSur la BRVM, le dernier jour ouvré peut être un vendredi si le lundi n’a pas encore de cotation ingérée. Un écart d’un ou deux jours entre titres peut apparaître si les sources diffèrent — la date est affichée pour transparence.\n\nActualisez les cotations via le bouton prévu ou attendez le cron d’ingestion pour rapprocher la date du dernier jour de bourse.",
    sources: [
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
      {
        title: "Investopedia — Closing Price",
        url: "https://www.investopedia.com/terms/c/closingprice.asp",
      },
    ],
  },

  "performance-ytd": {
    details:
      "YTD (Year-To-Date) mesure la variation de la valeur du portefeuille depuis le repère de début d’année : dernier cours canonique avant le 1er janvier vs valeur actuelle des positions détenues aujourd’hui.\n\nSimplification documentée : sans historique de transactions, un achat en cours d’année peut légèrement surestimer le YTD (la position est comparée comme si elle existait au 1er janvier). C’est un repère calendaire, pas la plus-value vs PRU.\n\nUtilisez le YTD pour le suivi macro du portefeuille ; utilisez +/-value ligne par ligne pour le résultat vs vos prix d’achat.",
    sources: [
      {
        title: "Investopedia — Year-to-Date (YTD)",
        url: "https://www.investopedia.com/terms/y/ytd.asp",
      },
    ],
  },

  "allocation-sectorielle": {
    details:
      "L’allocation sectorielle répartit la valeur de marché du portefeuille par secteur BRVM (Banques, Télécoms, Industrie…). Chaque secteur reçoit un poids en % du total valorisé.\n\nElle aide à repérer une concentration excessive (ex. 80 % Banques) et à comparer votre structure au marché ou à votre stratégie cible. Les lignes sans cours (N/D) sont exclues du dénominateur de poids.\n\nLe donut par titre (répartition par ticker) complète cette vue sectorielle sur /portefeuille.",
    sources: [
      {
        title: "Investopedia — Asset Allocation",
        url: "https://www.investopedia.com/terms/a/assetallocation.asp",
      },
      {
        title: "Investopedia — Diversification",
        url: "https://www.investopedia.com/terms/d/diversification.asp",
      },
    ],
  },

  "horizon-d-achat": {
    details:
      "L’horizon d’achat (Court / Moyen / Long) est un choix utilisateur lors de la saisie d’une position. Il indique l’échéance de votre projet de détention, pas une prédiction du marché.\n\nOuestBourse croise cet horizon avec les scores Court / Moyen / Long calculés sur la fiche titre pour produire le conseil portefeuille. Exemple : signal ACHAT + score moyen terme favorable → Renforcer, même si votre plus-value latente est négative.\n\nVous pouvez le modifier en éditant la ligne. Il reste distinct du signal global ACHAT FORT / VENDRE affiché sur la fiche société.",
    sources: [
      {
        title: "Investopedia — Investment Horizon",
        url: "https://www.investopedia.com/terms/i/investmenthorizon.asp",
      },
    ],
  },

  "conseil-portefeuille": {
    details:
      "Les badges Renforcer, Conserver et Sortir / Alléger combinent le signal OuestBourse (ACHAT FORT … VENDRE) et le score de l’horizon d’achat que vous avez déclaré. Ils ne lisent pas votre plus/moins-value latente.\n\nRègles simplifiées : signal VENDRE ou ALLÉGER → Sortir ; ACHAT ou ACHAT FORT avec score d’horizon ≥ 40 → Renforcer (atténué si score < 35) ; CONSERVER avec score faible → Sortir, avec score élevé → Renforcer.\n\nOutil pédagogique de suivi — pas un ordre de bourse. Croisez toujours avec liquidité, objectifs personnels et votre SGI.",
    sources: [
      {
        title: "Investopedia — Investment Analysis",
        url: "https://www.investopedia.com/terms/i/investment-analysis.asp",
      },
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
    ],
  },

  "taille-de-position": {
    details:
      "La taille de position répond à une question simple : « combien de titres puis-je acheter pour que, si le stop est touché, je ne perde pas plus que X % de mon capital ? »\n\nFormule : Q = (capital × taux %) / (entrée − stop). Étapes : (1) noter le capital disponible, (2) choisir un taux de perte acceptable (souvent 3–5 % pour un particulier BRVM), (3) fixer le prix d’entrée (cours réel en base, jamais inventé) et un stop sous ce cours, (4) calculer Q et arrondir à l’entier le plus proche.\n\nExemple pédagogique type SOGB CI (ticker SOGC) : 1 000 000 FCFA, 5 %, entrée 8 400, stop 7 560. Budget = 50 000 FCFA ; écart = 840 FCFA ; Q ≈ 59,52 → 60 titres. Montant investi = 60 × 8 400 = 504 000 FCFA. Perte si stop touché = 60 × 840 = 50 400 FCFA (5,04 % du capital), légèrement au-dessus du budget à cause de l’arrondi.\n\nSur la BRVM, il n’y a généralement pas d’ordre stop natif. La calculette OuestBourse (/outils/taille-position) charge le cours en base lorsqu’un ticker est choisi et propose une alerte au niveau du stop. Outil pédagogique — pas un conseil d’achat.",
    sources: [
      {
        title: "Investopedia — Position Sizing",
        url: "https://www.investopedia.com/terms/p/positionsizing.asp",
      },
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
    ],
  },

  "taux-perte-acceptable": {
    details:
      "Le taux de perte acceptable est le pourcentage du capital que vous acceptez de risquer sur une seule position. Il n’est pas le rendement espéré : c’est un plafond de douleur.\n\nBudget = capital × taux %. Exemple : 1 000 000 FCFA à 5 % → 50 000 FCFA ; à 3 % → 30 000 FCFA. Plus le taux est bas, moins vous achetez de titres pour le même écart entrée/stop.\n\nPour un particulier sur la BRVM (liquidité parfois faible, pas d’ordre stop automatique), 3 à 5 % par trade est un repère courant des tutoriaux de money management. Au-delà, une série de stops rapprochés entame vite le capital ; trop bas, un titre à 30 000 FCFA avec un stop large peut donner Q < 1.\n\nTestez vos chiffres dans la calculette gratuite /outils/taille-position, puis relisez liquidité et signal sur la fiche avant toute décision. Ce n’est pas un conseil personnalisé.",
    sources: [
      {
        title: "Investopedia — Risk Management",
        url: "https://www.investopedia.com/terms/r/riskmanagement.asp",
      },
      {
        title: "Investopedia — Position Sizing",
        url: "https://www.investopedia.com/terms/p/positionsizing.asp",
      },
    ],
  },

  "stop-loss-brvm": {
    details:
      "Un stop loss est le cours à partir duquel vous acceptez de sortir d’une position pour limiter la perte. Pour un achat (long), il doit être strictement inférieur au prix d’entrée — sinon la formule de taille de position n’a pas de sens.\n\nÀ la BRVM, les intermédiaires n’offrent généralement pas d’ordre stop automatique comparable aux marchés développés. Le stop est donc une règle personnelle : vous surveillez le seuil, puis vous passez un ordre via votre SGI si le niveau est atteint.\n\nOuestBourse permet de créer une alerte de cours « ≤ stop » (compte connecté) depuis la calculette ou la fiche titre. L’alerte prévient ; elle n’exécute aucun trade. Combinez-la avec la taille de position pour que la perte, si vous sortez au stop, reste proche du budget choisi.\n\nExemple pédagogique : entrée 8 400 FCFA, stop 7 560 FCFA (−10 %). Placez l’alerte à 7 560, pas un cours inventé. Vérifiez toujours le dernier cours officiel BRVM avant d’agir.",
    sources: [
      {
        title: "Investopedia — Stop-Loss Order",
        url: "https://www.investopedia.com/terms/s/stop-lossorder.asp",
      },
      {
        title: "BRVM — site officiel",
        url: "https://www.brvm.org",
      },
    ],
  },

  "evolution-portefeuille": {
    details:
      "Le graphique d’évolution du portefeuille trace une NAV quotidienne estimée : somme des (quantité × cours canonique du jour) pour chaque ligne, à partir de la date d’achat la plus ancienne enregistrée.\n\nLes jours sans cotation réutilisent le dernier cours connu (palier). Les titres sans historique suffisant raccourcissent la courbe. Ce graphique montre la trajectoire agrégée — pas le détail PRU vs cours ligne par ligne.\n\nComplétez avec le tableau des positions pour le suivi micro (PRU, +/-value, conseil).",
    sources: [
      {
        title: "Investopedia — Net Asset Value (NAV)",
        url: "https://www.investopedia.com/terms/n/nav.asp",
      },
    ],
  },
};
