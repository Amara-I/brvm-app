import type { Locale } from "@/lib/i18n/config";
import type { TFunc } from "@/lib/i18n/create-i18n";
import type { FormatApi } from "@/lib/i18n/format";
import type { LabelsApi } from "@/lib/i18n/labels";
import type { TradeSignal } from "@/lib/calc/calc-metrics";
import { formatMeasureLabel } from "@/lib/charts/chart-drawings-storage";
import type { TechnicalSnapshot } from "@/lib/charts/technical-indicators";
import {
  formatWindowChangeAbs,
  formatWindowChangePercent,
} from "@/lib/charts/window-change";

const SIGNAL_LABELS: ReadonlySet<string> = new Set([
  "ACHAT FORT",
  "ACHAT",
  "CONSERVER",
  "ALLÉGER",
  "VENDRE",
]);

const API_ERRORS = {
  "Série indisponible — N/D": "charts.errors.seriesUnavailable",
  "Paramètres invalides": "charts.errors.invalidParams",
  "Authentification requise": "charts.errors.authRequired",
  "Session invalide — reconnectez-vous.": "charts.errors.sessionInvalid",
  "Enregistrement impossible.": "charts.errors.saveFailed",
  "Suppression impossible.": "charts.errors.deleteFailed",
  "Création impossible.": "charts.errors.createFailed",
  "Réactivation impossible.": "charts.errors.reactivateFailed",
  "Impossible de charger les alertes.": "charts.errors.loadAlerts",
  "Impossible de charger les analyses.": "charts.errors.loadAnalyses",
  "Analyse introuvable": "charts.errors.analysisMissing",
  "Règle introuvable": "charts.errors.ruleMissing",
  "Alerte introuvable": "charts.errors.alertMissing",
  "Indice non suivi": "charts.errors.indexUntracked",
  "Base de données indisponible": "charts.errors.dbUnavailable",
  "Indiquez un seuil de cours positif.": "charts.errors.positiveThreshold",
  "Indiquez un nom pour l'analyse.": "charts.errors.analysisNameRequired",
} as const;

const INTERVAL_NOTES = {
  "Aucune donnée (N/D).": "charts.interval.noData",
  "Bougies horaires N/D — historique disponible en journalier uniquement.": "charts.interval.hourlyNd",
  "Agrégation hebdomadaire (O=ouverture semaine, C=clôture).": "charts.interval.weekly",
  "Agrégation mensuelle (O=ouverture mois, C=clôture).": "charts.interval.monthly",
} as const;

export function localizeApiMessage(message: string, t: TFunc): string {
  const exact = API_ERRORS[message as keyof typeof API_ERRORS];
  if (exact) return t(exact);
  const ticker = message.match(/^Ticker inconnu : (.+)$/);
  if (ticker?.[1]) return t("charts.errors.unknownTicker", { ticker: ticker[1] });
  const company = message.match(/^Société "(.+)" introuvable$/);
  if (company?.[1]) return t("charts.errors.companyMissing", { ticker: company[1] });
  return message;
}

export function localizeIntervalNote(note: string | null, t: TFunc): string | null {
  if (!note) return null;
  const key = INTERVAL_NOTES[note as keyof typeof INTERVAL_NOTES];
  return key ? t(key) : note;
}

/** Grouped number with a leading + for zero and gains. Replaces toLocaleString. */
export function signedGrouped(n: number, format: FormatApi): string {
  if (!Number.isFinite(n)) return "N/D";
  return n >= 0 ? `+${format.number(n)}` : format.number(n);
}

/** OHLC change: French keeps the historical `+1.23%` (dot, no space). */
export function legendPercent(chg: number, locale: Locale, format: FormatApi): string {
  if (!Number.isFinite(chg)) return "N/D";
  if (locale === "fr") return `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`;
  return format.percent(chg, 2, true);
}

/** Day-change percent that was interpolated raw (`+1.61%` in French). */
export function loosePercent(n: number, locale: Locale, format: FormatApi): string {
  if (!Number.isFinite(n)) return "N/D";
  if (locale === "fr") return `${n >= 0 ? "+" : ""}${n}%`;
  const digits = (String(Math.abs(n)).split(".")[1] ?? "").length;
  return format.percent(n, digits, true);
}

export function legendVolume(vol: number | null | undefined, format: FormatApi): string {
  return vol && vol > 0 ? ` Vol ${format.number(vol)}` : " Vol N/D";
}

export function ohlcLegend(
  open: number,
  high: number,
  low: number,
  close: number,
  chg: number,
  vol: number | null | undefined,
  locale: Locale,
  format: FormatApi
): string {
  return `O ${format.integer(open)} H ${format.integer(high)} L ${format.integer(low)} C ${format.integer(close)} ${legendPercent(chg, locale, format)}${legendVolume(vol, format)}`;
}

export function windowChangePercent(
  value: number | null | undefined,
  locale: Locale,
  format: FormatApi
): string {
  if (locale === "fr") return formatWindowChangePercent(value);
  if (value == null || !Number.isFinite(value)) return "N/D";
  return format.percent(value, 2, true);
}

export function windowChangeAbs(
  value: number | null | undefined,
  locale: Locale,
  format: FormatApi
): string {
  if (locale === "fr") return formatWindowChangeAbs(value);
  if (value == null || !Number.isFinite(value)) return "N/D";
  const rounded = Math.round(value);
  const body = rounded > 0 ? `+${format.integer(rounded)}` : format.integer(rounded);
  return `${body} FCFA`;
}

export function measureText(p1: number, p2: number, locale: Locale, format: FormatApi): string {
  const base = formatMeasureLabel(p1, p2);
  if (locale === "fr") return base.text;
  const arrow = base.up ? "↑" : "↓";
  const abs = Math.round(p2 - p1);
  return `${arrow} ${format.percent(base.pct, 2, true)} (${format.signed(abs, 0)})`;
}

export function yieldLabel(value: number, locale: Locale, format: FormatApi): string {
  if (locale === "fr") return `${format.decimal(value, 1)}%`;
  return format.percent(value, 1);
}

const SAVED_AT_FULL: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

const SAVED_AT_SHORT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
};

export function formatSavedAt(input: string, format: FormatApi, withYear: boolean): string {
  return format.date(input, withYear ? SAVED_AT_FULL : SAVED_AT_SHORT);
}

function commaDecimal(value: number, locale: Locale): string {
  const raw = String(value);
  return locale === "fr" ? raw.replace(".", ",") : raw;
}

export function chartTechnicalLines(
  input: { technicalScore: number; technical: TechnicalSnapshot },
  locale: Locale,
  format: FormatApi,
  labels: LabelsApi,
  t: TFunc
): string[] {
  const tech = input.technical;
  if (!tech.available) {
    return [
      t("charts.recap.techUnavailable"),
      t("charts.recap.techScoreFallback", { score: input.technicalScore }),
    ];
  }
  const lines: string[] = [];
  const scoreLine = t("charts.recap.techScore", { score: input.technicalScore });
  lines.push(
    tech.shortTermScore != null
      ? `${scoreLine}${t("charts.recap.techShortSuffix", { short: tech.shortTermScore })}`
      : scoreLine
  );
  lines.push(
    t("charts.recap.rsiMacd", {
      rsi: tech.rsi14 != null ? commaDecimal(tech.rsi14, locale) : "N/D",
      macd: tech.macd ? commaDecimal(tech.macd.histogram, locale) : "N/D",
    })
  );
  const cross =
    tech.maCross === "golden_cross"
      ? t("charts.recap.cross.golden")
      : tech.maCross === "death_cross"
        ? t("charts.recap.cross.death")
        : tech.maCross === "none"
          ? t("charts.recap.cross.none")
          : t("charts.recap.cross.nd");
  const sma = (value: number | null) => (value == null ? "N/D" : format.integer(value));
  lines.push(
    t("charts.recap.smaLine", {
      sma10: sma(tech.sma10),
      sma20: sma(tech.sma20),
      sma50: sma(tech.sma50),
      cross,
    })
  );
  for (const note of tech.notes.slice(0, 2)) {
    lines.push(labels.technicalNote(note));
  }
  return lines.slice(0, 5);
}

export function chartSignalSummary(
  analysis: {
    signalLabel: string;
    score: number;
    confidence: string;
    signalSummary: string;
  },
  locale: Locale,
  labels: LabelsApi,
  t: TFunc
): string {
  if (locale !== "en") return analysis.signalSummary;
  const label = SIGNAL_LABELS.has(analysis.signalLabel)
    ? labels.signal(analysis.signalLabel as TradeSignal["label"])
    : analysis.signalLabel;
  const confidence = labels.confidence(analysis.confidence).toLowerCase();
  const head = t("charts.recap.signalHead", {
    label,
    score: analysis.score,
    confidence,
  });
  const rest = analysis.signalSummary.replace(/^Signal final : .+? \(score \d+\/100, confiance .+?\)\.\s*/, "").trim();
  if (!rest) return head;
  if (rest === "Les indicateurs disponibles sont mitigés ou incomplets.") {
    return `${head} ${t("charts.recap.mixedIndicators")}`;
  }
  const parts = rest.split(/(?<=\.)\s+/).map((sentence) => {
    const withDot = sentence.endsWith(".") ? sentence : `${sentence}.`;
    const translated = labels.technicalNote(withDot);
    return translated;
  });
  return `${head} ${parts.join(" ")}`;
}

export function displaySignalLabel(label: string, labels: LabelsApi): string {
  if (!SIGNAL_LABELS.has(label)) return label;
  return labels.signal(label as TradeSignal["label"]);
}
