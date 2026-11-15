// Détail d'une ligne de la vue d'ensemble NGX (ligne dépliée), chargé à la demande pour UN ticker.
// Mêmes informations que la ligne dépliée BRVM (components/marche/MarketBoardClient.tsx) :
// performances 5 / 10 ans, rendement, PER, volatilité, gestion du risque, horizons, synthèse
// du signal et ses raisons — plus les ratios NGX (P/B, ROE, BPA) et la note par pilier.
//
// Egress Supabase : une seule ligne `chart_series` (1A, ≈ 18 ko) par ticker ; l'univers vient
// du cache serveur NGX déjà partagé. Le tout est mis en cache 10 min (étiquette `ngx-market`,
// invalidée après chaque ingestion). Jamais tout `price_history`.
// Rien n'est inventé : null = N/D à l'affichage.

import { prisma } from "@/lib/prisma";
import { cachedLoader, NGX_MARKET_REVALIDATE_S, NGX_MARKET_TAG } from "@/lib/cache/market-cache";
import { adjustSeries, adjustmentFingerprint } from "@/lib/corporate-actions/adjust";
import { actionsByTicker } from "@/lib/corporate-actions/load";
import { presentCompanyCloses } from "@/lib/corporate-actions/present-series";
import { fromCompactPoints, type ChartSeriesMetaPayload } from "@/lib/charts/chart-series-cache";
import type { ChartClosePoint } from "@/lib/charts/indicators";
import { calcMetrics, type HorizonScores, type SignalReason, type TradeSignal } from "@/lib/calc/calc-metrics";
import type { RiskPillarKey } from "@/lib/calc/risk-analysis";
import { patchFromAnalysis } from "@/lib/technical-analysis/apply-signal";
import type { ConfidenceLevel } from "@/lib/technical-analysis/types";
import { latestEurNgnRate, XOF_PER_EUR } from "@/lib/markets/fx";
import { buildNgxSheet, computeCompanyMetrics } from "@/lib/ngx/sheet-model";
import { NGX_PILLAR_KEYS, policyScore, type NgxPillarKey } from "@/lib/ngx/score";
import { ngxSectorGroup, type NgxSectorGroup } from "@/lib/ngx/sectors";
import { ngxTechnicalAnalysis } from "@/lib/ngx/technical-signal";
import { PORTFOLIO_TYPE_IDS, type PortfolioTypeId } from "@/lib/portfolio-types/constants";
import { loadNgxUniverse } from "./ngx-sheet";

export interface NgxRowDetail {
  ticker: string;
  /** Performance sur 5 ans (clôtures annuelles, même calcul que la BRVM), %. */
  perf5Percent: number | null;
  /** Performance depuis la première clôture annuelle (≥ 10 années de cours, comme la BRVM), %. */
  perf10Percent: number | null;
  /** Première année de cours connue. */
  firstYear: number | null;
  /**
   * Performance depuis la première clôture annuelle connue (`firstYear`), %. L'historique NGX en base
   * ne dépasse pas 8 années civiles : « Perf. 10 ans » reste N/D, cette carte la remplace alors.
   */
  perfSinceFirstPercent: number | null;
  yieldPercent: number | null;
  dps: number | null;
  dpsYear: number | null;
  per: number | null;
  perYear: number | null;
  pbr: number | null;
  roePercent: number | null;
  roeYear: number | null;
  eps: number | null;
  epsYear: number | null;
  high52: number | null;
  low52: number | null;
  /** Volatilité (variation annuelle moyenne, comme la BRVM), %. */
  volatilityPercent: number | null;
  riskLevel: "Faible" | "Moyen" | "Élevé" | "N/D";
  risk: {
    tier: string;
    score: number;
    summary: string;
    pillars: Array<{ key: RiskPillarKey; label: string; score: number | null; note: string }>;
  };
  horizons: HorizonScores | null;
  /** Signal technique (même série et même calcul que la colonne Signal). */
  signal: {
    label: TradeSignal["label"];
    confidence: ConfidenceLevel;
    summary: string;
    reasons: SignalReason[];
  } | null;
  pillars: Record<NgxPillarKey, number | null>;
  policies: Record<PortfolioTypeId, number | null>;
}

const WINDOW_DAYS = 365 + 420;

/** Familles NGX → secteurs du profil de risque opérationnel (lib/calc/risk-analysis.ts). Autres : neutre. */
const RISK_SECTOR: Record<NgxSectorGroup, string> = {
  BANKING: "Banques",
  INSURANCE: "Services Financiers",
  CONSUMER_GOODS: "Conso. Base",
  OIL_GAS: "Énergie",
  INDUSTRIAL_GOODS: "Industrie",
  ICT: "Télécoms",
  AGRICULTURE: "Agriculture",
  HEALTHCARE: "Santé",
  CONSTRUCTION_REAL_ESTATE: "Construction et immobilier",
  SERVICES: "Services",
  CONGLOMERATES: "Conglomérats",
  NATURAL_RESOURCES: "Ressources naturelles",
  OTHER: "Autres",
};

const finiteOrNull = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const parsePct = (v: string): number | null => (v === "N/D" ? null : finiteOrNull(parseFloat(v)));

interface SeriesBundle {
  series: ChartClosePoint[];
  yearly: Record<number, number>;
}

/** Série 1A (fenêtre partagée avec la note et le signal) + clôtures annuelles, ajustées des opérations sur titres. */
async function loadSeriesBundle(companyId: string, ticker: string): Promise<SeriesBundle> {
  const [row, actions] = await Promise.all([
    prisma.chartSeries
      .findFirst({
        where: { kind: "COMPANY", exchange: "NGX", rangeKey: "1A", symbol: ticker },
        select: { points: true, pointCount: true, meta: true },
      })
      .catch(() => null),
    actionsByTicker().catch(() => new Map()),
  ]);
  const acts = actions.get(ticker) ?? [];
  const toYearly = (closes: Record<string, number>, adjusted: boolean): Record<number, number> => {
    const pts = Object.entries(closes)
      .map(([y, v]) => ({ time: `${y}-12-31`, value: Number(v) }))
      .filter((p) => /^\d{4}-/.test(p.time) && p.value > 0);
    const out: Record<number, number> = {};
    for (const p of adjusted ? pts : adjustSeries(pts, acts)) out[Number(p.time.slice(0, 4))] = p.value;
    return out;
  };

  if (row && row.pointCount > 0) {
    const meta = (row.meta ?? null) as ChartSeriesMetaPayload | null;
    const adjusted = meta?.adjustmentFingerprint === adjustmentFingerprint(acts);
    const points = fromCompactPoints(row.points);
    return {
      series: adjusted ? points : adjustSeries(points, acts),
      yearly: toYearly(meta?.yearlyCloses ?? {}, adjusted),
    };
  }

  // Pas de ligne de cache : fenêtre récente canonique + dernière clôture de chaque année (≈ 10 lignes).
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 3600 * 1000);
  const [prices, yearEnds] = await Promise.all([
    prisma.priceHistory.findMany({
      where: { companyId, isCanonical: true, date: { gte: since } },
      orderBy: { date: "asc" },
      select: { date: true, closePrice: true, volume: true },
    }),
    prisma.$queryRaw<Array<{ y: number; close: unknown }>>`
      SELECT DISTINCT ON (EXTRACT(YEAR FROM date)) EXTRACT(YEAR FROM date)::int AS y, close_price AS close
      FROM price_history
      WHERE company_id = ${companyId} AND is_canonical AND close_price > 0
      ORDER BY EXTRACT(YEAR FROM date), date DESC`.catch(() => [] as Array<{ y: number; close: unknown }>),
  ]);
  const raw: ChartClosePoint[] = prices
    .map((p) => ({
      time: p.date.toISOString().slice(0, 10),
      value: Number(p.closePrice),
      volume: p.volume != null ? Number(p.volume) : null,
    }))
    .filter((p) => p.value > 0);
  const presented = raw.length > 0 ? (await presentCompanyCloses(prisma, companyId, ticker, raw)).points : [];
  const closes: Record<string, number> = {};
  for (const r of yearEnds) closes[String(r.y)] = Number(String(r.close));
  return { series: presented, yearly: toYearly(closes, false) };
}

/** Variation entre la première et la dernière clôture annuelle (au moins 2 années), arrondie à 0,1 %. */
function perfSinceFirst(years: number[], yearly: Record<number, number>): number | null {
  const valid = years.filter((y) => (yearly[y] ?? 0) > 0);
  if (valid.length < 2) return null;
  const first = yearly[valid[0]!]!;
  const last = yearly[valid[valid.length - 1]!]!;
  return Math.round(((last - first) / first) * 1000) / 10;
}

async function loadNgxRowDetailUncached(tickerRaw: string): Promise<NgxRowDetail | null> {
  const ticker = String(tickerRaw ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9.&-]{1,20}$/.test(ticker)) return null;
  const { rows, universe } = await loadNgxUniverse();
  const company = universe.find((c) => c.ticker === ticker);
  const idRow = rows.find((r) => r.ticker === ticker);
  if (!company || !idRow) return null;

  const [bundle, fx] = await Promise.all([
    loadSeriesBundle(idRow.id, ticker),
    latestEurNgnRate(prisma).catch(() => null),
  ]);
  const series = bundle.series.map((p) => ({ time: p.time, value: p.value, volume: p.volume ?? null }));

  // Même construction que l'écran de tri / la colonne Score : chiffres identiques.
  const today = new Date().toISOString().slice(0, 10);
  const universeMetrics = universe.map((c) => ({ c, m: computeCompanyMetrics(c, today) }));
  const model = buildNgxSheet({
    company,
    previousClose: null,
    changePercent: null,
    volume: null,
    sessionDate: null,
    indicativeFcfa: null,
    series,
    events: [],
    documents: [],
    universe,
    universeMetrics,
    today,
  });
  const metrics = model.price.metrics;
  const score = model.score;

  // Lecture « BRVM » (calcMetrics) : clôtures annuelles + série récente, dividendes NGX.
  const yearly = { ...bundle.yearly };
  const last = series[series.length - 1];
  if (last) yearly[Number(last.time.slice(0, 4))] = last.value;
  const years = Object.keys(yearly)
    .map(Number)
    .filter((y) => Number.isInteger(y))
    .sort((a, b) => a - b);
  const dividends: Record<number, number> = {};
  for (const line of model.dividends.lines) if (line.dps > 0) dividends[line.year] = line.dps;
  // Capitalisation convertie en milliards FCFA : seuils de liquidité de la grille BRVM.
  const capBn = metrics.marketCapBn;
  const capFcfaBn = capBn != null && fx ? (capBn * XOF_PER_EUR) / fx.ngnPerEur : undefined;
  const group = ngxSectorGroup(company.ticker, company.sectorSlug || company.sectorName);
  const m = calcMetrics({
    years,
    prices: yearly,
    dividends,
    per: metrics.per ?? 0,
    mktcap: capFcfaBn,
    sector: RISK_SECTOR[group],
    closes: series.length > 0 ? series : undefined,
  });
  const capNote = capBn != null ? `cap. ${capBn.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Md ₦` : null;
  const pillarsRisk = m.riskAnalysis.pillars.map((p) => ({
    key: p.key,
    label: p.label,
    score: p.score,
    note: capNote ? p.note.replace(/cap\. [^·.]+? Md(?= ·|\.)/, capNote) : p.note,
  }));

  // Signal technique : même fenêtre et même analyse que la colonne Signal.
  let signal: NgxRowDetail["signal"] = null;
  if (series.length > 0) {
    const analysis = ngxTechnicalAnalysis(series);
    const quality = score.overall == null ? null : Math.round(score.overall);
    const patch = patchFromAnalysis(analysis, quality ?? 0);
    const summary =
      quality == null ? patch.signalSummary.replace(/\(score qualité 0\/100, /, "(note N/D, ") : patch.signalSummary;
    signal = { label: patch.signal.label, confidence: patch.confidence, summary, reasons: patch.signalReasons };
  }

  const hasPrices = years.length > 0 || series.length > 0;
  return {
    ticker,
    perf5Percent: parsePct(m.perf5Percent),
    perf10Percent: parsePct(m.perf10Percent),
    firstYear: years[0] ?? null,
    perfSinceFirstPercent: perfSinceFirst(years, yearly),
    yieldPercent: finiteOrNull(model.dividends.currentYieldPercent),
    dps: finiteOrNull(model.dividends.currentDps),
    dpsYear: model.dividends.currentDpsYear,
    per: finiteOrNull(metrics.per),
    perYear: metrics.perYear,
    pbr: finiteOrNull(metrics.pbr),
    roePercent: finiteOrNull(metrics.roePercent),
    roeYear: metrics.roeYear,
    eps: finiteOrNull(metrics.eps),
    epsYear: metrics.epsYear,
    high52: finiteOrNull(model.price.stats.high52),
    low52: finiteOrNull(model.price.stats.low52),
    volatilityPercent: parsePct(m.volatilityPercent),
    riskLevel: m.riskLevel,
    risk: { tier: m.riskAnalysis.riskTier, score: m.riskAnalysis.riskScore, summary: m.riskAnalysis.summary, pillars: pillarsRisk },
    horizons: hasPrices ? m.horizonScores : null,
    signal,
    pillars: Object.fromEntries(NGX_PILLAR_KEYS.map((k) => [k, score.pillars[k].score])) as Record<NgxPillarKey, number | null>,
    policies: Object.fromEntries(PORTFOLIO_TYPE_IDS.map((t) => [t, policyScore(score, t).score])) as Record<PortfolioTypeId, number | null>,
  };
}

const loadNgxRowDetailCached = cachedLoader(loadNgxRowDetailUncached, ["ngx-row-detail-v2"], {
  revalidate: NGX_MARKET_REVALIDATE_S,
  tags: [NGX_MARKET_TAG],
});

/** Détail d'une ligne NGX, mis en cache 10 min par ticker (invalidé après chaque ingestion NGX). */
export function loadNgxRowDetail(ticker: string): Promise<NgxRowDetail | null> {
  return loadNgxRowDetailCached(String(ticker ?? "").trim().toUpperCase());
}

export { loadNgxRowDetailUncached };
