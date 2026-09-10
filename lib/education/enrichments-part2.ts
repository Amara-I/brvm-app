export type TermEnrichment = {
  details: string;
  sources: { title: string; url: string }[];
};

export const ENRICHMENTS_PART2: Record<string, TermEnrichment> = {
  "moyenne-mobile": {
    details: [
      "Une moyenne mobile lisse une série de cours en calculant, à chaque date, la moyenne des N dernières clôtures (SMA) ou une moyenne pondérée exponentiellement (EMA). Elle ne prédit pas le futur : elle résume la tendance récente avec un retard proportionnel à N.",
      "Lecture usuelle : le cours au-dessus d’une moyenne longue (ex. 50 ou 200) est souvent interprété comme une tendance haussière ; en dessous, baissière. Les croisements de moyennes (courte vs longue) servent de filtres de tendance, pas de signaux absolus.",
      "Limite : plus N est grand, plus l’indicateur est lent et moins sensible au bruit — utile en tendance, trompeur en range. Sur la BRVM, privilégiez des fenêtres adaptées à la liquidité réelle du titre.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Moving Average (MA)",
        url: "https://www.investopedia.com/terms/m/movingaverage.asp",
      },
      {
        title: "StockCharts School — Moving Averages",
        url: "https://school.stockcharts.com/doku.php?id=technical_indicators:moving_averages",
      },
      {
        title: "Fidelity — Simple Moving Average",
        url: "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/sma",
      },
    ],
  },

  rsi: {
    details: [
      "Le RSI (Relative Strength Index), créé par J. Welles Wilder Jr. en 1978 (New Concepts in Technical Trading Systems), compare l’ampleur moyenne des hausses et des baisses sur N périodes. Formule usuelle : RSI = 100 − [100 / (1 + RS)], avec RS = moyenne des hausses ÷ moyenne des baisses. Wilder recommande N = 14 et un lissage spécifique après la première moyenne.",
      "Seuils classiques : au-dessus de ~70, zone de surachat ; en dessous de ~30, zone de survente ; entre les deux, zone souvent jugée neutre. Le niveau 50 marque l’équilibre relatif des forces. Ces repères sont des guides, pas des ordres d’achat/vente automatiques.",
      "En tendance forte, le RSI peut rester longtemps au-delà de 70 ou sous 30. Lectures complémentaires : divergences prix/RSI et « failure swings ». Sur OuestBourse, RSI(14) alimente le workbench graphique et la lecture technique court terme.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Relative Strength Index (RSI)",
        url: "https://www.investopedia.com/terms/r/rsi.asp",
      },
      {
        title: "StockCharts School — Relative Strength Index (RSI)",
        url: "https://school.stockcharts.com/doku.php?id=technical_indicators:relative_strength_index_rsi",
      },
      {
        title: "Fidelity — RSI Indicator Guide",
        url: "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/RSI",
      },
    ],
  },

  macd: {
    details: [
      "Le MACD (Moving Average Convergence Divergence), popularisé par Gerald Appel, mesure l’écart entre deux EMA (classiquement 12 et 26) et le compare à une ligne de signal (EMA 9 de cet écart). L’histogramme visualise la distance entre MACD et signal.",
      "Lecture courante : croisement MACD au-dessus du signal = momentum haussier ; croisement en dessous = momentum baissier. Un MACD positif (au-dessus de zéro) indique que l’EMA courte est au-dessus de la longue.",
      "Limite : comme toute moyenne mobile, le MACD est retardé et peut produire de faux croisements en marché latéral. Les divergences prix/MACD sont des alertes de vigilance, pas des certitudes.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — MACD",
        url: "https://www.investopedia.com/terms/m/macd.asp",
      },
      {
        title: "StockCharts School — MACD",
        url: "https://school.stockcharts.com/doku.php?id=technical_indicators:moving_average_convergence_divergence_macd",
      },
      {
        title: "Fidelity — MACD",
        url: "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/macd",
      },
    ],
  },

  "support-et-resistance": {
    details: [
      "Un support est une zone de cours où la demande a historiquement freiné une baisse ; une résistance, une zone où l’offre a freiné une hausse. On parle de zones plutôt que de prix exacts au tick près.",
      "Ces niveaux se forment souvent autour d’anciens plus-hauts/plus-bas, de gaps ou de moyennes longues. Un support franchi peut devenir résistance (et inversement) — principe de polarité.",
      "Limite : sur un marché peu liquide comme certains titres BRVM, les « niveaux » peuvent être irréguliers. Confirmez toujours avec le volume, la tendance et le contexte fondamental.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Support and Resistance Basics",
        url: "https://www.investopedia.com/trading/support-and-resistance-basics/",
      },
      {
        title: "StockCharts School — Support and Resistance",
        url: "https://school.stockcharts.com/doku.php?id=chart_analysis:support_and_resistance",
      },
      {
        title: "Wikipedia — Support and resistance",
        url: "https://en.wikipedia.org/wiki/Support_and_resistance",
      },
    ],
  },

  "bandes-de-bollinger": {
    details: [
      "Les bandes de Bollinger, développées par John Bollinger, encadrent une moyenne mobile (souvent SMA 20) par deux bandes situées à N écarts-types (classiquement ±2). Elles mesurent la volatilité relative du cours autour de sa moyenne.",
      "Lecture usuelle : bandes qui se resserrent (« squeeze ») = volatilité faible, souvent avant un mouvement plus ample ; bandes qui s’écartent = volatilité élevée. Toucher une bande n’est pas, à lui seul, un signal d’achat ou de vente.",
      "Limite : en tendance forte, le cours peut « chevaucher » la bande supérieure (ou inférieure) longtemps. Utilisez les bandes comme contexte de volatilité, en complément d’autres indicateurs.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Bollinger Band",
        url: "https://www.investopedia.com/terms/b/bollingerbands.asp",
      },
      {
        title: "StockCharts School — Bollinger Bands",
        url: "https://school.stockcharts.com/doku.php?id=technical_indicators:bollinger_bands",
      },
      {
        title: "Fidelity — Bollinger Bands",
        url: "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/bollinger-bands",
      },
    ],
  },

  ema: {
    details: [
      "L’EMA (Exponential Moving Average) donne plus de poids aux cours récents qu’une SMA de même période. Le facteur de lissage usuel est 2/(N+1). Elle réagit donc plus vite aux changements de tendance, au prix d’un peu plus de bruit.",
      "Usages courants : EMA 12 et 26 dans le MACD ; EMA 9 comme ligne de signal ; EMA 20/50/200 comme filtres de tendance. Le choix de N dépend de l’horizon (court vs long terme).",
      "Limite : une EMA reste un indicateur retardé. Un croisement rapide n’implique pas une tendance durable, surtout sur des séries BRVM irrégulières ou peu liquides.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Exponential Moving Average (EMA)",
        url: "https://www.investopedia.com/terms/e/ema.asp",
      },
      {
        title: "StockCharts School — Moving Averages (EMA)",
        url: "https://school.stockcharts.com/doku.php?id=technical_indicators:moving_averages",
      },
      {
        title: "Fidelity — Exponential Moving Average",
        url: "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/ema",
      },
    ],
  },

  obv: {
    details: [
      "L’OBV (On-Balance Volume), popularisé par Joseph Granville, cumule le volume : +volume si la clôture monte, −volume si elle baisse. L’idée est que le volume précède souvent le prix.",
      "Lecture : une hausse de l’OBV avec un prix stable ou en baisse peut suggérer une accumulation ; une baisse de l’OBV avec un prix stable ou en hausse, une distribution. Les divergences OBV/prix sont des alertes, pas des ordres.",
      "Limite : l’OBV dépend de la qualité des volumes publiés. Sur des titres peu liquides, les volumes peuvent être irréguliers ou peu représentatifs — interprétez avec prudence.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — On-Balance Volume (OBV)",
        url: "https://www.investopedia.com/terms/o/onbalancevolume.asp",
      },
      {
        title: "StockCharts School — On Balance Volume (OBV)",
        url: "https://school.stockcharts.com/doku.php?id=technical_indicators:on_balance_volume_obv",
      },
      {
        title: "Fidelity — On Balance Volume",
        url: "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/obv",
      },
    ],
  },

  "chandeliers-ohlc": {
    details: [
      "Un chandelier japonais résume une période (jour, semaine…) par quatre prix : ouverture (O), plus-haut (H), plus-bas (L) et clôture (C). Le corps relie O et C ; les mèches (ombres) montrent H et L.",
      "Couleur / sens : clôture > ouverture = période haussière (corps souvent clair ou vert) ; clôture < ouverture = baissière. Des figures (doji, marteau, enveloppe…) codifient des configurations, toujours contextuelles.",
      "Limite : une figure isolée ne suffit pas. Sur la BRVM, si seule la clôture est disponible, l’OHLC peut être synthétique — documenté comme tel sur OuestBourse. Croisez toujours avec volume et tendance.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Candlestick Chart",
        url: "https://www.investopedia.com/terms/c/candlestick.asp",
      },
      {
        title: "StockCharts School — Introduction to Candlesticks",
        url: "https://school.stockcharts.com/doku.php?id=chart_analysis:introduction_to_candlesticks",
      },
      {
        title: "Wikipedia — Candlestick chart",
        url: "https://en.wikipedia.org/wiki/Candlestick_chart",
      },
    ],
  },

  "golden-cross-death-cross": {
    details: [
      "Un golden cross désigne le croisement d’une moyenne courte (souvent 50) au-dessus d’une moyenne longue (souvent 200) : signal de tendance haussière potentiel. Un death cross est le croisement inverse (50 sous 200).",
      "Ces croisements sont des filtres de tendance à moyen/long terme, très suivis sur les grands indices. Ils confirment souvent un mouvement déjà engagé plutôt qu’ils ne l’anticipent.",
      "Limite : en marché latéral, de nombreux faux croisements apparaissent. Sur la BRVM, vérifiez la profondeur de l’historique et la liquidité avant d’accorder trop de poids à un seul croisement.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Golden Cross",
        url: "https://www.investopedia.com/terms/g/goldencross.asp",
      },
      {
        title: "Investopedia — Death Cross",
        url: "https://www.investopedia.com/terms/d/deathcross.asp",
      },
      {
        title: "StockCharts School — Moving Averages (crossovers)",
        url: "https://school.stockcharts.com/doku.php?id=technical_indicators:moving_averages",
      },
    ],
  },

  adx: {
    details: [
      "L’ADX (Average Directional Index), issu du travail de Wilder, mesure la force d’une tendance, pas sa direction. Il est souvent associé aux indicateurs directionnels +DI et −DI.",
      "Lecture classique : ADX bas (souvent sous ~20–25) = marché peu directionnel ou range ; ADX en hausse au-dessus de ces niveaux = tendance qui se renforce. La direction se lit via +DI/−DI, pas via l’ADX seul.",
      "Limite : un ADX élevé ne dit pas si la tendance est haussière ou baissière. Sur titres illiquides, le lissage peut masquer des mouvements brusques — utilisez-le comme filtre, pas comme trigger isolé.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Average Directional Index (ADX)",
        url: "https://www.investopedia.com/terms/a/adx.asp",
      },
      {
        title: "StockCharts School — Average Directional Index (ADX)",
        url: "https://school.stockcharts.com/doku.php?id=technical_indicators:average_directional_index_adx",
      },
      {
        title: "Fidelity — Average Directional Index",
        url: "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/adx",
      },
    ],
  },

  stochastique: {
    details: [
      "L’oscillateur stochastique (George Lane) compare la clôture à la fourchette haut–bas sur N périodes. Forme %K (rapide) et %D (lissage de %K). Il évolue typiquement entre 0 et 100.",
      "Lecture usuelle : au-dessus de ~80, zone de surachat ; en dessous de ~20, zone de survente. Les croisements %K/%D et les divergences avec le prix sont des lectures complémentaires.",
      "Limite : en tendance forte, le stochastique peut rester longtemps en zone extrême. Paramètres (14,3,3 etc.) changent la sensibilité — testez avant d’en faire une règle stricte.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Stochastic Oscillator",
        url: "https://www.investopedia.com/terms/s/stochasticoscillator.asp",
      },
      {
        title: "StockCharts School — Stochastic Oscillator",
        url: "https://school.stockcharts.com/doku.php?id=technical_indicators:stochastic_oscillator_fast_slow_and_full",
      },
      {
        title: "Fidelity — Stochastic Oscillator",
        url: "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/stochastic",
      },
    ],
  },

  "williams-r": {
    details: [
      "Le Williams %R, développé par Larry Williams, mesure où se situe la clôture dans la fourchette haut–bas des N dernières périodes. Il évolue typiquement de 0 à −100.",
      "Lecture classique : entre 0 et −20 ≈ surachat ; entre −80 et −100 ≈ survente. C’est un oscillateur de momentum proche du stochastique, avec une échelle inversée.",
      "Limite : comme le RSI ou le stochastique, des zones extrêmes prolongées sont fréquentes en tendance. Traitez %R comme un contexte de momentum, pas comme un signal autonome.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Williams %R",
        url: "https://www.investopedia.com/terms/w/williamsr.asp",
      },
      {
        title: "StockCharts School — Williams %R",
        url: "https://school.stockcharts.com/doku.php?id=technical_indicators:williams_r",
      },
      {
        title: "Fidelity — Williams %R",
        url: "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/williams-r",
      },
    ],
  },

  cci: {
    details: [
      "Le CCI (Commodity Channel Index), créé par Donald Lambert, mesure l’écart du prix typique par rapport à sa moyenne mobile, normalisé par l’écart moyen. Conçu d’abord pour les matières premières, il s’applique aussi aux actions.",
      "Lecture usuelle : au-dessus de +100, momentum haussier marqué / possible surachat ; en dessous de −100, momentum baissier / possible survente. Le zéro sert de ligne médiane.",
      "Limite : le CCI n’est pas borné comme le RSI ; des valeurs extrêmes peuvent s’étendre. Ajustez la période (souvent 20) à l’horizon et à la volatilité du titre.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Commodity Channel Index (CCI)",
        url: "https://www.investopedia.com/terms/c/commoditychannelindex.asp",
      },
      {
        title: "StockCharts School — Commodity Channel Index (CCI)",
        url: "https://school.stockcharts.com/doku.php?id=technical_indicators:commodity_channel_index_cci",
      },
      {
        title: "Fidelity — Commodity Channel Index",
        url: "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/cci",
      },
    ],
  },

  "ichimoku-kinko-hyo": {
    details: [
      "Ichimoku Kinko Hyo (« équilibre d’un coup d’œil ») combine plusieurs lignes : Tenkan, Kijun, Senkou Span A/B (nuage / Kumo) et Chikou Span. Le système vise à lire tendance, supports/résistances et momentum sur un même graphique.",
      "Lecture de base : prix au-dessus du nuage = biais haussier ; en dessous = biais baissier ; dans le nuage = indécision. La couleur/épaisseur du Kumo et les croisements Tenkan/Kijun affinent le contexte.",
      "Limite : les paramètres standards (9, 26, 52) viennent de séances japonaises historiques. Sur titres BRVM peu liquides, les signaux peuvent être trompeurs — préférez d’abord RSI, MACD et moyennes simples.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Ichimoku Cloud",
        url: "https://www.investopedia.com/terms/i/ichimoku-cloud.asp",
      },
      {
        title: "StockCharts School — Ichimoku Cloud",
        url: "https://school.stockcharts.com/doku.php?id=technical_indicators:ichimoku_cloud",
      },
      {
        title: "Wikipedia — Ichimoku Kinkō Hyō",
        url: "https://en.wikipedia.org/wiki/Ichimoku_Kink%C5%8D_Hy%C5%8D",
      },
    ],
  },

  "retracement-de-fibonacci": {
    details: [
      "Le retracement de Fibonacci place des niveaux horizontaux (souvent 23,6 %, 38,2 %, 50 %, 61,8 %, 78,6 %) entre un point haut et un point bas d’un mouvement. L’idée : une correction tend à s’arrêter près de ces proportions.",
      "Lecture : on observe si le prix réagit (rebond ou pause) autour de ces zones, en les croisant avec supports/résistances et volumes. Ce sont des repères subjectifs, pas des lois physiques.",
      "Limite : le choix des points d’ancrage change tout le tracé. Sur la BRVM, validez toujours avec tendance, liquidité et fondamentaux — les niveaux seuls ne suffisent pas.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Fibonacci Retracement",
        url: "https://www.investopedia.com/terms/f/fibonacciretracement.asp",
      },
      {
        title: "StockCharts School — Fibonacci Retracements",
        url: "https://school.stockcharts.com/doku.php?id=chart_analysis:fibonacci_retracemen",
      },
      {
        title: "Wikipedia — Fibonacci retracement",
        url: "https://en.wikipedia.org/wiki/Fibonacci_retracement",
      },
    ],
  },

  "theorie-des-vagues-d-elliott": {
    details: [
      "La théorie des vagues d’Elliott (Ralph Nelson Elliott) propose que les prix évoluent en motifs de vagues impulsives (souvent 5) et correctives (souvent 3), liés à la psychologie collective des marchés.",
      "L’analyste compte et étiquette des vagues à plusieurs échelles (fractales). Plusieurs scénarios coexistent souvent ; un niveau clé franchi peut invalider un comptage.",
      "Limite : cadre très interprétatif, difficile à tester objectivement. Peu robuste sur séries courtes ou titres illiquides — à classer en lecture secondaire sur la BRVM, jamais comme règle unique.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Elliott Wave Theory",
        url: "https://www.investopedia.com/terms/e/elliottwavetheory.asp",
      },
      {
        title: "StockCharts School — Elliott Wave Theory",
        url: "https://school.stockcharts.com/doku.php?id=market_analysis:elliott_wave_theory",
      },
      {
        title: "Wikipedia — Elliott wave principle",
        url: "https://en.wikipedia.org/wiki/Elliott_wave_principle",
      },
    ],
  },

  roic: {
    details: [
      "Le ROIC (Return on Invested Capital) mesure la rentabilité du capital investi : résultat opérationnel après impôt (NOPAT) rapporté au capital investi (capitaux propres + dette nette, selon la définition retenue).",
      "Lecture : un ROIC supérieur au coût du capital (WACC) suggère une création de valeur économique ; un ROIC inférieur, une destruction de valeur. La comparaison sectorielle et dans le temps est essentielle.",
      "Limite : les définitions de NOPAT et de capital investi varient selon les analystes. Harmonisez le numérateur et le dénominateur, et méfiez-vous des éléments exceptionnels dans les comptes publiés.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Return on Invested Capital (ROIC)",
        url: "https://www.investopedia.com/terms/r/returnoninvestmentcapital.asp",
      },
      {
        title: "Wikipedia — Return on capital",
        url: "https://en.wikipedia.org/wiki/Return_on_capital",
      },
    ],
  },

  wacc: {
    details: [
      "Le WACC (Weighted Average Cost of Capital), ou CMPC, est le coût moyen pondéré du capital : coût des fonds propres et coût de la dette après impôt, pondérés par la structure cible de financement.",
      "Il sert surtout de taux d’actualisation des flux d’entreprise (FCFF) et de seuil de comparaison pour le ROIC. Un projet ou une firme crée de la valeur si le rendement attendu dépasse le WACC.",
      "Limite : très sensible aux hypothèses (bêta, prime de risque, taux sans risque, structure cible, taux d’impôt). Documentez chaque hypothèse ; un WACC « précis à la virgule » sans transparence est trompeur.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Weighted Average Cost of Capital (WACC)",
        url: "https://www.investopedia.com/terms/w/wacc.asp",
      },
      {
        title: "Wikipedia — Weighted average cost of capital",
        url: "https://en.wikipedia.org/wiki/Weighted_average_cost_of_capital",
      },
    ],
  },

  fcfe: {
    details: [
      "Le FCFE (Free Cash Flow to Equity) est le flux de trésorerie disponible pour les actionnaires après investissements nets, variation du besoin en fonds de roulement et variation nette de la dette.",
      "On l’actualise souvent au coût des fonds propres (pas au WACC) pour estimer la valeur des capitaux propres. Il diffère du FCFF, qui appartient à tous les pourvoyeurs de capitaux (dette + equity).",
      "Limite : cohérence obligatoire entre flux et taux. Une dette volatile ou des réinvestissements mal estimés faussent le FCFE. Sur données BRVM, vérifiez la qualité des états financiers avant toute actualisation.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Free Cash Flow to Equity (FCFE)",
        url: "https://www.investopedia.com/terms/f/freecashflowtoequity.asp",
      },
      {
        title: "Wikipedia — Free cash flow",
        url: "https://en.wikipedia.org/wiki/Free_cash_flow",
      },
    ],
  },

  "ev-ebitda": {
    details: [
      "EV/EBITDA rapporte la valeur d’entreprise (Enterprise Value : capitalisation + dette nette − cash, selon définition) à l’EBITDA. C’est un multiple de valorisation souvent utilisé pour comparer des sociétés d’un même secteur.",
      "Avantage : il neutralise en partie les différences de structure de financement et de politique d’amortissement (par rapport au PER). Un multiple plus bas peut suggérer une valorisation relative plus attractive — toutes choses égales par ailleurs.",
      "Limite : attention aux normes comptables, au périmètre, aux éléments exceptionnels et à la dette hors bilan. Un EBITDA négatif ou volatil rend le ratio peu significatif.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — EV/EBITDA",
        url: "https://www.investopedia.com/terms/e/ev-ebitda.asp",
      },
      {
        title: "Wikipedia — EV/EBITDA",
        url: "https://en.wikipedia.org/wiki/EV/EBITDA",
      },
    ],
  },

  "piotroski-f-score": {
    details: [
      "Le F-Score de Joseph Piotroski (2000) additionne neuf critères binaires (0 ou 1) portant sur la rentabilité, le levier/liquidité et l’efficacité opérationnelle, à partir des états financiers.",
      "Un score élevé (proche de 9) indique une amélioration fondamentale relative ; un score bas (proche de 0), une détérioration. Conçu initialement pour filtrer des titres value, ce n’est pas une recommandation d’achat.",
      "Limite : exige des données historiques comparables. Moins adapté à certains secteurs (finance, assurance) où les postes bilanciels et de résultat ont un sens différent. Recalculez sur plusieurs exercices.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Piotroski Score",
        url: "https://www.investopedia.com/terms/p/piotroski-score.asp",
      },
      {
        title: "Wikipedia — Piotroski F-score",
        url: "https://en.wikipedia.org/wiki/Piotroski_F-score",
      },
    ],
  },

  beta: {
    details: [
      "Le bêta mesure la sensibilité historique du rendement d’un titre (ou d’un portefeuille) au rendement du marché. Un bêta de 1 suit en moyenne le marché ; > 1 amplifie les mouvements ; < 1 les amortit.",
      "Il entre dans le CAPM pour estimer le coût des fonds propres : taux sans risque + bêta × prime de risque. Le choix de l’indice de référence et de la fenêtre d’estimation change le résultat.",
      "Limite : le bêta est rétrospectif et instable. Sur la BRVM, liquidité faible et indices parfois peu représentatifs rendent l’estimation fragile — traitez-le comme une hypothèse, pas une constante.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Beta",
        url: "https://www.investopedia.com/terms/b/beta.asp",
      },
      {
        title: "Wikipedia — Beta (finance)",
        url: "https://en.wikipedia.org/wiki/Beta_(finance)",
      },
    ],
  },

  "prime-de-risque": {
    details: [
      "La prime de risque actions (equity risk premium) est le surcroît de rendement attendu des actions par rapport à un actif peu risqué (souvent obligations d’État). Elle rémunère le risque de marché non diversifiable.",
      "Dans le CAPM, coût des fonds propres ≈ taux sans risque + bêta × prime de risque. La prime peut être historique (ex post) ou implicite (ex ante, dérivée des valorisations et des bénéfices attendus).",
      "Limite : aucune « bonne » prime universelle. Pour un marché émergent ou régional, on ajuste souvent une prime de base par un risque pays — documentez la méthode plutôt que d’afficher un chiffre opaque.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Equity Risk Premium",
        url: "https://www.investopedia.com/terms/e/equityriskpremium.asp",
      },
      {
        title: "Investopedia — Market Risk Premium",
        url: "https://www.investopedia.com/terms/m/marketriskpremium.asp",
      },
      {
        title: "Wikipedia — Risk premium",
        url: "https://en.wikipedia.org/wiki/Risk_premium",
      },
    ],
  },

  "valeur-intrinseque": {
    details: [
      "La valeur intrinsèque est une estimation de la valeur « fondamentale » d’un actif, fondée sur les flux de trésorerie attendus, le risque et les perspectives de l’entreprise — distincte du cours de marché du moment.",
      "Méthodes courantes : actualisation des flux (DCF / FCFE / FCFF), modèles de dividendes, ou multiples relatifs calibrés. L’écart cours / valeur intrinsèque nourrit les approches value (marge de sécurité).",
      "Limite : c’est une estimation, pas une vérité. Deux analystes raisonnables peuvent diverger fortement selon les hypothèses. Sur la BRVM, la qualité et la fraîcheur des données comptables conditionnent la fiabilité.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Intrinsic Value",
        url: "https://www.investopedia.com/terms/i/intrinsicvalue.asp",
      },
      {
        title: "Wikipedia — Intrinsic value (finance)",
        url: "https://en.wikipedia.org/wiki/Intrinsic_value_(finance)",
      },
    ],
  },

  "effet-de-levier": {
    details: [
      "L’effet de levier consiste à utiliser de la dette (ou un instrument à marge) pour amplifier l’exposition. Si le rendement des actifs dépasse le coût de la dette, le rendement des fonds propres peut être boosté — et inversement en cas de baisse.",
      "On distingue le levier opérationnel (poids des coûts fixes) et le levier financier (endettement). Les ratios dette/capitaux propres ou dette nette/EBITDA aident à mesurer l’ampleur du levier financier.",
      "Limite : le levier amplifie aussi les pertes et le risque de solvabilité. Sur un marché peu liquide, sortir d’une position endettée peut être coûteux. Le levier n’est jamais neutre.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Leverage",
        url: "https://www.investopedia.com/terms/l/leverage.asp",
      },
      {
        title: "Investopedia — Financial Leverage",
        url: "https://www.investopedia.com/terms/f/financialleverage.asp",
      },
      {
        title: "Wikipedia — Leverage (finance)",
        url: "https://en.wikipedia.org/wiki/Leverage_(finance)",
      },
    ],
  },

  "vente-a-decouvert": {
    details: [
      "La vente à découvert (short selling) consiste à vendre un titre que l’on ne détient pas encore (souvent emprunté), dans l’espoir de le racheter moins cher plus tard et de réaliser la différence.",
      "Le gain potentiel est plafonné (le cours ne peut pas descendre sous zéro), tandis que la perte théorique est illimitée si le cours monte. Un « short squeeze » peut forcer le rachat à des prix élevés.",
      "Limite : réglementations, coûts d’emprunt et liquidité conditionnent la faisabilité. Sur la BRVM, la pratique est peu accessible au particulier classique — comprendre le concept aide surtout à lire le risque de marché.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Short Selling",
        url: "https://www.investopedia.com/terms/s/shortselling.asp",
      },
      {
        title: "Wikipedia — Short (finance)",
        url: "https://en.wikipedia.org/wiki/Short_(finance)",
      },
    ],
  },

  "hedging-couverture": {
    details: [
      "Le hedging (couverture) vise à réduire un risque de prix, de change ou de taux en prenant une position opposée (futures, options, ou actifs corrélés négativement), pas à maximiser le rendement.",
      "Exemple conceptuel : un exportateur peut se couvrir contre une baisse de devises ; un portefeuille actions peut réduire partiellement le bêta via des instruments dérivés ou une diversification adéquate.",
      "Limite : une couverture a un coût (primes, basis risk, liquidité). Une couverture imparfaite laisse un risque résiduel. Objectif = gérer le risque, pas « verrouiller » un gain certain.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Hedge",
        url: "https://www.investopedia.com/terms/h/hedge.asp",
      },
      {
        title: "Wikipedia — Hedge (finance)",
        url: "https://en.wikipedia.org/wiki/Hedge_(finance)",
      },
    ],
  },

  "drawdown-maximal": {
    details: [
      "Le drawdown mesure la baisse d’un portefeuille (ou d’un titre) depuis un plus-haut historique jusqu’au plus-bas suivant, avant un nouveau plus-haut. Le drawdown maximal (MDD) est la plus grande de ces baisses sur la période étudiée.",
      "Il exprime le pire « trou d’air » subi, en pourcentage. Utile pour comparer stratégies ou fonds : deux performances moyennes proches peuvent cacher des MDD très différents.",
      "Limite : le MDD dépend de la fenêtre et de la fréquence des données. Il ne dit pas combien de temps a duré la baisse ni la probabilité d’une baisse future. Complétez avec volatilité et horizon d’investissement.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Drawdown",
        url: "https://www.investopedia.com/terms/d/drawdown.asp",
      },
      {
        title: "Investopedia — Maximum Drawdown (MDD)",
        url: "https://www.investopedia.com/terms/m/maximum-drawdown-mdd.asp",
      },
      {
        title: "Wikipedia — Drawdown (economics)",
        url: "https://en.wikipedia.org/wiki/Drawdown_(economics)",
      },
    ],
  },

  "var-value-at-risk": {
    details: [
      "La Value at Risk (VaR) estime, sous des hypothèses données, la perte maximale attendue sur un horizon (ex. 1 jour, 10 jours) à un niveau de confiance (ex. 95 % ou 99 %). Exemple de lecture : « VaR 1 jour 95 % = X » signifie que, historiquement/modélisé, la perte ne devrait dépasser X que 5 % du temps.",
      "Méthodes courantes : historique, variance-covariance (paramétrique) et simulation de Monte-Carlo. La VaR est devenue un standard de reporting du risque de marché.",
      "Limite : la VaR ne décrit pas l’ampleur des pertes au-delà du seuil (queue de distribution). Elle peut sous-estimer les crises extrêmes. Complétez avec stress tests et CVaR (expected shortfall).",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Value at Risk (VaR)",
        url: "https://www.investopedia.com/terms/v/var.asp",
      },
      {
        title: "Wikipedia — Value at risk",
        url: "https://en.wikipedia.org/wiki/Value_at_risk",
      },
    ],
  },

  "cvar-expected-shortfall": {
    details: [
      "La CVaR (Conditional Value at Risk), aussi appelée Expected Shortfall, mesure la perte moyenne attendue dans les cas où la perte dépasse le seuil de VaR. Elle décrit la « queue » du risque, pas seulement le seuil.",
      "À confiance égale, la CVaR est en général plus élevée (plus conservative) que la VaR. Elle est privilégiée en gestion des risques pour mieux capturer les scénarios extrêmes.",
      "Limite : comme la VaR, elle dépend du modèle, de l’horizon et des données. Elle reste une estimation statistique — utile en complément de scénarios de stress qualitatifs et de limites de levier.",
    ].join("\n\n"),
    sources: [
      {
        title: "Investopedia — Conditional Value at Risk (CVaR)",
        url: "https://www.investopedia.com/terms/c/conditional_value_at_risk.asp",
      },
      {
        title: "Wikipedia — Expected shortfall",
        url: "https://en.wikipedia.org/wiki/Expected_shortfall",
      },
    ],
  },
};
