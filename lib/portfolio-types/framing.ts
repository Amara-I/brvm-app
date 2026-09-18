import type { CalcMetricsResult } from "@/lib/calc/calc-metrics";
import { PORTFOLIO_TYPE_DEFS, type PortfolioTypeCta, type PortfolioTypeDef } from "./catalog";
import type { PortfolioTypeId } from "./constants";

export type PerspectiveMetricTone = "good" | "warn" | "bad" | "neutral";

export interface PerspectiveMetric {
  key: string;
  label: string;
  value: string;
  hint: string;
  tone: PerspectiveMetricTone;
}

export interface AnalysisPerspective {
  type: PortfolioTypeId;
  def: PortfolioTypeDef;
  headline: string;
  summary: string;
  metrics: PerspectiveMetric[];
  checklist: string[];
  warnings: string[];
  filterHints: string[];
  ctas: PortfolioTypeCta[];
  pocketHint: string | null;
  educationHref: string;
  disclaimer: string;
}

function nd(value: string | number | null | undefined, suffix = ""): string {
  if (value == null || value === "" || value === "N/D") return "N/D";
  return `${value}${suffix}`;
}

function numOrNd(raw: string | number): number | null {
  if (raw === "N/D" || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toneFromSigned(n: number | null, invert = false): PerspectiveMetricTone {
  if (n == null) return "neutral";
  const v = invert ? -n : n;
  if (v > 0) return "good";
  if (v < 0) return "bad";
  return "neutral";
}

function riskTone(level: CalcMetricsResult["riskLevel"]): PerspectiveMetricTone {
  if (level === "Faible") return "good";
  if (level === "Moyen") return "warn";
  if (level === "Élevé") return "bad";
  return "neutral";
}

function confidenceTone(c: CalcMetricsResult["confidence"]): PerspectiveMetricTone {
  if (c === "Élevée") return "good";
  if (c === "Moyenne") return "warn";
  return "neutral";
}

function liquidityScore(metrics: CalcMetricsResult): number | null {
  const p = metrics.riskAnalysis.pillars.find((x) => x.key === "liquidite");
  return p?.score ?? null;
}

function suggestPocket(metrics: CalcMetricsResult): string {
  const yieldN = numOrNd(metrics.dividendYieldPercent);
  const fund = metrics.fundamentalScore;
  const tech = metrics.technicalScore;
  const liq = liquidityScore(metrics);
  const parts: string[] = [];

  if (fund >= 60) {
    parts.push("lecture croissance / fondamentaux (score fondamental disponible)");
  }
  if (yieldN != null && yieldN >= 4) {
    parts.push("lecture rente (rendement du dividende affiché — à vérifier en qualité, pas seulement en niveau)");
  }
  if (tech >= 60 && (liq == null || liq < 70)) {
    parts.push("lecture trading possible seulement si la liquidité le permet (pilier liquidité ci-contre)");
  } else if (liq != null && liq >= 70) {
    parts.push("liquidité défavorable pour une poche trading (pilier élevé = plus de risque de liquidité)");
  }

  if (parts.length === 0) {
    return "Aucune poche n’est « assignée » automatiquement : classez le titre vous-même (croissance, rente ou trading) d’après les données disponibles, ou N/D.";
  }
  return `Pistes de poche (présentation, pas une affectation) : ${parts.join(" ; ")}.`;
}

function buildMetrics(type: PortfolioTypeId, metrics: CalcMetricsResult): PerspectiveMetric[] {
  const liq = liquidityScore(metrics);
  const catalog: Record<string, PerspectiveMetric> = {
    perf5: {
      key: "perf5",
      label: "Perf. 5 ans",
      value: metrics.perf5Percent === "N/D" ? "N/D" : `${metrics.perf5Percent}%`,
      hint: "Trajectoire de cours — pas une preuve de croissance des bénéfices.",
      tone: toneFromSigned(numOrNd(metrics.perf5Percent)),
    },
    perf10: {
      key: "perf10",
      label: "Perf. long terme",
      value: metrics.perf10Percent === "N/D" ? "N/D" : `${metrics.perf10Percent}%`,
      hint: "Historique long s’il existe ; sinon N/D.",
      tone: toneFromSigned(numOrNd(metrics.perf10Percent)),
    },
    yield: {
      key: "yield",
      label: "Rendement dividende",
      value: nd(metrics.dividendYieldPercent, "%"),
      hint: "Niveau actuel, pas la qualité ni la récurrence du dividende.",
      tone: metrics.dividendYieldPercent === "N/D" || metrics.dividendYieldPercent === "" ? "neutral" : "good",
    },
    risk: {
      key: "risk",
      label: "Risque (volatilité)",
      value: metrics.riskLevel,
      hint: `Score gestion du risque ${metrics.riskAnalysis.riskScore}/100 · ${metrics.riskAnalysis.riskTier}.`,
      tone: riskTone(metrics.riskLevel),
    },
    confidence: {
      key: "confidence",
      label: "Confiance du signal",
      value: metrics.confidence,
      hint: "Profondeur des données — un signal extrême est moins fiable si la confiance est faible.",
      tone: confidenceTone(metrics.confidence),
    },
    fundamental: {
      key: "fundamental",
      label: "Score fondamental",
      value: `${metrics.fundamentalScore}/100`,
      hint: "Dividendes, PER et régularité mesurés sur la base — pas un audit des comptes.",
      tone: metrics.fundamentalScore >= 60 ? "good" : metrics.fundamentalScore >= 45 ? "warn" : "neutral",
    },
    technical: {
      key: "technical",
      label: "Score technique",
      value: `${metrics.technicalScore}/100`,
      hint: "Utile en trading si la série est assez dense ; sinon N/D sur RSI/MACD.",
      tone: metrics.technical.available ? (metrics.technicalScore >= 60 ? "good" : "warn") : "neutral",
    },
    liquidity: {
      key: "liquidity",
      label: "Risque de liquidité",
      value: liq == null ? "N/D" : `${liq}/100`,
      hint: "Pilier du score de risque : un score élevé = liquidité plus tendue. Consulter aussi le BRVM-30 / la cote.",
      tone: liq == null ? "neutral" : liq < 40 ? "good" : liq > 65 ? "bad" : "warn",
    },
    longHorizon: {
      key: "longHorizon",
      label: "Score long terme",
      value: `${metrics.horizonScores.long}/100`,
      hint: "Lecture multi-horizons déjà calculée — cadrage croissance.",
      tone: metrics.horizonScores.long >= 60 ? "good" : "neutral",
    },
    shortHorizon: {
      key: "shortHorizon",
      label: "Score court terme",
      value: `${metrics.horizonScores.court}/100`,
      hint: "Lecture court terme — ne remplace pas un plan d’entrée / invalidation.",
      tone: metrics.horizonScores.court >= 60 ? "good" : "neutral",
    },
  };

  return PORTFOLIO_TYPE_DEFS[type].emphasisKeys.map((k) => catalog[k]!);
}

function summaryFor(
  type: PortfolioTypeId,
  name: string,
  ticker: string,
  metrics: CalcMetricsResult
): string {
  const signal = metrics.signal.label;
  const common = `${name} (${ticker}) — signal plateforme ${signal} (inchangé). `;
  switch (type) {
    case "CROISSANCE":
      return (
        common +
        "Sous l’angle Croissance, on lit d’abord la progression des fondamentaux et la valorisation, pas la seule hausse du cours. " +
        `Score fondamental ${metrics.fundamentalScore}/100 · long terme ${metrics.horizonScores.long}/100 · confiance ${metrics.confidence}.`
      );
    case "RENTE":
      return (
        common +
        "Sous l’angle Rente, le rendement du dividende se lit avec sa régularité et le risque de capital, pas comme un « taux garanti ». " +
        `Rendement affiché ${nd(metrics.dividendYieldPercent, "%")} · risque ${metrics.riskLevel}.`
      );
    case "TRADING":
      return (
        common +
        "Sous l’angle Trading, priorité à la liquidité, à la taille de position et aux règles écrites. " +
        `Risque ${metrics.riskLevel} · technique ${metrics.technicalScore}/100 · liquidité ${nd(liquidityScore(metrics), "/100")}.`
      );
    case "CROISSANCE_MAX":
      return (
        common +
        "Sous l’angle Croissance Max, le titre n’entre dans une poche que si vous lui assignez un rôle (croissance, rente ou trading) avec des règles distinctes. " +
        suggestPocket(metrics)
      );
  }
}

export function frameCompanyForPortfolioType(input: {
  type: PortfolioTypeId;
  ticker: string;
  name: string;
  metrics: CalcMetricsResult;
}): AnalysisPerspective {
  const def = PORTFOLIO_TYPE_DEFS[input.type];
  const ticker = input.ticker.toUpperCase();
  const ctas: PortfolioTypeCta[] = [
    ...def.ctas,
    {
      href: `/outils/taille-position?ticker=${encodeURIComponent(ticker)}`,
      label: "Taille de position",
    },
  ];
  // Éviter un doublon si le type Trading a déjà la calculette sans ticker.
  const seen = new Set<string>();
  const deduped = ctas.filter((c) => {
    const key = c.label;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    type: input.type,
    def,
    headline: `${def.label} — lecture de ${input.name}`,
    summary: summaryFor(input.type, input.name, ticker, input.metrics),
    metrics: buildMetrics(input.type, input.metrics),
    checklist: def.checklist,
    warnings: def.warnings,
    filterHints: def.filterHints,
    ctas: deduped,
    pocketHint: input.type === "CROISSANCE_MAX" ? suggestPocket(input.metrics) : null,
    educationHref: def.educationHref,
    disclaimer:
      "Cadrage pédagogique selon le type de portefeuille. Les cours, ratios et signaux ne sont pas recalculés. Donnée manquante = N/D. Ce n’est pas un conseil d’investissement.",
  };
}

export type ScorecardCell = {
  k: string;
  v: string;
  tone: PerspectiveMetricTone;
};

export function overviewScorecardForType(
  type: PortfolioTypeId,
  metrics: CalcMetricsResult
): ScorecardCell[] {
  const perfN = numOrNd(metrics.perf5Percent);
  const perf5: ScorecardCell = {
    k: "Perf. 5 ans",
    v: metrics.perf5Percent === "N/D" ? "N/D" : `${(perfN ?? 0) > 0 ? "+" : ""}${metrics.perf5Percent}%`,
    tone: toneFromSigned(perfN),
  };
  const yieldCell: ScorecardCell = {
    k: "Rend. div.",
    v:
      metrics.dividendYieldPercent === "N/D" || metrics.dividendYieldPercent === ""
        ? "N/D"
        : `${metrics.dividendYieldPercent}%`,
    tone:
      metrics.dividendYieldPercent === "N/D" || metrics.dividendYieldPercent === "" ? "neutral" : "good",
  };
  const risk: ScorecardCell = {
    k: "Risque",
    v: metrics.riskLevel,
    tone: riskTone(metrics.riskLevel),
  };
  const conf: ScorecardCell = {
    k: "Confiance",
    v: metrics.confidence,
    tone: confidenceTone(metrics.confidence),
  };
  const vol: ScorecardCell = {
    k: "Volatilité",
    v: metrics.volatilityPercent === "N/D" ? "N/D" : `${metrics.volatilityPercent}%`,
    tone: "neutral",
  };
  const fund: ScorecardCell = {
    k: "Fondamental",
    v: `${metrics.fundamentalScore}/100`,
    tone: metrics.fundamentalScore >= 60 ? "good" : metrics.fundamentalScore >= 45 ? "warn" : "neutral",
  };
  const tech: ScorecardCell = {
    k: "Technique",
    v: `${metrics.technicalScore}/100`,
    tone: metrics.technical.available ? (metrics.technicalScore >= 60 ? "good" : "warn") : "neutral",
  };

  switch (type) {
    case "CROISSANCE":
      return [perf5, fund, conf, risk];
    case "RENTE":
      return [yieldCell, risk, conf, perf5];
    case "TRADING":
      return [risk, tech, vol, conf];
    case "CROISSANCE_MAX":
      return [perf5, yieldCell, risk, conf];
  }
}

export function keyTermSlugsForType(type: PortfolioTypeId): readonly string[] {
  switch (type) {
    case "CROISSANCE":
      return [
        "chiffre-d-affaires",
        "per-price-earnings-ratio",
        "score-fondamental",
        "horizons-c-m-l",
        "portefeuille-croissance",
      ];
    case "RENTE":
      return [
        "rendement-du-dividende",
        "dividende",
        "confiance-du-signal",
        "portefeuille-rente",
        "sante-financiere",
      ];
    case "TRADING":
      return [
        "taille-de-position",
        "liquidite",
        "rsi",
        "gestion-du-risque",
        "portefeuille-trading",
      ];
    case "CROISSANCE_MAX":
      return [
        "types-de-portefeuille",
        "portefeuille-croissance",
        "portefeuille-rente",
        "portefeuille-trading",
        "portefeuille-croissance-max",
      ];
  }
}
