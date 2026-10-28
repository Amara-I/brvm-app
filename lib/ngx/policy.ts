// Conclusion par politique d'investissement (section 8) — règles explicites et chiffrées.
// Chaque critère renvoie un statut et la valeur mesurée ; l'interface affiche libellé + seuil.
// Aucune phrase n'est « rédigée » : c'est une lecture de règles, pas un conseil d'investissement.

import type { PortfolioTypeId } from "@/lib/portfolio-types/constants";
import { PORTFOLIO_TYPE_IDS } from "@/lib/portfolio-types/constants";
import type { PriceStats } from "./price-stats";
import type { ValuationVerdict } from "./valuation";

export type CriterionStatus = "OK" | "NEUTRAL" | "KO" | "ND";
export type PolicyVerdict = "FAVORABLE" | "MIXED" | "UNFAVORABLE" | "INSUFFICIENT";

export type CriterionKey =
  | "revenueGrowth"
  | "earningsGrowth"
  | "profitability"
  | "earningsConsistency"
  | "valuation"
  | "dividendYield"
  | "dividendRegularity"
  | "payout"
  | "dividendGrowth"
  | "trend"
  | "momentum3m"
  | "momentum1y"
  | "liquidity"
  | "volatility"
  | "drawdown";

export interface PolicyCriterion {
  key: CriterionKey;
  status: CriterionStatus;
  /** Valeur mesurée (en % sauf mention contraire) ; null si non disponible. */
  value: number | null;
  /** Seuil « favorable » pour affichage. */
  threshold: number | null;
}

export interface PolicyConclusion {
  type: PortfolioTypeId;
  verdict: PolicyVerdict;
  criteria: PolicyCriterion[];
  evaluated: number;
  okCount: number;
}

export interface PolicyFacts {
  revenueCagrPercent: number | null;
  /** Écart d'années utilisé pour les CAGR. */
  growthSpanYears: number;
  netIncomeCagrPercent: number | null;
  latestNetIncomeBn: number | null;
  roePercent: number | null;
  /** Exercices à résultat net > 0 sur les 5 derniers exercices connus / nombre d'exercices connus (max 5). */
  profitableYears: number;
  knownYears: number;
  valuationVerdict: ValuationVerdict;
  dividendYieldPercent: number | null;
  dividendYearsPaid: number | null;
  dividendWindow: number;
  payoutPercent: number | null;
  /** DPS le plus récent ≥ DPS le plus ancien sur ≥ 3 exercices : ratio en % de variation. */
  dividendGrowthPercent: number | null;
  price: PriceStats;
}

/** Seuils indicatifs. Ils sont affichés tels quels sur la fiche. */
export const POLICY_THRESHOLDS = {
  growth: { revenueCagr: 10, earningsCagr: 10, roe: 15, roeLow: 8 },
  rente: {
    yieldHigh: 7,
    yieldLow: 3.5,
    regularityHigh: 4,
    regularityLow: 2,
    payoutOk: 70,
    payoutMax: 100,
  },
  trading: {
    liquidityOk: 100_000_000,
    liquidityLow: 10_000_000,
    tradedRatio: 0.8,
    momentum3m: 0,
    momentumFloor: -5,
    volMin: 15,
    volMax: 60,
  },
  max: {
    revenueCagr: 20,
    earningsCagr: 20,
    momentum1y: 25,
    drawdownOk: 25,
    drawdownMax: 45,
  },
} as const;

const nd = (key: CriterionKey, threshold: number | null = null): PolicyCriterion => ({
  key,
  status: "ND",
  value: null,
  threshold,
});

function graded(
  key: CriterionKey,
  value: number | null,
  okAt: number,
  neutralAt: number,
  higherIsBetter = true,
): PolicyCriterion {
  if (value == null || !Number.isFinite(value)) return nd(key, okAt);
  const ok = higherIsBetter ? value >= okAt : value <= okAt;
  const neutral = higherIsBetter ? value >= neutralAt : value <= neutralAt;
  return {
    key,
    value,
    threshold: okAt,
    status: ok ? "OK" : neutral ? "NEUTRAL" : "KO",
  };
}

function cagrCriterion(key: CriterionKey, cagr: number | null, latestPositive: boolean, okAt: number): PolicyCriterion {
  // Dernier résultat ≤ 0 : la croissance ne se mesure pas, le critère est négatif.
  if (!latestPositive) return { key, value: cagr, threshold: okAt, status: "KO" };
  return graded(key, cagr, okAt, 0);
}

function valuationCriterion(verdict: ValuationVerdict): PolicyCriterion {
  if (verdict === "UNKNOWN") return nd("valuation");
  return {
    key: "valuation",
    value: null,
    threshold: null,
    status: verdict === "BELOW" ? "OK" : verdict === "WITHIN" ? "NEUTRAL" : "KO",
  };
}

function consistency(facts: PolicyFacts): PolicyCriterion {
  if (facts.knownYears < 3) return nd("earningsConsistency", 100);
  const ratio = (facts.profitableYears / facts.knownYears) * 100;
  return {
    key: "earningsConsistency",
    value: ratio,
    threshold: 100,
    status: ratio >= 100 ? "OK" : ratio >= 60 ? "NEUTRAL" : "KO",
  };
}

function liquidity(price: PriceStats): PolicyCriterion {
  const t = POLICY_THRESHOLDS.trading;
  const v = price.avgDailyValueNgn;
  if (v == null || price.tradedSessionsRatio == null) return nd("liquidity", t.liquidityOk);
  const active = price.tradedSessionsRatio >= t.tradedRatio;
  return {
    key: "liquidity",
    value: v,
    threshold: t.liquidityOk,
    status:
      v >= t.liquidityOk && active ? "OK" : v >= t.liquidityLow && price.tradedSessionsRatio >= 0.5 ? "NEUTRAL" : "KO",
  };
}

function trend(price: PriceStats): PolicyCriterion {
  const { lastClose, sma50, sma200 } = price;
  if (lastClose == null || sma50 == null) return nd("trend");
  const above50 = lastClose > sma50;
  if (sma200 == null)
    return {
      key: "trend",
      value: null,
      threshold: null,
      status: above50 ? "NEUTRAL" : "KO",
    };
  const status: CriterionStatus = above50 && sma50 > sma200 ? "OK" : above50 || lastClose > sma200 ? "NEUTRAL" : "KO";
  return { key: "trend", value: null, threshold: null, status };
}

function evaluate(type: PortfolioTypeId, criteria: PolicyCriterion[]): PolicyConclusion {
  const scored = criteria.filter((c) => c.status !== "ND");
  const points = scored.reduce((s, c) => s + (c.status === "OK" ? 1 : c.status === "NEUTRAL" ? 0.5 : 0), 0);
  const okCount = scored.filter((c) => c.status === "OK").length;
  let verdict: PolicyVerdict = "INSUFFICIENT";
  if (scored.length >= 3) {
    const ratio = points / scored.length;
    verdict = ratio >= 0.7 ? "FAVORABLE" : ratio <= 0.35 ? "UNFAVORABLE" : "MIXED";
  }
  return { type, verdict, criteria, evaluated: scored.length, okCount };
}

export function concludeForPolicy(type: PortfolioTypeId, f: PolicyFacts): PolicyConclusion {
  const T = POLICY_THRESHOLDS;
  const earningsPositive = f.latestNetIncomeBn != null && f.latestNetIncomeBn > 0;
  switch (type) {
    case "CROISSANCE":
      return evaluate(type, [
        graded("revenueGrowth", f.revenueCagrPercent, T.growth.revenueCagr, 0),
        f.latestNetIncomeBn == null
          ? nd("earningsGrowth", T.growth.earningsCagr)
          : cagrCriterion("earningsGrowth", f.netIncomeCagrPercent, earningsPositive, T.growth.earningsCagr),
        graded("profitability", f.roePercent, T.growth.roe, T.growth.roeLow),
        consistency(f),
        valuationCriterion(f.valuationVerdict),
      ]);
    case "RENTE": {
      const regularity =
        f.dividendYearsPaid == null
          ? nd("dividendRegularity", T.rente.regularityHigh)
          : graded("dividendRegularity", f.dividendYearsPaid, T.rente.regularityHigh, T.rente.regularityLow);
      return evaluate(type, [
        graded("dividendYield", f.dividendYieldPercent, T.rente.yieldHigh, T.rente.yieldLow),
        regularity,
        graded("payout", f.payoutPercent, T.rente.payoutOk, T.rente.payoutMax, false),
        graded("dividendGrowth", f.dividendGrowthPercent, 0, -20),
        consistency(f),
      ]);
    }
    case "TRADING": {
      const vol = f.price.volatilityPercent;
      const volatility: PolicyCriterion =
        vol == null
          ? nd("volatility")
          : {
              key: "volatility",
              value: vol,
              threshold: T.trading.volMax,
              status: vol >= T.trading.volMin && vol <= T.trading.volMax ? "OK" : "NEUTRAL",
            };
      return evaluate(type, [
        trend(f.price),
        graded("momentum3m", f.price.return3mPercent, T.trading.momentum3m, T.trading.momentumFloor),
        liquidity(f.price),
        volatility,
      ]);
    }
    case "CROISSANCE_MAX":
      return evaluate(type, [
        graded("revenueGrowth", f.revenueCagrPercent, T.max.revenueCagr, T.growth.revenueCagr),
        f.latestNetIncomeBn == null
          ? nd("earningsGrowth", T.max.earningsCagr)
          : cagrCriterion("earningsGrowth", f.netIncomeCagrPercent, earningsPositive, T.max.earningsCagr),
        graded("momentum1y", f.price.return1yPercent, T.max.momentum1y, 0),
        graded("drawdown", f.price.drawdownFromHighPercent, T.max.drawdownOk, T.max.drawdownMax, false),
        liquidity(f.price),
        valuationCriterion(f.valuationVerdict),
      ]);
  }
}

export function concludeAllPolicies(f: PolicyFacts): PolicyConclusion[] {
  return PORTFOLIO_TYPE_IDS.map((t) => concludeForPolicy(t, f));
}
