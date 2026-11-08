import { resolveTechnicalPlan, type PriceBar, type TechnicalSetup } from "@/lib/analysis/technical-plan";
import { XOF_PER_EUR } from "@/lib/markets/fx";
import { isInvestorProfileComplete, riskPercentForProfile, type InvestorCriteria } from "./criteria";
import { amountToFcfa, ngnToFcfaDisplay } from "./fx";
import { assessLiquidity, type LiquidityAssessment } from "./liquidity";
import { concentrationLimits, weightBuckets, type ConcentrationLimits, type WeightBucket } from "./limits";
import {
  assessMarket,
  emptyMacroReadings,
  type IndexSeries,
  type MacroReading,
  type MarketAssessment,
} from "./market-regime";
import { sizePosition, type PositionSizePlan } from "./position-size";

export type ProposalAction = "ALLEGER" | "RENFORCER" | "CONSERVER" | "SORTIR" | "SURVEILLER";

export type ReasonCode =
  | "over_stock_limit"
  | "over_sector_limit"
  | "over_country_limit"
  | "over_market_limit"
  | "illiquid_exit"
  | "above_risk_budget"
  | "rr_weak"
  | "rr_strong"
  | "stop_breached"
  | "regime_risk_off"
  | "below_suggested"
  | "unit_risk_too_wide"
  | "plan_unavailable"
  | "fx_missing"
  | "liquidity_unknown"
  | "aligned";

export type CoherenceCode =
  | "profile_incomplete"
  | "horizon_vs_growth"
  | "rente_vs_aggressive_objective"
  | "age_vs_long_horizon"
  | "loss_vs_concentration"
  | "trading_vs_illiquid"
  | "declared_capital_below_portfolio"
  | "fx_incomplete"
  | "risk_off_low_tolerance";

export interface AnalysisHoldingInput {
  ticker: string;
  name: string;
  market: "BRVM" | "NGX";
  currency: "XOF" | "NGN";
  sector: string;
  country: string;
  quantity: number;
  /** Cours dans la devise du titre. Null si aucun cours canonique. */
  price: number | null;
  /** Clôtures ajustées des fractionnements — ATR / volatilité. */
  bars: PriceBar[];
  /** Clôture et volume publiés — liquidité. Défaut : `bars`. */
  liquidityBars?: PriceBar[];
  holdingStop: number | null;
  holdingTarget: number | null;
}

export interface MarketContext {
  series: { BRVM: IndexSeries[]; NGX: IndexSeries[] };
  breadth: { BRVM: Array<number | null>; NGX: Array<number | null> };
  /** Taux, inflation, change. Les cases sans série restent à value: null. */
  macros: MacroReading[];
  ngnPerEur: number | null;
  fxAsOf: string | null;
  fxSource: string | null;
}

export interface AnalysisInput {
  portfolioId: string;
  portfolioName: string;
  profile: InvestorCriteria;
  holdings: AnalysisHoldingInput[];
  setups: TechnicalSetup[];
  market: MarketContext;
}

export interface Proposal {
  ticker: string;
  name: string;
  action: ProposalAction;
  currentShares: number;
  suggestedShares: number | null;
  currentWeightPct: number | null;
  reasons: ReasonCode[];
}

export interface HoldingAnalysis {
  ticker: string;
  name: string;
  market: "BRVM" | "NGX";
  currency: "XOF" | "NGN";
  sector: string;
  country: string;
  quantity: number;
  priceNative: number | null;
  /** Conversion exacte, utilisée pour le risque. */
  priceFcfa: number | null;
  /** Arrondi entier pour le naira, identique à « Cours FCFA ». */
  displayPriceFcfa: number | null;
  valueFcfa: number | null;
  weightPct: number | null;
  liquidity: LiquidityAssessment;
  stopNative: number | null;
  targetNative: number | null;
  stopFcfa: number | null;
  targetFcfa: number | null;
  planSource: "technical" | "holding" | "atr" | "volatility" | "unavailable";
  riskReward: number | null;
  sizing: PositionSizePlan | null;
  proposal: Proposal;
}

export interface PortfolioAnalysis {
  portfolioId: string;
  portfolioName: string;
  capitalFcfa: number | null;
  portfolioValueFcfa: number | null;
  capitalSource: "portfolio" | "declared" | "unavailable";
  unconvertedTickers: string[];
  riskPercent: number;
  riskSource: "explicit" | "derived";
  limits: ConcentrationLimits;
  buckets: WeightBucket[];
  markets: { BRVM: MarketAssessment; NGX: MarketAssessment };
  macros: MacroReading[];
  fx: {
    ngnPerEur: number | null;
    xofPerNgn: number | null;
    asOf: string | null;
    source: string | null;
  };
  holdings: HoldingAnalysis[];
  proposals: Proposal[];
  coherence: CoherenceCode[];
}

const ACTION_RANK: Record<ProposalAction, number> = {
  SORTIR: 0,
  ALLEGER: 1,
  RENFORCER: 2,
  SURVEILLER: 3,
  CONSERVER: 4,
};

function unique(codes: ReasonCode[]): ReasonCode[] {
  return [...new Set(codes)];
}

function macroValue(macros: readonly MacroReading[], id: MacroReading["id"]): number | null {
  const value = macros.find((reading) => reading.id === id)?.value;
  return value == null || !Number.isFinite(value) ? null : value;
}

interface Draft {
  input: AnalysisHoldingInput;
  priceFcfa: number | null;
  displayPriceFcfa: number | null;
  valueFcfa: number | null;
  weightPct: number | null;
  liquidity: LiquidityAssessment;
  stopNative: number | null;
  targetNative: number | null;
  stopFcfa: number | null;
  targetFcfa: number | null;
  planSource: HoldingAnalysis["planSource"];
  riskReward: number | null;
  sizing: PositionSizePlan | null;
  reasons: ReasonCode[];
  recommended: number | null;
}

function floorShares(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value + 1e-9);
}

export function analyzePortfolio(input: AnalysisInput): PortfolioAnalysis {
  const { percent: riskPercent, source: riskSource } = riskPercentForProfile(input.profile);
  const limits = concentrationLimits(input.profile);
  const ngnPerEur = input.market.ngnPerEur;
  const xofPerNgn = ngnPerEur != null && ngnPerEur > 0 ? XOF_PER_EUR / ngnPerEur : null;

  const macros = (input.market.macros.length > 0 ? input.market.macros : emptyMacroReadings()).map((reading) => ({
    ...reading,
  }));
  const fxSlot = macros.find((reading) => reading.id === "xof_per_ngn");
  if (fxSlot && fxSlot.value == null && xofPerNgn != null) {
    fxSlot.value = xofPerNgn;
    fxSlot.asOf = input.market.fxAsOf;
    fxSlot.source = input.market.fxSource;
  }

  const setups = new Map(input.setups.map((setup) => [setup.ticker.toUpperCase(), setup]));
  const toFcfa = (currency: "XOF" | "NGN") => (amount: number) => amountToFcfa(amount, currency, ngnPerEur);

  const drafts: Draft[] = input.holdings.map((holding) => {
    const convert = toFcfa(holding.currency);
    const priceFcfa = holding.price == null ? null : convert(holding.price);
    const displayPriceFcfa =
      holding.price == null
        ? null
        : holding.currency === "NGN"
          ? ngnPerEur == null
            ? null
            : ngnToFcfaDisplay(holding.price, ngnPerEur)
          : holding.price;
    const plan =
      holding.price == null
        ? null
        : resolveTechnicalPlan({
            ticker: holding.ticker,
            entry: holding.price,
            setup: setups.get(holding.ticker.toUpperCase()) ?? null,
            holdingStop: holding.holdingStop,
            holdingTarget: holding.holdingTarget,
            bars: holding.bars,
          });
    const stopFcfa = plan?.stop == null ? null : convert(plan.stop);
    const targetFcfa = plan?.target == null ? null : convert(plan.target);
    const liquidity = assessLiquidity(holding.liquidityBars ?? holding.bars, convert);
    return {
      input: holding,
      priceFcfa,
      displayPriceFcfa,
      valueFcfa: priceFcfa != null ? priceFcfa * holding.quantity : null,
      weightPct: null,
      liquidity,
      stopNative: plan?.stop ?? null,
      targetNative: plan?.target ?? null,
      stopFcfa,
      targetFcfa,
      planSource: plan?.source ?? "unavailable",
      riskReward: null,
      sizing: null,
      reasons: [],
      recommended: null,
    };
  });

  const portfolioValueFcfa = drafts.reduce((sum, draft) => sum + (draft.valueFcfa != null && draft.valueFcfa > 0 ? draft.valueFcfa : 0), 0);
  const declared = input.profile.investableCapitalFcfa;
  let capitalFcfa: number | null = null;
  let capitalSource: PortfolioAnalysis["capitalSource"] = "unavailable";
  if (portfolioValueFcfa > 0) {
    capitalFcfa = portfolioValueFcfa;
    capitalSource = "portfolio";
  } else if (declared != null && declared > 0) {
    capitalFcfa = declared;
    capitalSource = "declared";
  }

  if (capitalFcfa != null && capitalFcfa > 0) {
    for (const draft of drafts) {
      if (draft.priceFcfa == null || !(draft.priceFcfa > 0)) continue;
      const sizing = sizePosition({
        capitalFcfa,
        riskPercent,
        entryFcfa: draft.priceFcfa,
        stopFcfa: draft.stopFcfa,
        targetFcfa: draft.targetFcfa,
        liquidityMaxShares: draft.liquidity.maxShares,
        stockLimitPct: limits.stockPct,
      });
      draft.sizing = sizing;
      draft.riskReward = sizing.riskReward;
      draft.recommended = sizing.suggestedShares;
    }
  }

  if (portfolioValueFcfa > 0) {
    for (const draft of drafts) {
      draft.weightPct = draft.valueFcfa != null ? (draft.valueFcfa / portfolioValueFcfa) * 100 : null;
    }
  }

  const valued = drafts.filter((draft) => draft.valueFcfa != null && draft.valueFcfa > 0);
  const buckets = weightBuckets({
    holdings: valued.map((draft) => ({
      ticker: draft.input.ticker,
      name: draft.input.name,
      sector: draft.input.sector,
      country: draft.input.country,
      market: draft.input.market,
      valueFcfa: draft.valueFcfa as number,
    })),
    limits,
  });

  trimGroup(drafts, portfolioValueFcfa, "sector", (draft) => draft.input.sector, limits.sectorPct, "over_sector_limit");
  trimGroup(drafts, portfolioValueFcfa, "country", (draft) => draft.input.country, limits.countryPct, "over_country_limit");
  trimGroup(drafts, portfolioValueFcfa, "market", (draft) => draft.input.market, limits.marketPct, "over_market_limit");

  const markets = {
    BRVM: assessMarket({
      market: "BRVM",
      series: input.market.series.BRVM,
      breadthChanges: input.market.breadth.BRVM,
      policyRate: macroValue(macros, "bceao_policy_rate"),
      inflation: macroValue(macros, "uemoa_inflation"),
    }),
    NGX: assessMarket({
      market: "NGX",
      series: input.market.series.NGX,
      breadthChanges: input.market.breadth.NGX,
      policyRate: macroValue(macros, "cbn_policy_rate"),
      inflation: macroValue(macros, "nigeria_inflation"),
    }),
  };

  for (const draft of drafts) {
    const regime = markets[draft.input.market].regime;
    if (
      capitalFcfa != null &&
      regime === "RISK_OFF" &&
      input.profile.lossTolerance !== "ELEVEE" &&
      draft.weightPct != null &&
      draft.weightPct > limits.stockPct * 0.75 &&
      draft.priceFcfa != null &&
      draft.priceFcfa > 0
    ) {
      const cap = floorShares(((limits.stockPct * 0.75) / 100) * capitalFcfa / draft.priceFcfa);
      draft.recommended = draft.recommended == null ? cap : Math.min(draft.recommended, cap);
      draft.reasons.push("regime_risk_off");
    }
  }

  const holdings: HoldingAnalysis[] = drafts.map((draft) => {
    const proposal = decide(draft, input.profile, limits, markets[draft.input.market].regime);
    return {
      ticker: draft.input.ticker,
      name: draft.input.name,
      market: draft.input.market,
      currency: draft.input.currency,
      sector: draft.input.sector,
      country: draft.input.country,
      quantity: draft.input.quantity,
      priceNative: draft.input.price,
      priceFcfa: draft.priceFcfa,
      displayPriceFcfa: draft.displayPriceFcfa,
      valueFcfa: draft.valueFcfa,
      weightPct: draft.weightPct,
      liquidity: draft.liquidity,
      stopNative: draft.stopNative,
      targetNative: draft.targetNative,
      stopFcfa: draft.stopFcfa,
      targetFcfa: draft.targetFcfa,
      planSource: draft.planSource,
      riskReward: draft.riskReward ?? draft.sizing?.riskReward ?? null,
      sizing: draft.sizing,
      proposal,
    };
  });

  holdings.sort((a, b) => (b.weightPct ?? -1) - (a.weightPct ?? -1) || a.ticker.localeCompare(b.ticker));
  const proposals = holdings
    .map((holding) => holding.proposal)
    .sort((a, b) => ACTION_RANK[a.action] - ACTION_RANK[b.action] || a.ticker.localeCompare(b.ticker));

  const unconvertedTickers = drafts
    .filter((draft) => draft.input.market === "NGX" && draft.input.price != null && draft.priceFcfa == null)
    .map((draft) => draft.input.ticker);

  const illiquidValue = drafts
    .filter((draft) => draft.liquidity.band === "ILLIQUIDE")
    .reduce((sum, draft) => sum + (draft.valueFcfa ?? 0), 0);

  const coherence: CoherenceCode[] = [];
  if (!isInvestorProfileComplete(input.profile)) coherence.push("profile_incomplete");
  if (input.profile.horizon === "MOINS_1_AN" && input.profile.portfolioType === "CROISSANCE") {
    coherence.push("horizon_vs_growth");
  }
  if (input.profile.portfolioType === "RENTE" && input.profile.objective === "CROISSANCE_AGRESSIVE") {
    coherence.push("rente_vs_aggressive_objective");
  }
  if (input.profile.age != null && input.profile.age >= 70 && input.profile.horizon === "PLUS_7_ANS") {
    coherence.push("age_vs_long_horizon");
  }
  if (input.profile.lossTolerance === "FAIBLE" && buckets.some((bucket) => bucket.above)) {
    coherence.push("loss_vs_concentration");
  }
  if (input.profile.portfolioType === "TRADING" && portfolioValueFcfa > 0 && illiquidValue / portfolioValueFcfa > 0.3) {
    coherence.push("trading_vs_illiquid");
  }
  if (
    declared != null &&
    declared > 0 &&
    portfolioValueFcfa > declared * 1.05
  ) {
    coherence.push("declared_capital_below_portfolio");
  }
  if (unconvertedTickers.length > 0) coherence.push("fx_incomplete");
  if (
    input.profile.lossTolerance === "FAIBLE" &&
    (markets.BRVM.regime === "RISK_OFF" || markets.NGX.regime === "RISK_OFF")
  ) {
    coherence.push("risk_off_low_tolerance");
  }

  return {
    portfolioId: input.portfolioId,
    portfolioName: input.portfolioName,
    capitalFcfa,
    portfolioValueFcfa: portfolioValueFcfa > 0 ? portfolioValueFcfa : null,
    capitalSource,
    unconvertedTickers,
    riskPercent,
    riskSource,
    limits,
    buckets,
    markets,
    macros,
    fx: {
      ngnPerEur,
      xofPerNgn,
      asOf: input.market.fxAsOf,
      source: input.market.fxSource,
    },
    holdings,
    proposals,
    coherence,
  };
}

function trimGroup(
  drafts: Draft[],
  total: number,
  _kind: "sector" | "country" | "market",
  keyOf: (draft: Draft) => string,
  limitPct: number,
  reason: ReasonCode
) {
  if (!(total > 0)) return;
  const groups = new Map<string, Draft[]>();
  for (const draft of drafts) {
    if (draft.valueFcfa == null || draft.valueFcfa <= 0) continue;
    const list = groups.get(keyOf(draft)) ?? [];
    list.push(draft);
    groups.set(keyOf(draft), list);
  }
  for (const list of groups.values()) {
    const value = list.reduce((sum, draft) => sum + (draft.valueFcfa ?? 0), 0);
    if ((value / total) * 100 <= limitPct + 1e-9) continue;
    const excess = value - (limitPct / 100) * total;
    const largest = [...list].sort(
      (a, b) => (b.valueFcfa ?? 0) - (a.valueFcfa ?? 0) || a.input.ticker.localeCompare(b.input.ticker)
    )[0];
    if (!largest?.priceFcfa || largest.priceFcfa <= 0) continue;
    const trimmed = Math.max(0, floorShares(largest.input.quantity - excess / largest.priceFcfa));
    largest.recommended = largest.recommended == null ? trimmed : Math.min(largest.recommended, trimmed);
    largest.reasons.push(reason);
  }
}

const SIZING_REASONS: ReasonCode[] = [
  "over_stock_limit",
  "over_sector_limit",
  "over_country_limit",
  "over_market_limit",
  "rr_weak",
  "unit_risk_too_wide",
  "regime_risk_off",
  "illiquid_exit",
];

function decide(
  draft: Draft,
  profile: InvestorCriteria,
  limits: ConcentrationLimits,
  regime: "RISK_ON" | "NEUTRE" | "RISK_OFF" | "INCONNU"
): Proposal {
  const quantity = draft.input.quantity;
  const base = {
    ticker: draft.input.ticker,
    name: draft.input.name,
    currentShares: quantity,
    currentWeightPct: draft.weightPct,
  };
  const price = draft.input.price;
  if (price != null && draft.stopNative != null && price <= draft.stopNative) {
    return { ...base, action: "SORTIR", suggestedShares: 0, reasons: ["stop_breached"] };
  }
  if (draft.input.market === "NGX" && draft.input.price != null && draft.priceFcfa == null) {
    return { ...base, action: "SURVEILLER", suggestedShares: null, reasons: ["fx_missing"] };
  }

  const reasons = [...draft.reasons];
  if (draft.liquidity.band === "ILLIQUIDE") reasons.push("illiquid_exit");
  if (draft.liquidity.band === "INCONNUE") reasons.push("liquidity_unknown");

  const sizing = draft.sizing;
  if (sizing?.sharesByRisk === 0) reasons.push("unit_risk_too_wide");
  if (sizing?.binding === "reward" && (sizing.riskReward ?? 1) < 1) reasons.push("rr_weak");
  if (draft.weightPct != null && draft.weightPct > limits.stockPct + 1e-9) reasons.push("over_stock_limit");

  if (sizing == null || sizing.suggestedShares == null) {
    if (!reasons.includes("fx_missing")) reasons.push("plan_unavailable");
    if (draft.recommended != null && quantity > draft.recommended + 1e-6) {
      return {
        ...base,
        action: "ALLEGER",
        suggestedShares: draft.recommended,
        reasons: unique(reasons),
      };
    }
    return { ...base, action: "SURVEILLER", suggestedShares: null, reasons: unique(reasons) };
  }

  const recommended = draft.recommended ?? sizing.suggestedShares;
  if (quantity > recommended + 1e-6) {
    if (!reasons.some((code) => SIZING_REASONS.includes(code))) reasons.push("above_risk_budget");
    return { ...base, action: "ALLEGER", suggestedShares: recommended, reasons: unique(reasons) };
  }

  const rr = sizing.riskReward;
  const canAdd =
    recommended >= quantity + 1 &&
    draft.liquidity.band !== "ILLIQUIDE" &&
    regime !== "RISK_OFF" &&
    (draft.weightPct == null || draft.weightPct < limits.stockPct) &&
    (rr == null || rr >= 1.5) &&
    (profile.lossTolerance !== "FAIBLE" || (rr != null && rr >= 2));

  if (canAdd) {
    reasons.push(rr != null && rr >= 1.5 ? "rr_strong" : "below_suggested");
    return { ...base, action: "RENFORCER", suggestedShares: recommended, reasons: unique(reasons) };
  }

  reasons.push("aligned");
  return { ...base, action: "CONSERVER", suggestedShares: quantity, reasons: unique(reasons) };
}
