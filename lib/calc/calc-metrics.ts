// ═══════════════════════════════════════════════════════════════════════════
// Métriques financières par société — étape 5, optimisé étape 14 (10/08/2026)
// ═══════════════════════════════════════════════════════════════════════════
// Port TypeScript de `calcMetrics()` (reference/BRVM_Dashboard.jsx), enrichi
// sur demande utilisateur (« optimiser l'analyse… signal final avec
// explication ») :
//   - Les métriques BRUTES (perf 5/10 ans, rendement, volatilité, cours/
//     dividende courants) restent calculées comme avant.
//   - Le SCORE / SIGNAL sont RECALIBRÉS pour ne plus pénaliser artificiellement
//     les sociétés à historique court (volatilité "N/D" ≠ risque "Élevé"),
//     pour mieux traiter les PER extrêmes, et pour produire une EXPLICATION
//     française du signal final (résumé + facteurs pour/contre).
//   - Les libellés de signal restent NON NÉGOCIABLES : ACHAT FORT / ACHAT /
//     CONSERVER / ALLÉGER / VENDRE.
//
// Les tests golden (étape 5) vérifient désormais la parité des métriques
// brutes uniquement ; le score/signal/explication ont leurs propres tests.

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

export type SignalReasonKind = "positif" | "negatif" | "neutre";

export interface SignalReason {
  kind: SignalReasonKind;
  text: string;
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
  /// "N/D" si la volatilité n'est pas calculable (historique trop court) —
  /// plus de repli artificiel sur "Élevé" (artefact JSX corrigé à l'étape 14).
  riskLevel: "Faible" | "Moyen" | "Élevé" | "N/D";
  /// Score composite 0-100 (formule optimisée étape 14).
  score: number;
  signal: TradeSignal;
  currentPrice: number;
  currentDividend: number;
  /// Nombre d'années de cours valides (profondeur de l'historique).
  historyDepth: number;
  /// Confiance dans le signal, dérivée de la profondeur de données.
  confidence: "Élevée" | "Moyenne" | "Faible";
  /// Phrase de synthèse du signal final (français).
  signalSummary: string;
  /// Facteurs explicatifs (pour / contre / neutre) du score et du signal.
  signalReasons: SignalReason[];
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
  /// 12 — horizon de référence long terme). Si la société a un historique
  /// plus court, on utilise plutôt le nombre d'années depuis la première
  /// cotation connue (voir calcul ci-dessous).
  dividendRegularityWindow?: number;
}

function signalFromScore(score: number): TradeSignal {
  if (score >= 80) return { label: "ACHAT FORT", color: "#22C55E" };
  if (score >= 65) return { label: "ACHAT", color: "#84CC16" };
  if (score >= 50) return { label: "CONSERVER", color: "#D4A843" };
  if (score >= 35) return { label: "ALLÉGER", color: "#F97316" };
  return { label: "VENDRE", color: "#EF4444" };
}

function formatFrNumber(n: number, digits = 1): string {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function calcMetrics(input: CalcMetricsInput, options: CalcMetricsOptions = {}): CalcMetricsResult {
  const { years, prices, dividends, per } = input;
  const perfShortYears = options.perfShortYears ?? 5;
  const perfLongMinPoints = options.perfLongMinPoints ?? 10;
  const dividendRegularityWindow = options.dividendRegularityWindow ?? 12;

  const yearsWithPrice = years.filter((y) => (prices[y] ?? 0) > 0);
  const validPrices = yearsWithPrice.map((y) => prices[y]);
  const validDivs = years.filter((y) => (dividends[y] ?? 0) > 0).map((y) => dividends[y]);
  const historyDepth = validPrices.length;

  const shortWindow = perfShortYears + 1; // ex: 5 ans en arrière = 6 points
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

  // Performance sur l'historique disponible (si < fenêtre 5 ans) — utilisée
  // uniquement pour le score/explication, jamais affichée à la place de perf5.
  let availableSpanPerf: number | null = null;
  if (validPrices.length >= 2 && validPrices.length < shortWindow) {
    availableSpanPerf =
      ((validPrices[validPrices.length - 1] - validPrices[0]) / validPrices[0]) * 100;
  }

  const avgDividend: string | number = validDivs.length
    ? (validDivs.reduce((a, b) => a + b, 0) / validDivs.length).toFixed(0)
    : 0;

  const lastYear = years[years.length - 1];
  const secondLastYear = years[years.length - 2];
  const currentPrice = prices[lastYear] || prices[secondLastYear] || 0;
  const currentDividend = dividends[lastYear] || dividends[secondLastYear] || 0;

  const dividendYieldPercent: string | number =
    currentPrice > 0 ? ((currentDividend / currentPrice) * 100).toFixed(2) : 0;
  const yieldValue = parseFloat(String(dividendYieldPercent)) || 0;

  const yearOverYearAbsChanges: number[] = [];
  for (let i = 1; i < years.length; i++) {
    const p = prices[years[i - 1]];
    const q = prices[years[i]];
    if (p > 0 && q > 0) yearOverYearAbsChanges.push(Math.abs(((q - p) / p) * 100));
  }
  const volatilityPercent = yearOverYearAbsChanges.length
    ? (yearOverYearAbsChanges.reduce((a, b) => a + b, 0) / yearOverYearAbsChanges.length).toFixed(1)
    : "N/D";

  // Étape 14 : si volatilité absente → risque "N/D" (honnêteté des données),
  // plus le repli JSX sur "Élevé" qui faussait le score des titres récents.
  const volatilityValue = parseFloat(volatilityPercent);
  const riskLevel: CalcMetricsResult["riskLevel"] = Number.isNaN(volatilityValue)
    ? "N/D"
    : volatilityValue < 10
      ? "Faible"
      : volatilityValue < 20
        ? "Moyen"
        : "Élevé";

  const confidence: CalcMetricsResult["confidence"] =
    historyDepth >= 8 ? "Élevée" : historyDepth >= 3 ? "Moyenne" : "Faible";

  // Fenêtre de régularité des dividendes = min(12, années depuis 1re cotation).
  // Évite de sanctionner une société cotée depuis 2 ans parce qu'elle n'a
  // pas 12 années de dividendes dans le jeu.
  const listingSpan = Math.max(historyDepth, 1);
  const regularityWindow = Math.max(1, Math.min(dividendRegularityWindow, listingSpan));

  const reasons: SignalReason[] = [];
  let score = 0;

  // ── 1) Performance (max 30) ──────────────────────────────────────────────
  if (perf5Percent !== "N/D") {
    const p5 = parseFloat(perf5Percent);
    const contrib = Math.min(30, Math.max(0, p5 / 3));
    score += contrib;
    if (p5 >= 40) {
      reasons.push({
        kind: "positif",
        text: `Forte performance sur 5 ans (+${formatFrNumber(p5)} %), moteur principal du score.`,
      });
    } else if (p5 >= 10) {
      reasons.push({
        kind: "positif",
        text: `Performance 5 ans positive (+${formatFrNumber(p5)} %).`,
      });
    } else if (p5 >= 0) {
      reasons.push({
        kind: "neutre",
        text: `Performance 5 ans faible (+${formatFrNumber(p5)} %).`,
      });
    } else {
      reasons.push({
        kind: "negatif",
        text: `Performance 5 ans négative (${formatFrNumber(p5)} %).`,
      });
    }
  } else if (availableSpanPerf !== null) {
    // Historique court : contribution plafonnée à 12 pts (pas 30).
    const contrib = Math.min(12, Math.max(0, availableSpanPerf / 5));
    score += contrib;
    reasons.push({
      kind: availableSpanPerf >= 0 ? "neutre" : "negatif",
      text: `Historique court (${historyDepth} ans) : perf. disponible ${availableSpanPerf >= 0 ? "+" : ""}${formatFrNumber(availableSpanPerf)} % (poids réduit).`,
    });
  } else {
    reasons.push({
      kind: "neutre",
      text: "Performance multi-année non calculable (historique insuffisant) — critère non noté.",
    });
  }

  // ── 2) Rendement du dividende (max 25, plafonné si historique faible) ────
  const yieldCap = confidence === "Faible" ? 12 : 25;
  // Un rendement > 20 % sur BRVM est souvent exceptionnel / one-off : on
  // plafonne la contribution économique à l'équivalent de 12 % de yield.
  const yieldForScore = Math.min(yieldValue, 12);
  const yieldContrib = Math.min(yieldCap, yieldForScore * 3);
  score += yieldContrib;
  if (yieldValue >= 5) {
    reasons.push({
      kind: "positif",
      text: `Rendement du dividende attractif (${formatFrNumber(yieldValue, 2)} %).${yieldValue > 12 ? " Attention : niveau exceptionnel, contribution plafonnée." : ""}`,
    });
  } else if (yieldValue > 0) {
    reasons.push({
      kind: "neutre",
      text: `Rendement du dividende modéré (${formatFrNumber(yieldValue, 2)} %).`,
    });
  } else {
    reasons.push({
      kind: "negatif",
      text: "Aucun dividende courant détecté (rendement 0 %).",
    });
  }

  // ── 3) Régularité des dividendes (max 20) ────────────────────────────────
  const regularityRatio = Math.min(1, validDivs.length / regularityWindow);
  score += regularityRatio * 20;
  if (validDivs.length === 0) {
    reasons.push({ kind: "negatif", text: "Aucune année de dividende connue sur la période." });
  } else if (regularityRatio >= 0.7) {
    reasons.push({
      kind: "positif",
      text: `Dividendes réguliers (${validDivs.length} année${validDivs.length > 1 ? "s" : ""} sur ${regularityWindow}).`,
    });
  } else {
    reasons.push({
      kind: "neutre",
      text: `Dividendes irréguliers ou historique partiel (${validDivs.length}/${regularityWindow} années).`,
    });
  }

  // ── 4) Valorisation PER (max 15) ─────────────────────────────────────────
  let perContrib = 0;
  if (!(per > 0) || per > 80) {
    perContrib = 0;
    reasons.push({
      kind: "negatif",
      text:
        !(per > 0)
          ? "PER indisponible ou non significatif — valorisation non notée."
          : `PER extrême (${formatFrNumber(per, 2)}) : valorisation peu lisible / potentiellement déformée.`,
    });
  } else if (per < 8) {
    perContrib = 15;
    reasons.push({ kind: "positif", text: `PER bas (${formatFrNumber(per, 2)}) : valorisation attractive.` });
  } else if (per < 12) {
    perContrib = 10;
    reasons.push({ kind: "positif", text: `PER raisonnable (${formatFrNumber(per, 2)}).` });
  } else if (per < 18) {
    perContrib = 6;
    reasons.push({ kind: "neutre", text: `PER dans la moyenne (${formatFrNumber(per, 2)}).` });
  } else if (per <= 40) {
    perContrib = 3;
    reasons.push({ kind: "negatif", text: `PER élevé (${formatFrNumber(per, 2)}) : titre cher par rapport aux bénéfices.` });
  } else {
    perContrib = 1;
    reasons.push({ kind: "negatif", text: `PER très élevé (${formatFrNumber(per, 2)}).` });
  }
  score += perContrib;

  // ── 5) Risque / volatilité (max 10) ──────────────────────────────────────
  if (riskLevel === "Faible") {
    score += 10;
    reasons.push({
      kind: "positif",
      text: `Volatilité maîtrisée (${volatilityPercent} %) → risque faible.`,
    });
  } else if (riskLevel === "Moyen") {
    score += 6;
    reasons.push({
      kind: "neutre",
      text: `Volatilité modérée (${volatilityPercent} %) → risque moyen.`,
    });
  } else if (riskLevel === "Élevé") {
    score += 2;
    reasons.push({
      kind: "negatif",
      text: `Volatilité élevée (${volatilityPercent} %) → risque élevé.`,
    });
  } else {
    // N/D : 0 pt (ni bonus ni malus)
    reasons.push({
      kind: "neutre",
      text: "Risque non évaluable (historique trop court pour mesurer la volatilité).",
    });
  }

  score = Math.min(100, Math.round(score));

  // Avec peu de données, on évite les signaux extrêmes (ACHAT FORT / VENDRE
  // trop affirmés) : on recentre d'un cran vers CONSERVER.
  let signal = signalFromScore(score);
  if (confidence === "Faible") {
    if (signal.label === "ACHAT FORT") signal = signalFromScore(79); // → ACHAT
    else if (signal.label === "VENDRE") signal = signalFromScore(35); // → ALLÉGER
    reasons.push({
      kind: "neutre",
      text: `Confiance ${confidence} (${historyDepth} année${historyDepth > 1 ? "s" : ""} de cours) : signal extrême modéré.`,
    });
  } else if (confidence === "Moyenne" && signal.label === "ACHAT FORT") {
    signal = signalFromScore(79);
    reasons.push({
      kind: "neutre",
      text: `Confiance ${confidence} : le signal est plafonné à ACHAT (historique encore partiel).`,
    });
  } else {
    reasons.push({
      kind: "neutre",
      text: `Confiance ${confidence} dans l'analyse (${historyDepth} années de cours).`,
    });
  }

  const signalSummary = buildSignalSummary(signal.label, score, confidence, reasons);

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
    historyDepth,
    confidence,
    signalSummary,
    signalReasons: reasons,
  };
}

function buildSignalSummary(
  label: TradeSignal["label"],
  score: number,
  confidence: CalcMetricsResult["confidence"],
  reasons: SignalReason[]
): string {
  const topPositive = reasons.find((r) => r.kind === "positif");
  const topNegative = reasons.find((r) => r.kind === "negatif");
  const parts = [
    `Signal final : ${label} (score ${score}/100, confiance ${confidence}).`,
  ];
  if (topPositive) parts.push(topPositive.text);
  if (topNegative) parts.push(topNegative.text);
  if (!topPositive && !topNegative) {
    parts.push("Les indicateurs disponibles sont mitigés ou incomplets.");
  }
  return parts.join(" ");
}
