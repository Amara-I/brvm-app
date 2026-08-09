// ═══════════════════════════════════════════════════════════════════════════
// Métriques financières par société — étape 5 du plan de migration
// ═══════════════════════════════════════════════════════════════════════════
// Port TypeScript strict de `calcMetrics()` (reference/BRVM_Dashboard.jsx).
// Les formules et seuils sont repris À L'IDENTIQUE, y compris certains
// artefacts du code d'origine (documentés ci-dessous), afin de garantir que
// le futur branchement du dashboard sur cette fonction (étape 8) ne change
// AUCUN chiffre affiché. Vérifié par lib/calc/calc-metrics.test.ts contre la
// fixture lib/calc/__fixtures__/golden-legacy-output.json (générée en
// exécutant le code JSX original tel quel).

export interface CalcMetricsInput {
  /// Années disponibles, en ordre chronologique croissant (ex: 2015..2026).
  years: number[];
  /// Cours de clôture par année. 0 ou absent = société non cotée cette année-là.
  prices: Record<number, number>;
  /// Dividende par action et par année. 0 ou absent = aucun dividende versé.
  dividends: Record<number, number>;
  /// PER "actuel" de la société (cf. FinancialRatio.per).
  per: number;
}

export interface TradeSignal {
  label: "ACHAT FORT" | "ACHAT" | "CONSERVER" | "ALLÉGER" | "VENDRE";
  color: string;
}

export interface CalcMetricsResult {
  /// Performance sur `perfShortYears` (5 par défaut) ans, déjà arrondie à 1
  /// décimale (string), ou "N/D" si pas assez de données.
  perf5Percent: string;
  /// Performance depuis le premier point valide, déjà arrondie à 1 décimale
  /// (string), ou "N/D" si moins de `perfLongMinPoints` points valides.
  perf10Percent: string;
  /// Dividende moyen historique, arrondi à l'unité (string), ou `0`
  /// (nombre littéral) si aucun dividende n'a jamais été versé — cette
  /// asymétrie de type est héritée du JSX d'origine et volontairement
  /// préservée (cf. tests de non-régression).
  avgDividend: string | number;
  /// Rendement du dividende actuel, arrondi à 2 décimales (string), ou `0`
  /// (nombre littéral) si le cours actuel est inconnu/nul — même remarque
  /// que `avgDividend`.
  dividendYieldPercent: string | number;
  /// Volatilité moyenne (moyenne des variations absolues d'une année sur
  /// l'autre), arrondie à 1 décimale (string), ou "N/D".
  volatilityPercent: string;
  riskLevel: "Faible" | "Moyen" | "Élevé";
  /// Score composite 0-100.
  score: number;
  signal: TradeSignal;
  currentPrice: number;
  currentDividend: number;
}

export interface CalcMetricsOptions {
  /// Nombre d'années en arrière pour la performance "court terme" (défaut 5,
  /// comme le JSX — un delta sur `perfShortYears + 1` points de données).
  perfShortYears?: number;
  /// Nombre minimal de points de données valides requis pour calculer la
  /// performance "long terme" (défaut 10 — valeur codée en dur dans le JSX
  /// d'origine, indépendante de la longueur réelle de `years`).
  perfLongMinPoints?: number;
  /// Diviseur du bonus de régularité des dividendes dans le score (défaut
  /// 12 — nombre d'années du jeu de données d'origine, 2015-2026). Une
  /// évolution délibérée de ce paramètre nécessiterait de recalibrer le
  /// modèle de score dans son ensemble ; ce n'est PAS fait ici pour préserver
  /// la parité numérique avec l'existant (cf. objectif de cette étape 5).
  dividendRegularityWindow?: number;
}

export function calcMetrics(input: CalcMetricsInput, options: CalcMetricsOptions = {}): CalcMetricsResult {
  const { years, prices, dividends, per } = input;
  const perfShortYears = options.perfShortYears ?? 5;
  const perfLongMinPoints = options.perfLongMinPoints ?? 10;
  const dividendRegularityWindow = options.dividendRegularityWindow ?? 12;

  const validPrices = years.filter((y) => prices[y] > 0).map((y) => prices[y]);
  const validDivs = years.filter((y) => dividends[y] > 0).map((y) => dividends[y]);

  const shortWindow = perfShortYears + 1; // ex: 5 ans en arrière = 6 points, comme `validPrices.length >= 6` dans le JSX
  const perf5Percent =
    validPrices.length >= shortWindow
      ? (
          ((validPrices[validPrices.length - 1] - validPrices[validPrices.length - shortWindow]) /
            validPrices[validPrices.length - shortWindow]) *
          100
        ).toFixed(1)
      : "N/D";

  const perf10Percent =
    validPrices.length >= perfLongMinPoints
      ? (((validPrices[validPrices.length - 1] - validPrices[0]) / validPrices[0]) * 100).toFixed(1)
      : "N/D";

  const avgDividend: string | number = validDivs.length ? (validDivs.reduce((a, b) => a + b, 0) / validDivs.length).toFixed(0) : 0;

  // Cours/dividende "actuels" = dernière année disponible dans `years`, avec
  // repli sur l'avant-dernière (généralisation de `co.prices[2026] ||
  // co.prices[2025] || 0`, qui codait en dur les 2 derniers millésimes du
  // jeu de données d'origine).
  const lastYear = years[years.length - 1];
  const secondLastYear = years[years.length - 2];
  const currentPrice = prices[lastYear] || prices[secondLastYear] || 0;
  const currentDividend = dividends[lastYear] || dividends[secondLastYear] || 0;

  const dividendYieldPercent: string | number = currentPrice > 0 ? ((currentDividend / currentPrice) * 100).toFixed(2) : 0;

  // Volatilité = moyenne des variations absolues d'une année valide à la
  // suivante (les deux années comparées doivent avoir un cours > 0, comme
  // dans le JSX).
  const yearOverYearAbsChanges: number[] = [];
  for (let i = 1; i < years.length; i++) {
    const p = prices[years[i - 1]];
    const q = prices[years[i]];
    if (p > 0 && q > 0) yearOverYearAbsChanges.push(Math.abs(((q - p) / p) * 100));
  }
  const volatilityPercent = yearOverYearAbsChanges.length
    ? (yearOverYearAbsChanges.reduce((a, b) => a + b, 0) / yearOverYearAbsChanges.length).toFixed(1)
    : "N/D";

  // ⚠️ Artefact hérité du JSX, préservé à l'identique : si `volatilityPercent`
  // vaut "N/D", `parseFloat("N/D")` retourne `NaN`, et `NaN < 10` / `NaN < 20`
  // valent tous deux `false` → le risque retombe sur "Élevé" par défaut. Ce
  // n'est pas un choix produit délibéré, mais on le reproduit sciemment pour
  // ne rien changer au rendu actuel (cf. contrainte de non-régression).
  const volatilityValue = parseFloat(volatilityPercent);
  const riskLevel: CalcMetricsResult["riskLevel"] = volatilityValue < 10 ? "Faible" : volatilityValue < 20 ? "Moyen" : "Élevé";

  let score = 0;
  if (perf5Percent !== "N/D") score += Math.min(30, parseFloat(perf5Percent) / 3);
  score += Math.min(25, parseFloat(String(dividendYieldPercent)) * 3);
  score += (validDivs.length / dividendRegularityWindow) * 20;
  score += per < 8 ? 15 : per < 10 ? 10 : per < 12 ? 6 : 3;
  score += riskLevel === "Faible" ? 10 : riskLevel === "Moyen" ? 6 : 2;
  score = Math.min(100, Math.round(score));

  const signal: TradeSignal =
    score >= 80
      ? { label: "ACHAT FORT", color: "#22C55E" }
      : score >= 65
        ? { label: "ACHAT", color: "#84CC16" }
        : score >= 50
          ? { label: "CONSERVER", color: "#D4A843" }
          : score >= 35
            ? { label: "ALLÉGER", color: "#F97316" }
            : { label: "VENDRE", color: "#EF4444" };

  return {
    perf5Percent,
    perf10Percent,
    avgDividend,
    dividendYieldPercent,
    volatilityPercent,
    riskLevel,
    score,
    signal,
    currentPrice,
    currentDividend,
  };
}
