// Note NGX sur 100 — même échelle que le score BRVM (lib/calc/calc-metrics.ts), calcul propre à la NGX.
// Fonctions pures, testées (score.test.ts). La note est dérivée de la fiche à 8 sections :
//   croissance (section 2) · rentabilité (2) · valorisation + secteur (4, 5, 6) · dividendes (7)
//   + lecture technique du cours : tendance/momentum et risque/liquidité.
// Règles de prudence :
//   - une donnée absente ne vaut jamais 0 : le critère est écarté, le poids est redistribué, la couverture baisse ;
//   - comptes de plus de 2 ans (« n/s » depuis la PR #79) : tous les piliers fondamentaux sont écartés ;
//   - confiance de lecture « low » : critère écarté ; « medium » ou non enregistrée : pilier ramené vers 50 (×0,9) ;
//   - un titre sans fondamentaux n'a qu'une note technique, étiquetée « Technique seul ».
// Ce n'est pas un conseil en investissement.

import type { PortfolioTypeId } from "@/lib/portfolio-types/constants";
import { PORTFOLIO_TYPE_IDS } from "@/lib/portfolio-types/constants";
import type { NgxConfidence, NgxFinancialYear } from "./fundamentals";
import type { NgxSheetModel } from "./sheet-model";

/** Le score se calcule sur la fiche, avant d'y être ajouté. */
type ScoreInput = Omit<NgxSheetModel, "score">;

export const NGX_PILLAR_KEYS = ["growth", "quality", "valuation", "dividends", "momentum", "risk"] as const;
export type NgxPillarKey = (typeof NGX_PILLAR_KEYS)[number];
export const NGX_FUNDAMENTAL_PILLARS: readonly NgxPillarKey[] = ["growth", "quality", "valuation", "dividends"];
export const NGX_MARKET_PILLARS: readonly NgxPillarKey[] = ["momentum", "risk"];

/** Poids du score global et de chaque politique (somme = 1). */
export type PolicyKey = "OVERALL" | PortfolioTypeId;
export const NGX_SCORE_WEIGHTS: Record<PolicyKey, Record<NgxPillarKey, number>> = {
  OVERALL: { growth: 0.2, quality: 0.15, valuation: 0.2, dividends: 0.1, momentum: 0.2, risk: 0.15 },
  CROISSANCE: { growth: 0.3, quality: 0.2, valuation: 0.2, dividends: 0.05, momentum: 0.15, risk: 0.1 },
  RENTE: { growth: 0.05, quality: 0.2, valuation: 0.15, dividends: 0.4, momentum: 0.05, risk: 0.15 },
  TRADING: { growth: 0, quality: 0.05, valuation: 0.05, dividends: 0, momentum: 0.55, risk: 0.35 },
  CROISSANCE_MAX: { growth: 0.35, quality: 0.1, valuation: 0.1, dividends: 0, momentum: 0.3, risk: 0.15 },
};

/** Piliers sans lesquels la note de la politique n'est pas calculée (N/D). */
export const NGX_POLICY_REQUIRED: Record<PortfolioTypeId, readonly NgxPillarKey[]> = {
  CROISSANCE: ["growth"],
  RENTE: ["dividends"],
  TRADING: ["momentum"],
  CROISSANCE_MAX: ["growth", "momentum"],
};

/** Couverture minimale (part des poids disponibles) pour publier une note. 0,35 = technique seul. */
export const MIN_COVERAGE = 0.35;
/** Part minimale des poids d'un pilier qu'il faut pouvoir mesurer. */
const MIN_PILLAR_WEIGHT_SHARE = 0.4;
/** Facteur de prudence d'un pilier fondé sur des chiffres non confirmés (confiance « medium » ou non enregistrée). */
export const UNCONFIRMED_FACTOR = 0.9;
export const HIGH_SCORE_THRESHOLD = 65;

export type NgxScoreMode = "FULL" | "PARTIAL" | "CHART_ONLY" | "NONE";
export type NgxScoreConfidence = "HIGH" | "MEDIUM" | "LOW";
export type NgxScoreBand = "HIGH" | "GOOD" | "MIXED" | "LOW";
export type NgxComponentConfidence = "high" | "medium" | "market";

export interface NgxScoreComponent {
  key: string;
  /** Valeur mesurée (unité propre au critère) ; null si le critère est une règle (ex. résultat négatif). */
  value: number | null;
  /** Points 0–100 du critère. */
  points: number;
  weight: number;
  confidence: NgxComponentConfidence;
}

export interface NgxPillar {
  key: NgxPillarKey;
  /** 0–100 ; null = non évalué faute de données fiables. */
  score: number | null;
  /** Part du pilier fondée sur des chiffres confirmés (1 = tout confirmé / marché). */
  reliability: number | null;
  components: NgxScoreComponent[];
}

export interface NgxPolicyScore {
  type: PolicyKey;
  /** null = N/D (pilier requis absent ou couverture insuffisante). */
  score: number | null;
  /** Part des poids de la politique réellement disponibles (0–1). */
  coverage: number;
  missing: NgxPillarKey[];
}

export interface NgxScore {
  mode: NgxScoreMode;
  overall: number | null;
  band: NgxScoreBand | null;
  confidence: NgxScoreConfidence;
  /** Part (pondérée) des critères fondamentaux utilisés dont les chiffres sont confirmés ; null sans fondamentaux. */
  confirmedShare: number | null;
  /** Dernier exercice publié quand il a plus de 2 ans : fondamentaux exclus. */
  staleAccountsYear: number | null;
  pillars: Record<NgxPillarKey, NgxPillar>;
  /** Score global puis les 4 politiques (ordre PORTFOLIO_TYPE_IDS). */
  policies: NgxPolicyScore[];
}

// ───────────── Outils ─────────────

const clamp100 = (n: number) => Math.min(100, Math.max(0, n));
const finite = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n);

/** Interpolation linéaire par morceaux, bornée aux extrémités. */
export function lin(value: number, pts: ReadonlyArray<readonly [number, number]>): number {
  if (value <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i += 1) {
    if (value <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((value - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return pts[pts.length - 1][1];
}

const CURVES = {
  growthRevenue: [[-10, 0], [0, 30], [10, 55], [20, 75], [35, 95], [50, 100]],
  growthNet: [[-10, 0], [0, 30], [10, 55], [20, 75], [35, 95], [50, 100]],
  growthYoy: [[-20, 0], [0, 30], [10, 55], [20, 75], [40, 95], [60, 100]],
  roe: [[0, 10], [8, 35], [15, 60], [25, 85], [35, 100]],
  netMargin: [[0, 10], [5, 35], [10, 55], [20, 80], [35, 100]],
  consistency: [[0, 0], [40, 15], [60, 45], [80, 75], [100, 100]],
  per: [[3, 90], [6, 80], [10, 65], [15, 50], [25, 30], [40, 15], [80, 5]],
  perVsSector: [[-50, 95], [-25, 80], [0, 55], [25, 35], [60, 15], [100, 5]],
  pbr: [[0.3, 90], [0.7, 80], [1.2, 62], [2, 45], [4, 25], [8, 10], [12, 5]],
  pbrVsSector: [[-50, 95], [-25, 80], [0, 55], [25, 35], [60, 15], [100, 5]],
  fairValueGap: [[-40, 100], [-20, 85], [0, 55], [20, 35], [50, 15], [100, 5]],
  yield: [[0, 0], [2, 25], [5, 55], [8, 80], [12, 95], [15, 100]],
  regularity: [[0, 0], [1, 20], [2, 40], [3, 60], [4, 85], [5, 100]],
  payout: [[0, 30], [20, 70], [40, 100], [70, 100], [90, 55], [100, 35], [150, 10]],
  dividendGrowth: [[-50, 5], [-20, 25], [0, 55], [25, 80], [100, 100]],
  mom3m: [[-30, 5], [-10, 25], [0, 45], [10, 65], [25, 85], [50, 100]],
  mom1y: [[-40, 5], [-15, 25], [0, 45], [20, 70], [60, 92], [120, 100]],
  drawdown: [[0, 100], [10, 80], [25, 50], [40, 25], [60, 5]],
  volatility: [[10, 95], [25, 75], [40, 50], [60, 25], [90, 5]],
  liquidity: [[1e6, 5], [1e7, 25], [5e7, 50], [1e8, 75], [5e8, 95], [2e9, 100]],
} as const satisfies Record<string, ReadonlyArray<readonly [number, number]>>;

function worst(...c: Array<NgxConfidence | null | undefined>): NgxConfidence | null {
  const known = c.filter((x): x is NgxConfidence => x != null);
  if (known.length === 0) return null;
  const order: NgxConfidence[] = ["low", "medium", "high"];
  return order.find((o) => known.includes(o)) ?? null;
}

/** Confiance d'un exercice côté compte de résultat (BPA publié) ; null = non enregistrée. */
function incomeConfidence(years: readonly NgxFinancialYear[], year: number | null): NgxConfidence | null {
  if (year == null) return null;
  return years.find((y) => y.year === year)?.epsConfidence ?? null;
}

type Comp = NgxScoreComponent | null;

function comp(
  key: string,
  value: number | null,
  points: number,
  weight: number,
  conf: NgxConfidence | "market" | null,
): Comp {
  if (conf === "low" || weight <= 0 || !finite(points)) return null;
  return {
    key,
    value,
    points: clamp100(points),
    weight,
    confidence: conf === "market" ? "market" : conf === "high" ? "high" : "medium",
  };
}

function pillar(key: NgxPillarKey, list: Comp[], totalWeight: number): NgxPillar {
  const components = list.filter((c): c is NgxScoreComponent => c != null);
  const w = components.reduce((s, c) => s + c.weight, 0);
  if (components.length === 0 || w < totalWeight * MIN_PILLAR_WEIGHT_SHARE) {
    return { key, score: null, reliability: null, components };
  }
  const raw = components.reduce((s, c) => s + c.points * c.weight, 0) / w;
  const reliability = components.reduce((s, c) => s + (c.confidence === "medium" ? UNCONFIRMED_FACTOR : 1) * c.weight, 0) / w;
  return { key, score: Math.round(clamp100(50 + (raw - 50) * reliability)), reliability, components };
}

// ───────────── Piliers fondamentaux ─────────────

function growthPillar(m: ScoreInput): NgxPillar {
  const years = m.performance.years;
  const rev = m.performance.revenueCagr;
  const net = m.performance.netIncomeCagr;
  const latestNet = [...years].reverse().find((y) => y.netIncomeBn != null) ?? null;
  const revConf = rev.cagr != null ? worst(incomeConfidence(years, rev.fromYear), incomeConfidence(years, rev.toYear)) : null;
  const netConf = worst(incomeConfidence(years, net.fromYear), incomeConfidence(years, net.toYear));
  const lastYear = years[years.length - 1]?.year ?? null;
  const list: Comp[] = [];
  if (rev.cagr != null) list.push(comp("revenueCagr", rev.cagr, lin(rev.cagr, CURVES.growthRevenue), 0.35, revConf));
  if (latestNet && (latestNet.netIncomeBn ?? 0) <= 0) {
    // Dernier résultat net ≤ 0 : la croissance ne se mesure pas, le critère est négatif.
    list.push(comp("netIncomeCagr", null, 5, 0.4, incomeConfidence(years, latestNet.year)));
  } else if (net.cagr != null) {
    list.push(comp("netIncomeCagr", net.cagr, lin(net.cagr, CURVES.growthNet), 0.4, netConf));
  }
  if (m.performance.latestRevenueGrowthPercent != null) {
    list.push(
      comp(
        "revenueYoy",
        m.performance.latestRevenueGrowthPercent,
        lin(m.performance.latestRevenueGrowthPercent, CURVES.growthYoy),
        0.25,
        incomeConfidence(years, lastYear),
      ),
    );
  }
  return pillar("growth", list, 1);
}

function qualityPillar(m: ScoreInput): NgxPillar {
  const years = m.performance.years;
  const metrics = m.price.metrics;
  const list: Comp[] = [];
  if (metrics.roePercent != null) {
    const conf = worst(
      years.find((y) => y.year === metrics.roeYear)?.equityConfidence ?? null,
      incomeConfidence(years, metrics.roeYear),
    );
    list.push(comp("roe", metrics.roePercent, lin(metrics.roePercent, CURVES.roe), 0.4, conf));
  }
  const margin = m.performance.latestNetMarginPercent;
  const lastYear = years[years.length - 1]?.year ?? null;
  if (margin != null) list.push(comp("netMargin", margin, lin(margin, CURVES.netMargin), 0.25, incomeConfidence(years, lastYear)));
  const recent = years.filter((y) => y.netIncomeBn != null).slice(-5);
  if (recent.length >= 3) {
    const ratio = (recent.filter((y) => (y.netIncomeBn ?? 0) > 0).length / recent.length) * 100;
    list.push(comp("consistency", ratio, lin(ratio, CURVES.consistency), 0.35, worst(...recent.map((y) => y.epsConfidence))));
  }
  return pillar("quality", list, 1);
}

function valuationPillar(m: ScoreInput): NgxPillar {
  const metrics = m.price.metrics;
  const years = m.performance.years;
  const perConf = incomeConfidence(years, metrics.perYear);
  const pbrConf = years.find((y) => y.year === metrics.equityYear)?.equityConfidence ?? null;
  const rows = m.sectorComparison.rows;
  const perRow = rows.find((r) => r.key === "per");
  const pbrRow = rows.find((r) => r.key === "pbr");
  const sectorWeight = (r: typeof perRow, base: number) => (r && r.stat.lowConfidence ? base / 2 : base);
  const list: Comp[] = [];

  if (metrics.perStatus === "ok" && metrics.per != null) {
    list.push(comp("per", metrics.per, lin(metrics.per, CURVES.per), 0.22, perConf));
    if (perRow && perRow.gapPercent != null && perRow.stat.n >= 2 && (perRow.stat.median ?? 0) > 0) {
      list.push(comp("perVsSector", perRow.gapPercent, lin(perRow.gapPercent, CURVES.perVsSector), sectorWeight(perRow, 0.12), perConf));
    }
  } else if (metrics.perStatus === "negative") {
    list.push(comp("per", null, 8, 0.22, perConf));
  }
  if (metrics.pbrStatus === "ok" && metrics.pbr != null) {
    list.push(comp("pbr", metrics.pbr, lin(metrics.pbr, CURVES.pbr), 0.18, pbrConf));
    if (pbrRow && pbrRow.gapPercent != null && pbrRow.stat.n >= 2 && (pbrRow.stat.median ?? 0) > 0) {
      list.push(comp("pbrVsSector", pbrRow.gapPercent, lin(pbrRow.gapPercent, CURVES.pbrVsSector), sectorWeight(pbrRow, 0.08), pbrConf));
    }
  } else if (metrics.pbrStatus === "negative") {
    list.push(comp("pbr", null, 5, 0.18, pbrConf));
  }
  const s = m.valuation.summary;
  if (s.verdict !== "UNKNOWN" && s.gapToMidPercent != null) {
    list.push(comp("fairValueGap", s.gapToMidPercent, lin(s.gapToMidPercent, CURVES.fairValueGap), 0.4, perConf));
  }
  return pillar("valuation", list, 1);
}

function dividendsPillar(m: ScoreInput): NgxPillar {
  const d = m.dividends;
  // Aucune ligne de dividende référencée : on ne peut pas distinguer « pas de dividende » de « non publié » → N/D.
  if (d.lines.length === 0) return { key: "dividends", score: null, reliability: null, components: [] };
  const years = m.performance.years;
  const list: Comp[] = [];
  if (d.currentYieldPercent != null) list.push(comp("dividendYield", d.currentYieldPercent, lin(Math.min(d.currentYieldPercent, 15), CURVES.yield), 0.4, "market"));
  if (d.yearsPaid) {
    const scaled = (d.yearsPaid.paid / d.yearsPaid.window) * 5;
    list.push(comp("dividendRegularity", d.yearsPaid.paid, lin(scaled, CURVES.regularity), 0.3, "market"));
  }
  const last = d.lines[0];
  if (last?.payoutPercent != null) {
    list.push(comp("payout", last.payoutPercent, lin(last.payoutPercent, CURVES.payout), 0.15, incomeConfidence(years, last.year)));
  }
  if (d.growthPercent != null) list.push(comp("dividendGrowth", d.growthPercent, lin(d.growthPercent, CURVES.dividendGrowth), 0.15, "market"));
  return pillar("dividends", list, 1);
}

// ───────────── Piliers techniques ─────────────

function trendPoints(close: number | null, sma50: number | null, sma200: number | null): number | null {
  if (close == null || sma50 == null) return null;
  const above50 = close > sma50;
  if (sma200 == null) return above50 ? 60 : 30;
  if (above50 && sma50 > sma200) return 90;
  if (above50 && close > sma200) return 75;
  if (above50) return 55;
  if (close > sma200) return 45;
  return 20;
}

function momentumPillar(m: ScoreInput): NgxPillar {
  const p = m.price.stats;
  const list: Comp[] = [];
  const trend = trendPoints(p.lastClose, p.sma50, p.sma200);
  if (trend != null) list.push(comp("trend", null, trend, 0.4, "market"));
  if (p.return3mPercent != null) list.push(comp("momentum3m", p.return3mPercent, lin(p.return3mPercent, CURVES.mom3m), 0.3, "market"));
  if (p.return1yPercent != null) list.push(comp("momentum1y", p.return1yPercent, lin(p.return1yPercent, CURVES.mom1y), 0.3, "market"));
  return pillar("momentum", list, 1);
}

function riskPillar(m: ScoreInput): NgxPillar {
  const p = m.price.stats;
  const list: Comp[] = [];
  if (p.drawdownFromHighPercent != null) list.push(comp("drawdown", p.drawdownFromHighPercent, lin(p.drawdownFromHighPercent, CURVES.drawdown), 0.3, "market"));
  if (p.volatilityPercent != null) list.push(comp("volatility", p.volatilityPercent, lin(p.volatilityPercent, CURVES.volatility), 0.3, "market"));
  if (p.avgDailyValueNgn != null && p.tradedSessionsRatio != null) {
    const pts = lin(p.avgDailyValueNgn, CURVES.liquidity) * (0.4 + 0.6 * p.tradedSessionsRatio);
    list.push(comp("liquidity", p.avgDailyValueNgn, pts, 0.4, "market"));
  }
  return pillar("risk", list, 1);
}

// ───────────── Assemblage ─────────────

export function weightedScore(
  pillars: Record<NgxPillarKey, NgxPillar>,
  weights: Record<NgxPillarKey, number>,
  required: readonly NgxPillarKey[] = [],
): { score: number | null; coverage: number; missing: NgxPillarKey[] } {
  let total = 0;
  let avail = 0;
  let acc = 0;
  const missing: NgxPillarKey[] = [];
  for (const k of NGX_PILLAR_KEYS) {
    const w = weights[k];
    if (w <= 0) continue;
    total += w;
    const s = pillars[k].score;
    if (s == null) {
      missing.push(k);
      continue;
    }
    avail += w;
    acc += s * w;
  }
  const coverage = total > 0 ? avail / total : 0;
  const blocked = required.some((r) => pillars[r].score == null) || coverage < MIN_COVERAGE || avail === 0;
  return { score: blocked ? null : Math.round(acc / avail), coverage, missing };
}

export function scoreBand(score: number | null): NgxScoreBand | null {
  if (score == null) return null;
  return score >= HIGH_SCORE_THRESHOLD ? "HIGH" : score >= 50 ? "GOOD" : score >= 35 ? "MIXED" : "LOW";
}

export function computeNgxScore(m: ScoreInput): NgxScore {
  const stale = m.price.metrics.staleAccountsYear;
  const hasFundamentals = m.tier === "FULL" && stale == null;
  const empty = (key: NgxPillarKey): NgxPillar => ({ key, score: null, reliability: null, components: [] });
  const pillars: Record<NgxPillarKey, NgxPillar> = {
    growth: hasFundamentals ? growthPillar(m) : empty("growth"),
    quality: hasFundamentals ? qualityPillar(m) : empty("quality"),
    valuation: hasFundamentals ? valuationPillar(m) : empty("valuation"),
    dividends: hasFundamentals ? dividendsPillar(m) : empty("dividends"),
    momentum: momentumPillar(m),
    risk: riskPillar(m),
  };

  const fundamentalCount = NGX_FUNDAMENTAL_PILLARS.filter((k) => pillars[k].score != null).length;
  const marketCount = NGX_MARKET_PILLARS.filter((k) => pillars[k].score != null).length;
  const mode: NgxScoreMode =
    fundamentalCount >= 3 ? "FULL" : fundamentalCount >= 1 ? "PARTIAL" : marketCount >= 1 ? "CHART_ONLY" : "NONE";

  const overallRes = weightedScore(pillars, NGX_SCORE_WEIGHTS.OVERALL);
  const policies: NgxPolicyScore[] = [
    { type: "OVERALL", score: overallRes.score, coverage: overallRes.coverage, missing: overallRes.missing },
    ...PORTFOLIO_TYPE_IDS.map((type): NgxPolicyScore => {
      const r = weightedScore(pillars, NGX_SCORE_WEIGHTS[type], NGX_POLICY_REQUIRED[type]);
      return { type, score: r.score, coverage: r.coverage, missing: r.missing };
    }),
  ];

  // Part des critères fondamentaux confirmés (pondérée).
  let wAll = 0;
  let wHigh = 0;
  for (const k of NGX_FUNDAMENTAL_PILLARS) {
    if (pillars[k].score == null) continue;
    for (const c of pillars[k].components) {
      wAll += c.weight;
      if (c.confidence === "high") wHigh += c.weight;
    }
  }
  const confirmedShare = wAll > 0 ? wHigh / wAll : null;
  const confidence: NgxScoreConfidence =
    mode === "FULL" && marketCount === 2 && (confirmedShare ?? 0) >= 0.4
      ? "HIGH"
      : fundamentalCount >= 2
        ? "MEDIUM"
        : "LOW";

  return {
    mode,
    overall: overallRes.score,
    band: scoreBand(overallRes.score),
    confidence,
    confirmedShare,
    staleAccountsYear: stale,
    pillars,
    policies,
  };
}

export function policyScore(score: NgxScore, type: PolicyKey): NgxPolicyScore {
  return score.policies.find((p) => p.type === type) ?? { type, score: null, coverage: 0, missing: [] };
}
