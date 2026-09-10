// ═══════════════════════════════════════════════════════════════════════════
// Métriques financières par société — étape 5, optimisé étape 14 + LeyInvest
// ═══════════════════════════════════════════════════════════════════════════
// Port TypeScript de `calcMetrics()` (reference/BRVM_Dashboard.jsx), enrichi :
//   - Métriques BRUTES inchangées (perf, yield, volatilité, cours).
//   - Score composite multi-horizons + garde-fou risque (cahier LeyInvest).
//   - Libellés de signal NON NÉGOCIABLES : ACHAT FORT / ACHAT / CONSERVER /
//     ALLÉGER / VENDRE.
//   - riskLevel (Faible/Moyen/Élevé/N/D) reste la volatilité simple ;
//     riskAnalysis porte la gestion du risque détaillée.

import {
  computeRiskAnalysis,
  type RiskAnalysis,
  type RiskClosePoint,
} from "./risk-analysis";
import { computeTechnicalSnapshot, type TechnicalSnapshot } from "../charts/technical-indicators";

export interface CalcMetricsInput {
  /// Années disponibles, en ordre chronologique croissant (ex: 2015..2026).
  years: number[];
  /// Cours de clôture par année. 0 ou absent = société non cotée cette année-là.
  prices: Record<number, number>;
  /// Dividende par action et par année. 0 ou absent = aucun dividende versé.
  dividends: Record<number, number>;
  /// PER "actuel" de la société (cf. FinancialRatio.per).
  per: number;
  /// Capitalisation (Md FCFA) — optionnel, pour le risque de liquidité.
  mktcap?: number;
  /// Secteur — optionnel, pour le risque opérationnel.
  sector?: string;
  /// Série de clôtures densifiée — optionnel (horizons courts, VaR, drawdown).
  closes?: RiskClosePoint[];
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

export interface HorizonScores {
  court: number;
  moyen: number;
  long: number;
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
  /// Score composite 0-100 (technique + fondamental + risque inversé).
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
  /// Scores multi-horizons 0–100.
  horizonScores: HorizonScores;
  technicalScore: number;
  fundamentalScore: number;
  /// Alias explicite du score composite (= `score`).
  compositeScore: number;
  /// Analyse de risque multi-piliers.
  riskAnalysis: RiskAnalysis;
  /// Indicateurs techniques (N/D si série insuffisante).
  technical: TechnicalSnapshot;
  /// Score sectoriel 0–100 (proxy cyclicity inverse + profondeur).
  sectorScore: number;
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

const SIGNAL_COLORS: Record<TradeSignal["label"], string> = {
  "ACHAT FORT": "#22C55E",
  ACHAT: "#84CC16",
  CONSERVER: "#D4A843",
  ALLÉGER: "#F97316",
  VENDRE: "#EF4444",
};

function signalOf(label: TradeSignal["label"]): TradeSignal {
  return { label, color: SIGNAL_COLORS[label] };
}

function formatFrNumber(n: number, digits = 1): string {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function clamp100(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Mappe une performance % vers un score 0–100. */
function perfToScore(perf: number | null, softCap = 80): number {
  if (perf == null || !Number.isFinite(perf)) return 45;
  // -40 % → ~10 ; 0 % → 50 ; +softCap % → ~90
  const t = 50 + (perf / softCap) * 40;
  return clamp100(t);
}

function seriesPerfPercent(closes: RiskClosePoint[], lookbackDays: number): number | null {
  if (!closes || closes.length < 2) return null;
  const last = closes[closes.length - 1]!;
  const target = new Date(last.time);
  target.setUTCDate(target.getUTCDate() - lookbackDays);
  const iso = target.toISOString().slice(0, 10);
  let from = closes[0]!;
  for (const p of closes) {
    if (p.time <= iso) from = p;
    else break;
  }
  if (!(from.value > 0) || !(last.value > 0)) return null;
  // Exige un vrai écart temporel (évite de traiter 2 points annuels comme 1 an)
  if (from.time === last.time) return null;
  return ((last.value - from.value) / from.value) * 100;
}

function annualYoyPerf(years: number[], prices: Record<number, number>): number | null {
  const withPrice = years.filter((y) => (prices[y] ?? 0) > 0);
  if (withPrice.length < 2) return null;
  const y1 = withPrice[withPrice.length - 1]!;
  const y0 = withPrice[withPrice.length - 2]!;
  const p0 = prices[y0]!;
  const p1 = prices[y1]!;
  if (!(p0 > 0)) return null;
  return ((p1 - p0) / p0) * 100;
}

/**
 * Matrice de décision LeyInvest → libellés FR non négociables.
 */
export function signalFromComposite(composite: number, riskScore: number): TradeSignal {
  if (composite > 75 && riskScore < 60) return signalOf("ACHAT FORT");
  if (composite > 60 && riskScore < 70) return signalOf("ACHAT");
  if (composite < 25 && riskScore > 60) return signalOf("VENDRE");
  if (composite < 40) return signalOf("ALLÉGER");
  return signalOf("CONSERVER");
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
          ((validPrices[validPrices.length - 1]! - validPrices[validPrices.length - shortWindow]!) /
            validPrices[validPrices.length - shortWindow]!) *
          100
        ).toFixed(1)
      : "N/D";

  const perf10Percent =
    validPrices.length >= perfLongMinPoints
      ? (((validPrices[validPrices.length - 1]! - validPrices[0]!) / validPrices[0]!) * 100).toFixed(1)
      : "N/D";

  let availableSpanPerf: number | null = null;
  if (validPrices.length >= 2 && validPrices.length < shortWindow) {
    availableSpanPerf =
      ((validPrices[validPrices.length - 1]! - validPrices[0]!) / validPrices[0]!) * 100;
  }

  const avgDividend: string | number = validDivs.length
    ? (validDivs.reduce((a, b) => a + b, 0) / validDivs.length).toFixed(0)
    : 0;

  const lastYear = years[years.length - 1];
  const secondLastYear = years[years.length - 2];
  const currentPrice = prices[lastYear!] || prices[secondLastYear!] || 0;
  const currentDividend = dividends[lastYear!] || dividends[secondLastYear!] || 0;

  const dividendYieldPercent: string | number =
    currentPrice > 0 ? ((currentDividend / currentPrice) * 100).toFixed(2) : 0;
  const yieldValue = parseFloat(String(dividendYieldPercent)) || 0;

  const yearOverYearAbsChanges: number[] = [];
  for (let i = 1; i < years.length; i++) {
    const p = prices[years[i - 1]!];
    const q = prices[years[i]!];
    if (p && q && p > 0 && q > 0) yearOverYearAbsChanges.push(Math.abs(((q - p) / p) * 100));
  }
  const volatilityPercent = yearOverYearAbsChanges.length
    ? (yearOverYearAbsChanges.reduce((a, b) => a + b, 0) / yearOverYearAbsChanges.length).toFixed(1)
    : "N/D";

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

  const listingSpan = Math.max(historyDepth, 1);
  const regularityWindow = Math.max(1, Math.min(dividendRegularityWindow, listingSpan));
  const regularityRatio = Math.min(1, validDivs.length / regularityWindow);

  const reasons: SignalReason[] = [];

  // ── Analyse de risque détaillée ──────────────────────────────────────────
  const riskAnalysis = computeRiskAnalysis({
    years,
    prices,
    dividends,
    per,
    mktcap: input.mktcap,
    sector: input.sector,
    closes: input.closes,
    volatilityPercent,
    historyDepth,
  });

  // ── Horizons ─────────────────────────────────────────────────────────────
  const closes = input.closes;
  const technical = computeTechnicalSnapshot(closes ?? []);

  let courtPerf = closes?.length ? seriesPerfPercent(closes, 365) : null;
  if (courtPerf == null) courtPerf = annualYoyPerf(years, prices);
  let court = perfToScore(courtPerf, 40);
  // Cahier v2 : si indicateurs dispo, le court terme s'appuie sur RSI/MACD/SMA.
  if (technical.shortTermScore != null) {
    court = clamp100(0.45 * court + 0.55 * technical.shortTermScore);
    for (const n of technical.notes.slice(0, 2)) {
      reasons.push({ kind: "neutre", text: `Technique court terme : ${n}` });
    }
  }

  const p5 = perf5Percent !== "N/D" ? parseFloat(perf5Percent) : availableSpanPerf;
  const moyen = perfToScore(p5, 80);

  const p10 = perf10Percent !== "N/D" ? parseFloat(perf10Percent) : null;
  let long = perfToScore(p10 ?? availableSpanPerf, 120);
  let perBoost = 50;
  if (per > 0 && per <= 80) {
    perBoost = per < 8 ? 80 : per < 12 ? 70 : per < 18 ? 55 : per <= 40 ? 35 : 20;
  } else if (!(per > 0)) {
    perBoost = 40;
  } else {
    perBoost = 15;
  }
  long = clamp100(long * 0.55 + perBoost * 0.25 + regularityRatio * 100 * 0.2);

  const horizonScores: HorizonScores = { court, moyen, long };
  // Poids technique final cahier : 0.40 court + 0.35 moyen + 0.25 long
  const technicalScore = clamp100(0.4 * court + 0.35 * moyen + 0.25 * long);

  // ── Fondamental (yield + régularité + PER) → 0–100 ───────────────────────
  const yieldCap = confidence === "Faible" ? 12 : 25;
  const yieldForScore = Math.min(yieldValue, 12);
  const yieldPts = Math.min(yieldCap, yieldForScore * 3);
  const regPts = regularityRatio * 20;
  let perPts = 0;
  if (!(per > 0) || per > 80) perPts = 0;
  else if (per < 8) perPts = 15;
  else if (per < 12) perPts = 10;
  else if (per < 18) perPts = 6;
  else if (per <= 40) perPts = 3;
  else perPts = 1;
  const fundamentalRaw = yieldPts + regPts + perPts;
  const fundamentalScore = clamp100((fundamentalRaw / 60) * 100);

  // Score sectoriel (cahier 5 %) — inverse du risque opérationnel sectoriel
  const sectorOp = riskAnalysis.pillars.find((p) => p.key === "operationnel")?.score;
  const sectorScore =
    sectorOp != null ? clamp100(100 - sectorOp) : clamp100(50 + (historyDepth >= 8 ? 10 : 0));

  // Composite v2 : 0.30 tech + 0.30 fond + 0.20 (100-risk) + 0.05 secteur
  // + 0.15 sentiment non disponible → redistribué (moitié tech, moitié fond)
  // → effectif : 0.375 tech + 0.375 fond + 0.20 riskAdj + 0.05 sector
  const riskAdj = 100 - riskAnalysis.riskScore;
  const compositeScore = clamp100(
    0.375 * technicalScore + 0.375 * fundamentalScore + 0.2 * riskAdj + 0.05 * sectorScore
  );
  const score = compositeScore;

  // Raisons — performance
  if (perf5Percent !== "N/D") {
    const v = parseFloat(perf5Percent);
    if (v >= 40) {
      reasons.push({
        kind: "positif",
        text: `Forte performance sur 5 ans (+${formatFrNumber(v)} %), moteur principal du score.`,
      });
    } else if (v >= 10) {
      reasons.push({ kind: "positif", text: `Performance 5 ans positive (+${formatFrNumber(v)} %).` });
    } else if (v >= 0) {
      reasons.push({ kind: "neutre", text: `Performance 5 ans faible (+${formatFrNumber(v)} %).` });
    } else {
      reasons.push({ kind: "negatif", text: `Performance 5 ans négative (${formatFrNumber(v)} %).` });
    }
  } else if (availableSpanPerf !== null) {
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
    reasons.push({ kind: "negatif", text: "Aucun dividende courant détecté (rendement 0 %)." });
  }

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

  if (!(per > 0) || per > 80) {
    reasons.push({
      kind: "negatif",
      text:
        !(per > 0)
          ? "PER indisponible ou non significatif — valorisation non notée."
          : `PER extrême (${formatFrNumber(per, 2)}) : valorisation peu lisible / potentiellement déformée.`,
    });
  } else if (per < 8) {
    reasons.push({ kind: "positif", text: `PER bas (${formatFrNumber(per, 2)}) : valorisation attractive.` });
  } else if (per < 12) {
    reasons.push({ kind: "positif", text: `PER raisonnable (${formatFrNumber(per, 2)}).` });
  } else if (per < 18) {
    reasons.push({ kind: "neutre", text: `PER dans la moyenne (${formatFrNumber(per, 2)}).` });
  } else if (per <= 40) {
    reasons.push({
      kind: "negatif",
      text: `PER élevé (${formatFrNumber(per, 2)}) : titre cher par rapport aux bénéfices.`,
    });
  } else {
    reasons.push({ kind: "negatif", text: `PER très élevé (${formatFrNumber(per, 2)}).` });
  }

  if (riskLevel === "Faible") {
    reasons.push({
      kind: "positif",
      text: `Volatilité maîtrisée (${volatilityPercent} %) → risque faible.`,
    });
  } else if (riskLevel === "Moyen") {
    reasons.push({
      kind: "neutre",
      text: `Volatilité modérée (${volatilityPercent} %) → risque moyen.`,
    });
  } else if (riskLevel === "Élevé") {
    reasons.push({
      kind: "negatif",
      text: `Volatilité élevée (${volatilityPercent} %) → risque élevé.`,
    });
  } else {
    reasons.push({
      kind: "neutre",
      text: "Risque non évaluable (historique trop court pour mesurer la volatilité).",
    });
  }

  reasons.push({
    kind:
      riskAnalysis.riskScore < 40 ? "positif" : riskAnalysis.riskScore > 65 ? "negatif" : "neutre",
    text: `Gestion du risque : ${riskAnalysis.riskTier} (${riskAnalysis.riskScore}/100).`,
  });
  reasons.push({
    kind: "neutre",
    text: `Horizons — court ${court}/100 · moyen ${moyen}/100 · long ${long}/100 (tech. ${technicalScore}, fond. ${fundamentalScore}).`,
  });

  let signal = signalFromComposite(compositeScore, riskAnalysis.riskScore);

  if (confidence === "Faible") {
    if (signal.label === "ACHAT FORT") signal = signalOf("ACHAT");
    else if (signal.label === "VENDRE") signal = signalOf("ALLÉGER");
    reasons.push({
      kind: "neutre",
      text: `Confiance ${confidence} (${historyDepth} année${historyDepth > 1 ? "s" : ""} de cours) : signal extrême modéré.`,
    });
  } else if (confidence === "Moyenne" && signal.label === "ACHAT FORT") {
    signal = signalOf("ACHAT");
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
    horizonScores,
    technicalScore,
    fundamentalScore,
    compositeScore,
    riskAnalysis,
    technical,
    sectorScore,
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
  const parts = [`Signal final : ${label} (score ${score}/100, confiance ${confidence}).`];
  if (topPositive) parts.push(topPositive.text);
  if (topNegative) parts.push(topNegative.text);
  if (!topPositive && !topNegative) {
    parts.push("Les indicateurs disponibles sont mitigés ou incomplets.");
  }
  return parts.join(" ");
}
