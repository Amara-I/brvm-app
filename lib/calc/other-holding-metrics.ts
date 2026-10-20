// Valorisation des obligations et FCP — fonction pure, sans cours inventé.
//
// Action : inchangée (computePortfolioMetrics).
// Obligation : dernier prix saisi s'il existe, sinon prix d'achat.
//   FCFA = prix unitaire. PERCENT = % du nominal (nominal requis, sinon N/D).
// FCP : dernière VL saisie, sinon VL d'achat. Toujours en FCFA par part.
// Coupon couru : seulement si taux, nominal, quantité et date d'achat sont
// connus. Base 365 jours depuis l'achat, plafonné à l'échéance. Jamais ajouté
// à la valeur de marché (on ne sait pas si le prix est pied de coupon).

import { roundMoney } from "@/lib/api/portfolio-trades";

export type OtherInstrumentKind = "OBLIGATION" | "FCP";
export type OtherPriceMode = "FCFA" | "PERCENT";

export type OtherHoldingInput = {
  id?: string;
  kind: OtherInstrumentKind;
  name: string;
  isin?: string | null;
  code?: string | null;
  manager?: string | null;
  quantity: number;
  avgBuyPrice: number;
  priceMode?: OtherPriceMode | null;
  nominal?: number | null;
  couponRate?: number | null;
  maturityDate?: string | null;
  buyDate?: string | null;
  latestValue?: number | null;
  latestValueDate?: string | null;
};

export type OtherValueBasis = "latest" | "purchase" | "unavailable";

export type OtherHoldingMetrics = {
  id?: string;
  kind: OtherInstrumentKind;
  name: string;
  isin: string | null;
  code: string | null;
  manager: string | null;
  quantity: number;
  avgBuyPrice: number;
  priceMode: OtherPriceMode;
  nominal: number | null;
  couponRate: number | null;
  maturityDate: string | null;
  buyDate: string | null;
  latestValue: number | null;
  latestValueDate: string | null;
  marketValue: number | "N/D";
  costBasis: number | "N/D";
  gainLoss: number | "N/D";
  gainLossPercent: number | "N/D";
  valueBasis: OtherValueBasis;
  valueBasisLabel: string;
  accruedCoupon: number | "N/D";
  accruedCouponLabel: string;
};

export const ACCRUED_COUPON_LABEL =
  "Coupon couru depuis l'achat (base 365 j, sans calendrier de détachement)";

export type AssetTypeSlice = {
  type: "Actions" | "Obligations" | "FCP";
  value: number;
  weightPercent: number;
};

export type PortfolioHeadline = {
  totalMarketValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number | "N/D";
  assetTypeBreakdown: AssetTypeSlice[];
};

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcDays(startYmd: string, endYmd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(endYmd)) return null;
  const start = Date.parse(`${startYmd}T00:00:00Z`);
  const end = Date.parse(`${endYmd}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

/** Convertit un prix unitaire en montant. `null` si l'unité ne se convertit pas. */
function amountFromUnit(
  kind: OtherInstrumentKind,
  quantity: number,
  unit: number,
  mode: OtherPriceMode,
  nominal: number | null
): number | null {
  if (!(quantity > 0) || !(unit > 0)) return null;
  if (kind === "FCP" || mode === "FCFA") return quantity * unit;
  if (nominal != null && nominal > 0) return quantity * nominal * (unit / 100);
  return null;
}

function basisLabel(kind: OtherInstrumentKind, mode: OtherPriceMode, basis: "latest" | "purchase"): string {
  if (kind === "FCP") return basis === "latest" ? "VL saisie" : "VL d'achat";
  if (mode === "PERCENT") {
    return basis === "latest" ? "Dernier prix connu (% du nominal)" : "Prix d'achat (% du nominal)";
  }
  return basis === "latest" ? "Dernier prix connu" : "Prix d'achat";
}

export function valueOtherHolding(input: OtherHoldingInput, asOf: string = utcToday()): OtherHoldingMetrics {
  const mode: OtherPriceMode = input.kind === "FCP" ? "FCFA" : input.priceMode === "PERCENT" ? "PERCENT" : "FCFA";
  const nominal = input.nominal != null && input.nominal > 0 ? input.nominal : null;
  const latest = input.latestValue != null && input.latestValue > 0 ? input.latestValue : null;

  let market: number | null = null;
  let valueBasis: OtherValueBasis = "unavailable";
  let valueBasisLabel = "N/D";

  if (latest != null) {
    market = amountFromUnit(input.kind, input.quantity, latest, mode, nominal);
    if (market != null) {
      valueBasis = "latest";
      valueBasisLabel = basisLabel(input.kind, mode, "latest");
    }
  }
  if (market == null && input.avgBuyPrice > 0) {
    market = amountFromUnit(input.kind, input.quantity, input.avgBuyPrice, mode, nominal);
    if (market != null) {
      valueBasis = "purchase";
      valueBasisLabel = basisLabel(input.kind, mode, "purchase");
    }
  }

  const cost = input.avgBuyPrice > 0 ? amountFromUnit(input.kind, input.quantity, input.avgBuyPrice, mode, nominal) : null;
  const marketValue = market == null ? ("N/D" as const) : roundMoney(market);
  const costBasis = cost == null ? ("N/D" as const) : roundMoney(cost);
  const gainLoss =
    typeof marketValue === "number" && typeof costBasis === "number" ? roundMoney(marketValue - costBasis) : ("N/D" as const);
  const gainLossPercent =
    typeof gainLoss === "number" && typeof costBasis === "number" && costBasis > 0
      ? roundPercent((gainLoss / costBasis) * 100)
      : ("N/D" as const);

  let accruedCoupon: number | "N/D" = "N/D";
  let accruedCouponLabel = "N/D";
  if (
    input.kind === "OBLIGATION" &&
    input.couponRate != null &&
    input.couponRate >= 0 &&
    nominal != null &&
    input.quantity > 0 &&
    input.buyDate
  ) {
    let end = asOf;
    if (input.maturityDate && /^\d{4}-\d{2}-\d{2}$/.test(input.maturityDate) && input.maturityDate < end) {
      end = input.maturityDate;
    }
    const days = utcDays(input.buyDate, end);
    if (days != null && days >= 0) {
      accruedCoupon = roundMoney(input.quantity * nominal * (input.couponRate / 100) * (days / 365));
      accruedCouponLabel = ACCRUED_COUPON_LABEL;
    }
  }

  return {
    id: input.id,
    kind: input.kind,
    name: input.name,
    isin: input.isin ?? null,
    code: input.code ?? null,
    manager: input.manager ?? null,
    quantity: input.quantity,
    avgBuyPrice: input.avgBuyPrice,
    priceMode: mode,
    nominal,
    couponRate: input.couponRate ?? null,
    maturityDate: input.maturityDate ?? null,
    buyDate: input.buyDate ?? null,
    latestValue: latest,
    latestValueDate: input.latestValueDate ?? null,
    marketValue,
    costBasis,
    gainLoss,
    gainLossPercent,
    valueBasis,
    valueBasisLabel,
    accruedCoupon,
    accruedCouponLabel,
  };
}

export function valueOtherHoldings(rows: readonly OtherHoldingInput[], asOf?: string): OtherHoldingMetrics[] {
  return rows.map((row) => valueOtherHolding(row, asOf));
}

/** Total affiché = actions (inchangées) + obligations / FCP valorisées. */
export function combinePortfolioHeadline(
  stock: { totalMarketValue: number; totalCostBasis: number; totalGainLoss: number },
  others: readonly OtherHoldingMetrics[]
): PortfolioHeadline {
  let otherMarket = 0;
  let otherCost = 0;
  let otherGain = 0;
  let obligations = 0;
  let funds = 0;
  for (const row of others) {
    if (typeof row.marketValue !== "number") continue;
    otherMarket += row.marketValue;
    if (row.kind === "OBLIGATION") obligations += row.marketValue;
    else funds += row.marketValue;
    if (typeof row.costBasis === "number") otherCost += row.costBasis;
    if (typeof row.gainLoss === "number") otherGain += row.gainLoss;
  }

  const totalMarketValue = stock.totalMarketValue + otherMarket;
  const totalGainLoss = stock.totalGainLoss + otherGain;
  const totalCost = stock.totalCostBasis + otherCost;
  const totalGainLossPercent = totalCost > 0 ? roundPercent((totalGainLoss / totalCost) * 100) : ("N/D" as const);

  const slices: Array<{ type: AssetTypeSlice["type"]; value: number }> = [
    { type: "Actions", value: stock.totalMarketValue },
    { type: "Obligations", value: obligations },
    { type: "FCP", value: funds },
  ];
  const assetTypeBreakdown: AssetTypeSlice[] = slices
    .filter((slice) => slice.value > 0)
    .map((slice) => ({
      type: slice.type,
      value: slice.value,
      weightPercent: totalMarketValue > 0 ? roundPercent((slice.value / totalMarketValue) * 100) : 0,
    }));

  return { totalMarketValue, totalGainLoss, totalGainLossPercent, assetTypeBreakdown };
}
