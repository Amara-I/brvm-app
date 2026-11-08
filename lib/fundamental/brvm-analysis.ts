// Analyse fondamentale BRVM — les 8 étapes de la fiche NGX
// (présentation, performances, perspectives, prix, valorisation, secteur,
// dividendes, conclusion), sur les fonctions pures déjà testées.
// Montants en FCFA / Mds FCFA. Toute donnée absente reste null (affichage N/D).
// Le score de la fiche (calcMetrics) n'est ni relu ni recalculé ici.

import type { OutlookSynthesis } from "@/lib/outlook/synthesis";
import { PORTFOLIO_TYPE_IDS, type PortfolioTypeId } from "@/lib/portfolio-types/constants";
import {
  concludeAllPolicies,
  POLICY_THRESHOLDS,
  type PolicyConclusion,
  type PolicyCriterion,
} from "@/lib/ngx/policy";
import { priceStats, type PricePoint, type PriceStats } from "@/lib/ngx/price-stats";
import {
  accountsAreStale,
  currentDividend,
  dividendYearsPaid,
  dividendYieldPercent,
  earningsPerShare,
  estimateFairValues,
  growthPercent,
  marginPercent,
  marketCapBn,
  payoutPercent,
  relativeGapPercent,
  sectorStat,
  seriesCagrPercent,
  summarizeValuation,
  type FairValueEstimate,
  type SectorStat,
  type ValuationSummary,
} from "@/lib/ngx/valuation";

export const FUNDAMENTAL_STEP_IDS = [
  "presentation",
  "performance",
  "outlook",
  "price",
  "valuation",
  "sector",
  "dividends",
  "conclusion",
] as const;

export type FundamentalStepId = (typeof FUNDAMENTAL_STEP_IDS)[number];
export type StepTone = "good" | "mid" | "bad" | "nd";

export interface FundamentalStep {
  id: FundamentalStepId;
  tone: StepTone;
  /** Clé company.fundamental.verdict.<id>.<verdict>. */
  verdict: string;
}

/**
 * Volumes en titres : mêmes paliers que le pilier de liquidité BRVM
 * (lib/calc/risk-analysis.ts). On ne modifie pas ce pilier ni le score.
 */
export const BRVM_SHARE_VOLUME = {
  illiquidBelow: 500,
  thinBelow: 2_000,
} as const;

/**
 * Valeur échangée en FCFA par séance. Même forme de règle que la NGX
 * (favorable / neutre / défavorable), exprimée en francs et non en nairas.
 */
export const BRVM_VALUE_BANDS = {
  ok: 50_000_000,
  low: 5_000_000,
  tradedRatioOk: 0.8,
  /** Moins de la moitié des 60 dernières séances ont un volume > 0. */
  noTradeIlliquidBelow: 0.5,
} as const;

export type LiquidityLevel = "OK" | "THIN" | "ILLIQUID" | "ND";
export type LiquidityReason = "noTrade" | "lowVolume" | "lowValue";

export interface LiquidityReading {
  level: LiquidityLevel;
  /** Vrai seulement quand le titre est peu liquide — jamais quand la donnée manque. */
  illiquid: boolean;
  reasons: LiquidityReason[];
  avgDailyValueFcfa: number | null;
  avgShareVolume: number | null;
  tradedSessionsRatio: number | null;
  stats: PriceStats;
}

export interface BrvmPeerSnapshot {
  ticker: string;
  sector: string;
  per: number;
  mktcap: number;
  pbRatio: number | null;
  roe: number | null;
  netMargin: number | null;
  revenueGrowth: number | null;
  close: number | null;
  /** null = aucune ligne. 0 = dividende nul enregistré. */
  dividend: number | null;
}

export interface BrvmIncomeYear {
  year: number;
  revenue: number | null;
  netIncome: number | null;
  operatingIncome: number | null;
}

export interface BrvmDividendInput {
  year: number;
  amount: number;
  exDate: string | null;
  paymentDate: string | null;
  source: string | null;
}

export interface BrvmFundamentalInput {
  ticker: string;
  name: string;
  sector: string;
  description: string | null;
  isin: string | null;
  listedSince: string | null;
  sharesOutstanding: number | null;
  close: number | null;
  /** 0 = non publié (convention du jeu de données). */
  per: number;
  mktcap: number;
  roe: number | null;
  netMargin: number | null;
  debtRatio: number | null;
  pbRatio: number | null;
  revenueGrowth: number | null;
  fcf: number | null;
  income: BrvmIncomeYear[];
  dividends: BrvmDividendInput[];
  series: readonly PricePoint[];
  outlook: OutlookSynthesis | null;
  universe: readonly BrvmPeerSnapshot[];
  /** YYYY-MM-DD. Sert à écarter des comptes trop anciens. */
  today: string;
}

export interface PerformanceYear {
  year: number;
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
}

export type MultipleStatus = "ok" | "stale" | "negative" | "unavailable";

export interface PublishedMultiple {
  value: number | null;
  status: MultipleStatus;
}

export type BrvmSectorKey = "per" | "pbr" | "yield" | "netMargin" | "roe" | "revenueGrowth";

export interface BrvmSectorRow {
  key: BrvmSectorKey;
  company: number | null;
  stale: boolean;
  stat: SectorStat;
  /** Écart relatif (PER, PBR). */
  gapPercent: number | null;
  /** Écart en points (rendement, marges, ROE, croissance). */
  pointGap: number | null;
}

export interface DividendLine {
  year: number;
  dps: number;
  payoutPercent: number | null;
  exDate: string | null;
  paymentDate: string | null;
  source: string | null;
}

export interface BrvmFundamentalAnalysis {
  steps: FundamentalStep[];
  liquidity: LiquidityReading;
  staleAccountsYear: number | null;
  presentation: {
    description: string | null;
    isin: string | null;
    listedSince: string | null;
    shares: number | null;
    marketCapBn: number | null;
    marketCapRank: number | null;
    rankedCount: number;
    sector: string;
  };
  performance: {
    years: PerformanceYear[];
    revenueCagr: ReturnType<typeof seriesCagrPercent>;
    netIncomeCagr: ReturnType<typeof seriesCagrPercent>;
    latestYear: number | null;
    latestRevenueGrowthPercent: number | null;
    latestRevenueGrowthYear: number | null;
    latestOperatingMarginPercent: number | null;
    latestOperatingMarginYear: number | null;
    latestNetMarginPercent: number | null;
    latestNetMarginYear: number | null;
    latestNetIncomeBn: number | null;
  };
  outlook: {
    synthesis: OutlookSynthesis | null;
    sectorGrowth: SectorStat;
    peerCount: number;
  };
  price: {
    close: number | null;
    marketCapBn: number | null;
    per: PublishedMultiple;
    pbr: PublishedMultiple;
    yieldPercent: number | null;
    roePercent: number | null;
    roeStatus: MultipleStatus;
    netMarginPercent: number | null;
    debtRatio: number | null;
    fcfBn: number | null;
    /** BPA = résultat net ÷ titres actuels. null si l'un des deux manque, ou si les comptes sont trop anciens. */
    impliedEps: number | null;
    impliedEpsYear: number | null;
  };
  valuation: {
    summary: ValuationSummary;
    estimates: FairValueEstimate[];
  };
  sector: {
    name: string;
    rows: BrvmSectorRow[];
    lowConfidence: boolean;
    peersWithData: number;
  };
  dividends: {
    lines: DividendLine[];
    yearsPaid: { paid: number; window: number; known: number } | null;
    growthPercent: number | null;
    currentYieldPercent: number | null;
    currentDps: number | null;
    currentDpsYear: number | null;
    lastFiscalYear: number | null;
    currentStatus: "NONE" | "CONFIRMED" | "UNCONFIRMED";
    missingYears: number[];
    payoutPercent: number | null;
  };
  policies: PolicyConclusion[];
  adapted: PortfolioTypeId[];
  partial: PortfolioTypeId[];
  unfavorable: PortfolioTypeId[];
  insufficient: PortfolioTypeId[];
}

function finite(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function positive(n: number | null | undefined): number | null {
  return finite(n) && n > 0 ? n : null;
}

function publishedMultiple(raw: number | null | undefined, stale: boolean): PublishedMultiple {
  if (!finite(raw) || raw === 0) return { value: null, status: "unavailable" };
  if (raw < 0) return { value: null, status: "negative" };
  if (stale) return { value: null, status: "stale" };
  return { value: raw, status: "ok" };
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function readBrvmLiquidity(series: readonly PricePoint[]): LiquidityReading {
  const stats = priceStats(series);
  const last = series
    .filter((p) => p.value > 0 && /^\d{4}-\d{2}-\d{2}$/.test(p.time))
    .sort((a, b) => (a.time < b.time ? -1 : 1))
    .slice(-60);
  const positiveVolumes = last.map((p) => p.volume).filter((v): v is number => typeof v === "number" && v > 0);
  const avgShareVolume = positiveVolumes.length >= 5 ? mean(positiveVolumes) : null;
  const ratio = stats.tradedSessionsRatio;
  const value = stats.avgDailyValueNgn;
  const reasons: LiquidityReason[] = [];
  if (ratio != null && ratio < BRVM_VALUE_BANDS.noTradeIlliquidBelow) reasons.push("noTrade");
  if (avgShareVolume != null && avgShareVolume < BRVM_SHARE_VOLUME.illiquidBelow) reasons.push("lowVolume");
  if (value != null && value < BRVM_VALUE_BANDS.low) reasons.push("lowValue");

  const noData = ratio == null && avgShareVolume == null && value == null;
  let level: LiquidityLevel = "ND";
  if (!noData) {
    if (reasons.length > 0) level = "ILLIQUID";
    else if (
      ratio == null ||
      value == null ||
      ratio < BRVM_VALUE_BANDS.tradedRatioOk ||
      (avgShareVolume != null && avgShareVolume < BRVM_SHARE_VOLUME.thinBelow) ||
      value < BRVM_VALUE_BANDS.ok
    ) {
      level = "THIN";
    } else level = "OK";
  }

  return {
    level,
    illiquid: level === "ILLIQUID",
    reasons,
    avgDailyValueFcfa: value,
    avgShareVolume,
    tradedSessionsRatio: ratio,
    stats,
  };
}

function liquidityCriterion(reading: LiquidityReading): PolicyCriterion {
  const threshold = BRVM_VALUE_BANDS.ok;
  if (reading.level === "ND") return { key: "liquidity", status: "ND", value: null, threshold };
  return {
    key: "liquidity",
    status: reading.level === "OK" ? "OK" : reading.level === "THIN" ? "NEUTRAL" : "KO",
    value: reading.avgDailyValueFcfa,
    threshold,
  };
}

function latestWith<T>(years: readonly PerformanceYear[], pick: (y: PerformanceYear) => T | null): { year: number; value: T } | null {
  for (let i = years.length - 1; i >= 0; i -= 1) {
    const value = pick(years[i]!);
    if (value != null) return { year: years[i]!.year, value };
  }
  return null;
}

function latestGrowth(years: readonly PerformanceYear[]): { year: number; percent: number } | null {
  for (let i = years.length - 1; i >= 1; i -= 1) {
    if (years[i]!.year - years[i - 1]!.year !== 1) continue;
    const g = growthPercent(years[i - 1]!.revenue, years[i]!.revenue);
    if (g != null) return { year: years[i]!.year, percent: g };
  }
  return null;
}

function step(id: FundamentalStepId, tone: StepTone, verdict: string): FundamentalStep {
  return { id, tone, verdict };
}

function byVerdict(policies: PolicyConclusion[], verdict: PolicyConclusion["verdict"]): PortfolioTypeId[] {
  return PORTFOLIO_TYPE_IDS.filter((id) => policies.find((p) => p.type === id)?.verdict === verdict);
}

export function buildBrvmFundamentalAnalysis(input: BrvmFundamentalInput): BrvmFundamentalAnalysis {
  const shares = positive(input.sharesOutstanding);
  const close = positive(input.close);
  const storedCap = positive(input.mktcap);
  const marketCap = storedCap ?? marketCapBn(close, shares);

  const income = [...input.income]
    .filter((y) => Number.isInteger(y.year))
    .sort((a, b) => a.year - b.year);
  const performanceYears: PerformanceYear[] = income.map((y) => ({
    year: y.year,
    revenue: finite(y.revenue) ? y.revenue : null,
    operatingIncome: finite(y.operatingIncome) ? y.operatingIncome : null,
    netIncome: finite(y.netIncome) ? y.netIncome : null,
    operatingMargin: marginPercent(finite(y.operatingIncome) ? y.operatingIncome : null, finite(y.revenue) ? y.revenue : null),
    netMargin: marginPercent(finite(y.netIncome) ? y.netIncome : null, finite(y.revenue) ? y.revenue : null),
  }));
  const lastAccountsYear = performanceYears.length > 0 ? performanceYears[performanceYears.length - 1]!.year : null;
  const stale = accountsAreStale(lastAccountsYear, input.today);
  const revenueCagr = seriesCagrPercent(performanceYears, (y) => y.revenue);
  const netIncomeCagr = seriesCagrPercent(performanceYears, (y) => y.netIncome);
  const revenueGrowth = latestGrowth(performanceYears);
  const operatingMargin = latestWith(performanceYears, (y) => y.operatingMargin);
  const netMarginSeries = latestWith(performanceYears, (y) => y.netMargin);
  const latestNet = latestWith(performanceYears, (y) => y.netIncome);

  const per = publishedMultiple(input.per, stale);
  const pbr = publishedMultiple(input.pbRatio, stale);
  const roeStatus: MultipleStatus = !finite(input.roe) ? "unavailable" : stale ? "stale" : "ok";
  const roe = roeStatus === "ok" ? input.roe : null;
  const impliedEps =
    !stale && latestNet && latestNet.value > 0 ? earningsPerShare(latestNet.value, shares) : null;
  const impliedEpsYear = impliedEps != null && latestNet ? latestNet.year : null;

  const ranked = input.universe
    .map((c) => ({ ticker: c.ticker, cap: positive(c.mktcap) }))
    .filter((c): c is { ticker: string; cap: number } => c.cap != null)
    .sort((a, b) => b.cap - a.cap);
  const rankIdx = ranked.findIndex((c) => c.ticker === input.ticker);

  const peers = input.universe.filter((c) => c.ticker !== input.ticker && c.sector === input.sector);
  const peerYield = (c: BrvmPeerSnapshot) => dividendYieldPercent(c.dividend, positive(c.close));
  const companyYieldLater = { current: null as number | null };

  const sectorKeys: BrvmSectorKey[] = ["per", "pbr", "yield", "netMargin", "roe", "revenueGrowth"];
  const companyRevenueGrowth = finite(input.revenueGrowth)
    ? input.revenueGrowth
    : !stale
      ? (revenueGrowth?.percent ?? null)
      : null;
  const ownValue = (key: BrvmSectorKey): number | null => {
    if (stale && (key === "per" || key === "pbr" || key === "roe" || key === "netMargin" || key === "revenueGrowth"))
      return null;
    switch (key) {
      case "per":
        return per.value;
      case "pbr":
        return pbr.value;
      case "yield":
        return companyYieldLater.current;
      case "netMargin":
        return finite(input.netMargin) ? input.netMargin : netMarginSeries?.value ?? null;
      case "roe":
        return roe;
      case "revenueGrowth":
        return companyRevenueGrowth;
    }
  };
  const peerValue = (key: BrvmSectorKey, c: BrvmPeerSnapshot): number | null => {
    switch (key) {
      case "per":
        return positive(c.per);
      case "pbr":
        return positive(c.pbRatio);
      case "yield":
        return peerYield(c);
      case "netMargin":
        return finite(c.netMargin) ? c.netMargin : null;
      case "roe":
        return finite(c.roe) ? c.roe : null;
      case "revenueGrowth":
        return finite(c.revenueGrowth) ? c.revenueGrowth : null;
    }
  };
  const sectorRows: BrvmSectorRow[] = sectorKeys.map((key) => {
    const stat = sectorStat(peers.map((c) => peerValue(key, c)));
    const mine = ownValue(key);
    return {
      key,
      company: mine,
      stale: stale && mine == null && (key === "per" || key === "pbr" || key === "roe"),
      stat,
      gapPercent: key === "per" || key === "pbr" ? relativeGapPercent(mine, stat.median) : null,
      pointGap: mine != null && stat.median != null && key !== "per" && key !== "pbr" ? mine - stat.median : null,
    };
  });
  const peersWithData = Math.max(...sectorRows.map((r) => r.stat.n), 0);
  const perStat = sectorRows.find((r) => r.key === "per")!.stat;
  const pbrStat = sectorRows.find((r) => r.key === "pbr")!.stat;

  const estimates = estimateFairValues({
    price: close,
    eps: impliedEps,
    bvps: null,
    sectorPer: perStat,
    sectorPbr: pbrStat,
  });
  const summary = summarizeValuation(close, estimates);

  const divInputs = [...input.dividends]
    .filter((d) => Number.isInteger(d.year) && finite(d.amount))
    .sort((a, b) => a.year - b.year);
  const asc = divInputs.map((d) => ({ year: d.year, dps: d.amount }));
  const lastFiscal = lastAccountsYear;
  const windowEnd = lastFiscal ?? (asc.length > 0 ? asc[asc.length - 1]!.year : null);
  const current = currentDividend(asc, lastFiscal);
  const currentDps = current.dps;
  const yieldPercent = dividendYieldPercent(currentDps, close);
  companyYieldLater.current = yieldPercent;
  // Le rendement de la société dans le tableau sectoriel a été lu avant ce calcul : on le reporte.
  const yieldRow = sectorRows.find((r) => r.key === "yield");
  if (yieldRow) {
    yieldRow.company = yieldPercent;
    const median = yieldRow.stat.median;
    yieldRow.pointGap = yieldPercent != null && median != null ? yieldPercent - median : null;
  }

  const payout =
    current.status === "CONFIRMED" &&
    impliedEps != null &&
    impliedEps > 0 &&
    current.year != null &&
    impliedEpsYear != null &&
    current.year >= impliedEpsYear - 1
      ? payoutPercent(current.dps, impliedEps)
      : null;
  const yearsPaid = windowEnd != null ? dividendYearsPaid(asc.map((l) => ({ year: l.year, amount: l.dps })), windowEnd, 5) : null;
  const window = asc.slice(-5);
  const dividendGrowth =
    current.status === "CONFIRMED" && window.length >= 3 && window[0]!.dps > 0
      ? growthPercent(window[0]!.dps, window[window.length - 1]!.dps)
      : null;
  const missingYears: number[] = [];
  if (current.year != null && lastFiscal != null) {
    for (let y = lastFiscal; y > current.year && missingYears.length < 5; y -= 1) missingYears.push(y);
  }
  const lines: DividendLine[] = [...divInputs].reverse().map((d) => ({
    year: d.year,
    dps: d.amount,
    payoutPercent:
      impliedEps != null && impliedEps > 0 && impliedEpsYear != null && d.year === impliedEpsYear
        ? payoutPercent(d.amount, impliedEps)
        : null,
    exDate: d.exDate,
    paymentDate: d.paymentDate,
    source: d.source,
  }));

  const liquidity = readBrvmLiquidity(input.series);
  const recent = performanceYears.filter((y) => y.netIncome != null).slice(-5);
  const policies = concludeAllPolicies({
    revenueCagrPercent: stale ? null : revenueCagr.cagr,
    growthSpanYears: stale ? 0 : revenueCagr.span,
    netIncomeCagrPercent: stale ? null : netIncomeCagr.cagr,
    latestNetIncomeBn: stale ? null : (latestNet?.value ?? null),
    roePercent: roe,
    profitableYears: stale ? 0 : recent.filter((y) => (y.netIncome ?? 0) > 0).length,
    knownYears: stale ? 0 : recent.length,
    valuationVerdict: summary.verdict,
    dividendYieldPercent: yieldPercent,
    dividendYearsPaid: yearsPaid?.paid ?? null,
    dividendWindow: yearsPaid?.window ?? 5,
    dividendYearsKnown: yearsPaid?.known ?? null,
    payoutPercent: payout,
    dividendGrowthPercent: dividendGrowth,
    price: liquidity.stats,
    liquidityOverride: liquidityCriterion(liquidity),
  });

  const presentationBits = [input.description, input.isin, input.listedSince, shares, marketCap].filter((v) =>
    typeof v === "number" ? v > 0 : Boolean(v && String(v).trim()),
  ).length;
  const presentationStep =
    presentationBits === 0 && !input.sector.trim()
      ? step("presentation", "nd", "missing")
      : presentationBits >= 2
        ? step("presentation", "good", "complete")
        : step("presentation", "mid", "partial");

  const hasAccounts = performanceYears.some((y) => y.revenue != null || y.netIncome != null);
  let performanceStep: FundamentalStep;
  if (!hasAccounts) performanceStep = step("performance", "nd", "missing");
  else if (stale) performanceStep = step("performance", "mid", "stale");
  else if (latestNet && latestNet.value < 0) performanceStep = step("performance", "bad", "loss");
  else if (
    revenueCagr.cagr != null &&
    revenueCagr.cagr >= POLICY_THRESHOLDS.growth.revenueCagr &&
    (latestNet == null || latestNet.value > 0) &&
    (netIncomeCagr.cagr == null || netIncomeCagr.cagr >= 0)
  )
    performanceStep = step("performance", "good", "growing");
  else if (revenueCagr.cagr != null && revenueCagr.cagr < 0 && (netIncomeCagr.cagr == null || netIncomeCagr.cagr < 0))
    performanceStep = step("performance", "bad", "declining");
  else performanceStep = step("performance", "mid", "mixed");

  const outlookStep = input.outlook ? step("outlook", "mid", "available") : step("outlook", "nd", "missing");

  const priceStep =
    liquidity.illiquid
      ? step("price", "bad", "illiquid")
      : !close && liquidity.level === "ND"
        ? step("price", "nd", "missing")
        : liquidity.level === "THIN"
          ? step("price", "mid", "thin")
          : liquidity.level === "ND"
            ? step("price", "mid", "unrated")
            : step("price", "good", "liquid");

  const valuationTone: StepTone =
    summary.verdict === "BELOW" ? "good" : summary.verdict === "WITHIN" ? "mid" : summary.verdict === "ABOVE" ? "bad" : "nd";
  const valuationStep = step("valuation", valuationTone, summary.verdict);

  const sectorUsable = sectorRows.some((r) => r.stat.median != null);
  const sectorLow = peersWithData < 4;
  const sectorStep = !sectorUsable
    ? step("sector", "nd", "missing")
    : sectorLow
      ? step("sector", "mid", "cautious")
      : step("sector", "good", "comparable");

  const rente = POLICY_THRESHOLDS.rente;
  const paid = yearsPaid?.paid ?? null;
  const dividendStep =
    lines.length === 0 && current.status === "NONE"
      ? step("dividends", "nd", "missing")
      : payout != null && payout > rente.payoutMax
        ? step("dividends", "bad", "payout")
        : current.status === "CONFIRMED" &&
            yieldPercent != null &&
            yieldPercent >= rente.yieldLow &&
            paid != null &&
            paid >= rente.regularityHigh &&
            (payout == null || payout <= rente.payoutOk)
          ? step("dividends", "good", "sustainable")
          : step("dividends", "mid", "partial");

  const adapted = byVerdict(policies, "FAVORABLE");
  const partial = byVerdict(policies, "MIXED");
  const unfavorable = byVerdict(policies, "UNFAVORABLE");
  const insufficient = byVerdict(policies, "INSUFFICIENT");
  const conclusionStep =
    adapted.length > 0
      ? step("conclusion", "good", "adapted")
      : partial.length > 0
        ? step("conclusion", "mid", "mixed")
        : unfavorable.length > 0
          ? step("conclusion", "bad", "unfavorable")
          : step("conclusion", "nd", "insufficient");

  return {
    steps: [presentationStep, performanceStep, outlookStep, priceStep, valuationStep, sectorStep, dividendStep, conclusionStep],
    liquidity,
    staleAccountsYear: stale ? lastAccountsYear : null,
    presentation: {
      description: input.description?.trim() || null,
      isin: input.isin?.trim() || null,
      listedSince: input.listedSince,
      shares,
      marketCapBn: marketCap,
      marketCapRank: rankIdx >= 0 ? rankIdx + 1 : null,
      rankedCount: ranked.length,
      sector: input.sector,
    },
    performance: {
      years: performanceYears,
      revenueCagr,
      netIncomeCagr,
      latestYear: lastAccountsYear,
      latestRevenueGrowthPercent: revenueGrowth?.percent ?? null,
      latestRevenueGrowthYear: revenueGrowth?.year ?? null,
      latestOperatingMarginPercent: operatingMargin?.value ?? null,
      latestOperatingMarginYear: operatingMargin?.year ?? null,
      latestNetMarginPercent: netMarginSeries?.value ?? null,
      latestNetMarginYear: netMarginSeries?.year ?? null,
      latestNetIncomeBn: latestNet?.value ?? null,
    },
    outlook: {
      synthesis: input.outlook,
      sectorGrowth: sectorRows.find((r) => r.key === "revenueGrowth")!.stat,
      peerCount: peers.length,
    },
    price: {
      close,
      marketCapBn: marketCap,
      per,
      pbr,
      yieldPercent,
      roePercent: roe,
      roeStatus,
      netMarginPercent: stale ? null : finite(input.netMargin) ? input.netMargin : (netMarginSeries?.value ?? null),
      debtRatio: finite(input.debtRatio) ? input.debtRatio : null,
      fcfBn: finite(input.fcf) ? input.fcf : null,
      impliedEps,
      impliedEpsYear,
    },
    valuation: { summary, estimates },
    sector: {
      name: input.sector,
      rows: sectorRows,
      lowConfidence: sectorLow,
      peersWithData,
    },
    dividends: {
      lines,
      yearsPaid,
      growthPercent: dividendGrowth,
      currentYieldPercent: yieldPercent,
      currentDps,
      currentDpsYear: current.year,
      lastFiscalYear: lastFiscal,
      currentStatus: current.status,
      missingYears,
      payoutPercent: payout,
    },
    policies,
    adapted,
    partial,
    unfavorable,
    insufficient,
  };
}

function latestPositivePrice(prices: Record<number, number>): number | null {
  const years = Object.keys(prices)
    .map(Number)
    .filter((y) => finite(prices[y]) && prices[y]! > 0)
    .sort((a, b) => a - b);
  if (years.length === 0) return null;
  return prices[years[years.length - 1]!]!;
}

function latestDividendAmount(dividends: Record<number, number>): number | null {
  const years = Object.keys(dividends)
    .map(Number)
    .filter((y) => finite(dividends[y]))
    .sort((a, b) => a - b);
  if (years.length === 0) return null;
  return dividends[years[years.length - 1]!]!;
}

/** Entrée construite depuis la fiche déjà chargée — aucun appel base. */
export interface BrvmSheetSlice {
  company: {
    ticker: string;
    name: string;
    sector: string;
    per: number;
    mktcap: number;
    roe: number | null;
    netMargin: number | null;
    debtRatio: number | null;
    pbRatio: number | null;
    revenueGrowth: number | null;
    fcf: number | null;
    prices: Record<number, number>;
    dividends: Record<number, number>;
  };
  peers: BrvmSheetSlice["company"][];
  incomeStatement: BrvmIncomeYear[];
  dividendSchedule: Array<{
    year: number;
    amount: number;
    exDate: string | null;
    paymentDate: string | null;
    source: string;
  }>;
  outlook: OutlookSynthesis | null;
  series: readonly PricePoint[];
  description: string | null;
  isin: string | null;
  listedSince: string | null;
  profileMeta: { sharesOutstanding?: number | null } | null;
  sessionDate: string | null;
}

export function analysisFromSheet(slice: BrvmSheetSlice, close: number | null, today: string): BrvmFundamentalAnalysis {
  const dividends = new Map<number, BrvmDividendInput>();
  for (const [key, amount] of Object.entries(slice.company.dividends)) {
    const year = Number(key);
    if (!Number.isInteger(year) || !finite(amount)) continue;
    dividends.set(year, { year, amount, exDate: null, paymentDate: null, source: null });
  }
  for (const row of slice.dividendSchedule) {
    if (!finite(row.amount)) continue;
    dividends.set(row.year, {
      year: row.year,
      amount: row.amount,
      exDate: row.exDate,
      paymentDate: row.paymentDate,
      source: row.source?.trim() || null,
    });
  }
  const universe: BrvmPeerSnapshot[] = slice.peers.map((c) => ({
    ticker: c.ticker,
    sector: c.sector,
    per: c.per,
    mktcap: c.mktcap,
    pbRatio: c.pbRatio,
    roe: c.roe,
    netMargin: c.netMargin,
    revenueGrowth: c.revenueGrowth,
    close: latestPositivePrice(c.prices),
    dividend: latestDividendAmount(c.dividends),
  }));
  return buildBrvmFundamentalAnalysis({
    ticker: slice.company.ticker,
    name: slice.company.name,
    sector: slice.company.sector,
    description: slice.description,
    isin: slice.isin,
    listedSince: slice.listedSince,
    sharesOutstanding: slice.profileMeta?.sharesOutstanding ?? null,
    close: positive(close) ?? latestPositivePrice(slice.company.prices),
    per: slice.company.per,
    mktcap: slice.company.mktcap,
    roe: slice.company.roe,
    netMargin: slice.company.netMargin,
    debtRatio: slice.company.debtRatio,
    pbRatio: slice.company.pbRatio,
    revenueGrowth: slice.company.revenueGrowth,
    fcf: slice.company.fcf,
    income: slice.incomeStatement,
    dividends: [...dividends.values()],
    series: slice.series,
    outlook: slice.outlook,
    universe,
    today,
  });
}
