import type { SignalReason, TradeSignal } from "@/lib/calc/calc-metrics";
import type { SignalReasonCode } from "@/lib/calc/signal-reason-codes";
import type { RiskPillarKey, RiskTier } from "@/lib/calc/risk-analysis";
import type { FinancialHealth } from "@/lib/calc/financial-health";
import type { BuyHorizonCode, PortfolioAdviceAction } from "@/lib/calc/portfolio-advice";
import type { Locale } from "./config";
import { createFormat } from "./format";
import { interpolate } from "./translate";
import { SIGNAL_REASON_EN } from "./signal-reasons";

type Confidence = "Élevée" | "Moyenne" | "Faible";
type RiskLevel = "Faible" | "Moyen" | "Élevé" | "N/D";

const SECTOR_EN: Record<string, string> = {
  Télécoms: "Telecoms",
  Banques: "Banks",
  Divertissement: "Entertainment",
  "Conso. Base": "Consumer staples",
  "Conso. Discrétionnaire": "Consumer discretionary",
  "Services Publics": "Utilities",
  Énergie: "Energy",
  Industrie: "Industrials",
};

const COUNTRY_EN: Record<string, string> = {
  Bénin: "Benin",
  "Burkina Faso": "Burkina Faso",
  "Côte d'Ivoire": "Côte d'Ivoire",
  Mali: "Mali",
  Niger: "Niger",
  Sénégal: "Senegal",
  Togo: "Togo",
};

const SIGNAL_EN: Record<TradeSignal["label"], string> = {
  "ACHAT FORT": "STRONG BUY",
  ACHAT: "BUY",
  CONSERVER: "HOLD",
  ALLÉGER: "REDUCE",
  VENDRE: "SELL",
};

const CONFIDENCE_EN: Record<Confidence, string> = {
  Élevée: "High",
  Moyenne: "Medium",
  Faible: "Low",
};

const RISK_LEVEL_EN: Record<RiskLevel, string> = {
  Faible: "Low",
  Moyen: "Medium",
  Élevé: "High",
  "N/D": "N/D",
};

const RISK_TIER_EN: Record<RiskTier, string> = {
  "Très faible": "Very low",
  Faible: "Low",
  Modéré: "Moderate",
  Élevé: "High",
  "Très élevé": "Very high",
};

const HEALTH_EN: Record<FinancialHealth["label"], string> = {
  Solide: "Sound",
  Correcte: "Fair",
  Fragile: "Weak",
  "N/D": "N/D",
};

const HEALTH_PILLAR_EN = {
  rentabilite: "Profitability",
  croissance: "Growth",
  solvabilite: "Solvency",
  liquidite: "Liquidity",
} as const;

const RISK_PILLAR_EN: Record<RiskPillarKey, string> = {
  marche: "Market risk",
  liquidite: "Liquidity risk",
  fondamental: "Fundamental risk",
  operationnel: "Operational risk",
};

const ADVICE_EN: Record<PortfolioAdviceAction, string> = {
  RENFORCER: "Increase",
  CONSERVER: "Hold",
  SORTIR: "Exit / Reduce",
};

const HORIZON_EN: Record<BuyHorizonCode, { short: string; full: string }> = {
  COURT: { short: "Short", full: "Short term" },
  MOYEN: { short: "Medium", full: "Medium term" },
  LONG: { short: "Long", full: "Long term" },
};

const HORIZON_FR: Record<BuyHorizonCode, { short: string; full: string }> = {
  COURT: { short: "Court", full: "Court terme" },
  MOYEN: { short: "Moyen", full: "Moyen terme" },
  LONG: { short: "Long", full: "Long terme" },
};

export function displaySignal(label: TradeSignal["label"] | "N/D" | null | undefined, locale: Locale): string {
  if (!label || label === "N/D") return "N/D";
  return locale === "en" ? SIGNAL_EN[label] : label;
}

export function displayConfidence(value: Confidence | string | null | undefined, locale: Locale): string {
  if (!value) return "N/D";
  if (locale !== "en") return value;
  return CONFIDENCE_EN[value as Confidence] ?? value;
}

export function displayRiskLevel(value: RiskLevel | string | null | undefined, locale: Locale): string {
  if (!value) return "N/D";
  if (locale !== "en") return value;
  return RISK_LEVEL_EN[value as RiskLevel] ?? value;
}

export function displayRiskTier(value: RiskTier | string | null | undefined, locale: Locale): string {
  if (!value) return "N/D";
  if (locale !== "en") return value;
  return RISK_TIER_EN[value as RiskTier] ?? value;
}

export function displayHealth(value: FinancialHealth["label"] | string | null | undefined, locale: Locale): string {
  if (!value) return "N/D";
  if (locale !== "en") return value;
  return HEALTH_EN[value as FinancialHealth["label"]] ?? value;
}

export function displayHealthPillar(
  key: keyof typeof HEALTH_PILLAR_EN,
  fallback: string,
  locale: Locale
): string {
  return locale === "en" ? HEALTH_PILLAR_EN[key] : fallback;
}

export function displayRiskPillar(key: RiskPillarKey, fallback: string, locale: Locale): string {
  return locale === "en" ? RISK_PILLAR_EN[key] : fallback;
}

export function displayAdvice(action: PortfolioAdviceAction, fallback: string, locale: Locale): string {
  return locale === "en" ? ADVICE_EN[action] : fallback;
}

export function displayHorizon(code: BuyHorizonCode, locale: Locale, variant: "short" | "full" = "full"): string {
  return (locale === "en" ? HORIZON_EN : HORIZON_FR)[code][variant];
}

export function displaySector(sector: string | null | undefined, locale: Locale): string {
  if (!sector) return "N/D";
  if (locale !== "en") return sector;
  return SECTOR_EN[sector] ?? sector;
}

export function displayCountry(country: string | null | undefined, locale: Locale): string {
  if (!country) return "N/D";
  if (locale !== "en") return country;
  return COUNTRY_EN[country] ?? country;
}

export function displayTechnicalNote(note: string, locale: Locale): string {
  if (locale !== "en") return note;
  const rsi = note.match(/^RSI\(14\)=([0-9.]+)(?: \((.+)\))?\.$/);
  if (rsi) {
    const zone = rsi[2];
    const zoneEn =
      zone === "zone de survente"
        ? "oversold"
        : zone === "zone de surachat"
          ? "overbought"
          : zone === "zone neutre favorable"
            ? "constructive neutral zone"
            : null;
    return zoneEn ? `RSI(14)=${rsi[1]} (${zoneEn}).` : `RSI(14)=${rsi[1]}.`;
  }
  if (note === "MACD histogramme positif.") return "MACD histogram is positive.";
  if (note === "MACD histogramme négatif.") return "MACD histogram is negative.";
  if (note === "Golden cross détecté (SMA rapide > SMA lente).") {
    return "Golden cross detected (fast SMA > slow SMA).";
  }
  if (note === "Death cross détecté (SMA rapide < SMA lente).") {
    return "Death cross detected (fast SMA < slow SMA).";
  }
  return note;
}

const SIGNED_1 = new Set(["value", "span"]);
const NUM_2 = new Set(["yield", "per"]);
const INT_KEYS = new Set(["years", "count", "window", "court", "moyen", "long", "tech", "fund", "score"]);

export function displayReason(reason: SignalReason, locale: Locale): string {
  if (locale !== "en" || !reason.code) return reason.text;
  const template = SIGNAL_REASON_EN[reason.code as SignalReasonCode];
  if (!template) return reason.text;
  const format = createFormat(locale);
  const formatted: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(reason.params ?? {})) {
    if (key === "confidence" && typeof value === "string") formatted[key] = displayConfidence(value, locale);
    else if (key === "tier" && typeof value === "string") formatted[key] = displayRiskTier(value, locale);
    else if (key === "note" && typeof value === "string") formatted[key] = displayTechnicalNote(value, locale);
    else if (typeof value === "number" && SIGNED_1.has(key)) formatted[key] = format.signed(value, 1);
    else if (typeof value === "number" && NUM_2.has(key)) formatted[key] = format.decimal(value, 2);
    else if (typeof value === "number" && INT_KEYS.has(key)) formatted[key] = format.integer(value);
    else formatted[key] = value;
  }
  const years = reason.params?.years;
  if (typeof years === "number") formatted.yearsWord = years > 1 ? "years" : "year";
  return interpolate(template, formatted);
}

export function displaySignalSummary(
  input: {
    label: TradeSignal["label"];
    score: number;
    confidence: Confidence;
    signalSummary: string;
    signalReasons: SignalReason[];
  },
  locale: Locale
): string {
  if (locale !== "en") return input.signalSummary;
  const label = displaySignal(input.label, locale);
  const confidence = displayConfidence(input.confidence, locale).toLowerCase();
  const parts = [`Final signal: ${label} (score ${input.score}/100, ${confidence} confidence).`];
  const topPositive = input.signalReasons.find((r) => r.kind === "positif");
  const topNegative = input.signalReasons.find((r) => r.kind === "negatif");
  if (topPositive) parts.push(displayReason(topPositive, locale));
  if (topNegative) parts.push(displayReason(topNegative, locale));
  if (!topPositive && !topNegative) parts.push("Available indicators are mixed or incomplete.");
  return parts.join(" ");
}

export function displayRiskNote(note: string, locale: Locale): string {
  if (locale !== "en") return note;
  const exact: Record<string, string> = {
    "Risque de marché N/D (historique insuffisant pour volatilité / drawdown / VaR).":
      "Market risk N/D (history too short for volatility / drawdown / VaR).",
    "Liquidité N/D (capitalisation / volumes non disponibles).":
      "Liquidity N/D (market cap / volumes unavailable).",
    "Risque opérationnel N/D (secteur non renseigné).": "Operational risk N/D (sector not provided).",
  };
  if (exact[note]) return exact[note];
  return note
    .replace(/^Marché : /, "Market: ")
    .replace(/^Liquidité : /, "Liquidity: ")
    .replace(/^Fondamental : /, "Fundamentals: ")
    .replace(
      /^Opérationnel : cyclicity proxy secteur « (.+) »\.$/,
      "Operational: sector cyclicality proxy for “$1”."
    )
    .replace(
      /^Opérationnel : secteur « (.+) » sans profil cyclique dédié \(neutre\)\.$/,
      "Operational: sector “$1” has no dedicated cyclicality profile (neutral)."
    )
    .replaceAll("volatilité annuelle", "annual volatility")
    .replaceAll("drawdown max", "max drawdown")
    .replaceAll("volume moy.", "avg. volume")
    .replaceAll("dividendes", "dividends")
    .replaceAll("historique court", "short history")
    .replaceAll("PER extrême", "extreme P/E")
    .replaceAll("PER N/D", "P/E N/D")
    .replaceAll(" ans", " yrs")
    .replace(/cap\. (\d[\d\s\u00a0]*) Md/g, "mkt cap $1 bn")
    .replace(/(\d),(\d)/g, "$1.$2");
}

export function displayFinancialHealthNote(
  health: Pick<FinancialHealth, "note" | "pillars">,
  metrics: { score: number; confidence: Confidence },
  locale: Locale
): string {
  if (locale !== "en") return health.note;
  const confidence = displayConfidence(metrics.confidence, locale).toLowerCase();
  return `Average of ${health.pillars.length} pillars, calibrated on available BRVM data (score ${metrics.score}/100, ${confidence} confidence).`;
}

export function createLabels(locale: Locale) {
  return {
    signal: (label: TradeSignal["label"] | "N/D" | null | undefined) => displaySignal(label, locale),
    confidence: (value: Confidence | string | null | undefined) => displayConfidence(value, locale),
    riskLevel: (value: RiskLevel | string | null | undefined) => displayRiskLevel(value, locale),
    riskTier: (value: RiskTier | string | null | undefined) => displayRiskTier(value, locale),
    health: (value: FinancialHealth["label"] | string | null | undefined) => displayHealth(value, locale),
    healthPillar: (key: keyof typeof HEALTH_PILLAR_EN, fallback: string) =>
      displayHealthPillar(key, fallback, locale),
    riskPillar: (key: RiskPillarKey, fallback: string) => displayRiskPillar(key, fallback, locale),
    advice: (action: PortfolioAdviceAction, fallback: string) => displayAdvice(action, fallback, locale),
    horizon: (code: BuyHorizonCode, variant: "short" | "full" = "full") => displayHorizon(code, locale, variant),
    sector: (sector: string | null | undefined) => displaySector(sector, locale),
    country: (country: string | null | undefined) => displayCountry(country, locale),
    reason: (reason: SignalReason) => displayReason(reason, locale),
    signalSummary: (input: Parameters<typeof displaySignalSummary>[0]) => displaySignalSummary(input, locale),
    riskNote: (note: string) => displayRiskNote(note, locale),
    technicalNote: (note: string) => displayTechnicalNote(note, locale),
    healthNote: (health: Pick<FinancialHealth, "note" | "pillars">, metrics: { score: number; confidence: Confidence }) =>
      displayFinancialHealthNote(health, metrics, locale),
  };
}

export type LabelsApi = ReturnType<typeof createLabels>;
