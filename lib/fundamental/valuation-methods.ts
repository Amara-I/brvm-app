// Méthodes de valeur indicative propres à l'analyse fondamentale BRVM.
// N'appelle pas et ne modifie pas estimateFairValues (fiche NGX).
// Toute entrée absente, négative ou hors seuil reste hors calcul : rien n'est inventé.

import { median, PBR_NOT_SIGNIFICANT_ABOVE, type SectorStat } from "@/lib/ngx/valuation";

/** Au-delà de ce PER, le multiple est non significatif (bénéfice trop faible ou unité douteuse). */
export const PER_NOT_SIGNIFICANT_ABOVE = 100;

/** Au-delà de ce rendement (%), le dividende ou le cours est traité comme non significatif. */
export const YIELD_NOT_SIGNIFICANT_ABOVE = 25;

/** Au moins trois exercices clos pour une médiane de PER historique. */
export const HISTORICAL_PER_MIN_YEARS = 3;

/**
 * Écart minimal (points de rendement) entre le rendement sectoriel et la croissance
 * du dividende. En dessous, le modèle de Gordon explose et n'est pas affiché.
 */
export const DDM_MIN_SPREAD_POINTS = 0.5;

export type BrvmValueMethod = "SECTOR_PER" | "SECTOR_PBR" | "DIVIDEND_YIELD" | "DDM" | "HISTORICAL_PE";

export type MethodSkipReason =
  | "missing"
  | "outlierEps"
  | "negativeEps"
  | "noBook"
  | "notSignificant"
  | "growthAboveYield"
  | "thinHistory";

export interface MethodSkip {
  method: BrvmValueMethod;
  reason: MethodSkipReason;
}

export interface BrvmValueEstimate {
  method: BrvmValueMethod;
  value: number;
  /** Écart du cours par rapport à la valeur, en % (négatif = cours sous la valeur). */
  priceGapPercent: number;
  lowConfidence: boolean;
}

export type EpsBlock = "outlier" | "negative" | null;

function finite(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** PER exploitable pour une médiane ou une valorisation. null si absent, ≤ 0 ou > 100. */
export function usablePer(per: number | null | undefined): number | null {
  if (!finite(per) || per <= 0 || per > PER_NOT_SIGNIFICANT_ABOVE) return null;
  return per;
}

export function perIsOutlier(per: number | null | undefined): boolean {
  return finite(per) && per > PER_NOT_SIGNIFICANT_ABOVE;
}

/** Rendement en % exploitable : strictement positif et ≤ 25 %. */
export function usableYieldPercent(yieldPercent: number | null | undefined): number | null {
  if (!finite(yieldPercent) || yieldPercent <= 0 || yieldPercent > YIELD_NOT_SIGNIFICANT_ABOVE) return null;
  return yieldPercent;
}

export function usablePbr(pbr: number | null | undefined): number | null {
  if (!finite(pbr) || pbr <= 0 || pbr > PBR_NOT_SIGNIFICANT_ABOVE) return null;
  return pbr;
}

/**
 * Le BPA ne pilote une valeur indicative que s'il est strictement positif et que
 * le PER implicite (cours / BPA) ne dépasse pas 100. Sans cours, on ne peut pas
 * juger l'ordre de grandeur : le BPA n'est pas retenu.
 */
export function epsBlockForValuation(price: number | null, eps: number | null, netIncomeBn: number | null): EpsBlock {
  if (finite(netIncomeBn) && netIncomeBn < 0) return "negative";
  if (!finite(eps) || eps <= 0 || !finite(price) || price <= 0) return null;
  if (price / eps > PER_NOT_SIGNIFICANT_ABOVE) return "outlier";
  return null;
}

export interface HistoricalPerMedian {
  median: number;
  n: number;
  fromYear: number;
  toYear: number;
}

/**
 * Médiane des PER publiés des exercices clos (≤ dernier exercice de comptes).
 * Les PER ≤ 0 ou > 100 sont écartés. Moins de 3 exercices retenus → null.
 */
export function historicalPerMedian(
  rows: readonly { year: number; per: number | null }[],
  lastAccountsYear: number | null,
): HistoricalPerMedian | null {
  const byYear = new Map<number, number>();
  for (const row of rows) {
    if (!Number.isInteger(row.year)) continue;
    if (lastAccountsYear != null && row.year > lastAccountsYear) continue;
    const per = usablePer(row.per);
    if (per == null) continue;
    byYear.set(row.year, per);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  if (years.length < HISTORICAL_PER_MIN_YEARS) return null;
  const med = median(years.map((year) => byYear.get(year)!));
  if (med == null || med <= 0) return null;
  return { median: med, n: years.length, fromYear: years[0]!, toYear: years[years.length - 1]! };
}

export interface BrvmValuationInput {
  price: number | null;
  /** BPA retenu pour les méthodes. null si absent OU déjà écarté (voir epsBlock). */
  eps: number | null;
  epsBlock: EpsBlock;
  /** PBR publié exploitable (déjà filtré), ou null. */
  pbRatio: number | null;
  /** true si un PBR est enregistré mais hors seuil (négatif ou > 12). */
  pbNotSignificant: boolean;
  /** Dividende courant confirmé, en FCFA. */
  dps: number | null;
  /** Croissance annualisée du dividende, en %. */
  dividendCagrPercent: number | null;
  historicalPer: HistoricalPerMedian | null;
  sectorPer: SectorStat;
  sectorPbr: SectorStat;
  sectorYield: SectorStat;
}

function push(
  out: BrvmValueEstimate[],
  price: number,
  method: BrvmValueMethod,
  value: number | null,
  lowConfidence: boolean,
) {
  if (!finite(value) || value <= 0) return false;
  out.push({
    method,
    value,
    priceGapPercent: ((price - value) / value) * 100,
    lowConfidence,
  });
  return true;
}

/**
 * Jusqu'à cinq valeurs indicatives. Chaque méthode absente est listée dans
 * `skipped` avec la raison, pour que l'écran explique une méthode unique.
 */
export function estimateBrvmFairValues(input: BrvmValuationInput): {
  estimates: BrvmValueEstimate[];
  skipped: MethodSkip[];
} {
  const estimates: BrvmValueEstimate[] = [];
  const skipped: MethodSkip[] = [];
  const price = finite(input.price) && input.price > 0 ? input.price : null;

  const skip = (method: BrvmValueMethod, reason: MethodSkipReason) => {
    skipped.push({ method, reason });
  };

  if (price == null) {
    for (const method of ["SECTOR_PER", "SECTOR_PBR", "DIVIDEND_YIELD", "DDM", "HISTORICAL_PE"] as const) {
      skip(method, "missing");
    }
    return { estimates, skipped };
  }

  if (input.epsBlock === "outlier") skip("SECTOR_PER", "outlierEps");
  else if (input.epsBlock === "negative") skip("SECTOR_PER", "negativeEps");
  else if (!finite(input.eps) || input.eps <= 0 || input.sectorPer.median == null || input.sectorPer.median <= 0) {
    skip("SECTOR_PER", "missing");
  } else if (!push(estimates, price, "SECTOR_PER", input.eps * input.sectorPer.median, input.sectorPer.lowConfidence)) {
    skip("SECTOR_PER", "missing");
  }

  if (input.pbNotSignificant) skip("SECTOR_PBR", "notSignificant");
  else if (!finite(input.pbRatio) || input.pbRatio <= 0) skip("SECTOR_PBR", "noBook");
  else if (input.sectorPbr.median == null || input.sectorPbr.median <= 0) skip("SECTOR_PBR", "missing");
  else {
    const bvps = price / input.pbRatio;
    if (!push(estimates, price, "SECTOR_PBR", bvps * input.sectorPbr.median, input.sectorPbr.lowConfidence)) {
      skip("SECTOR_PBR", "missing");
    }
  }

  const yieldMedian = input.sectorYield.median;
  if (!finite(input.dps) || input.dps <= 0 || yieldMedian == null || yieldMedian <= 0) {
    skip("DIVIDEND_YIELD", "missing");
  } else if (!push(estimates, price, "DIVIDEND_YIELD", input.dps / (yieldMedian / 100), input.sectorYield.lowConfidence)) {
    skip("DIVIDEND_YIELD", "missing");
  }

  const gPct = input.dividendCagrPercent;
  if (!finite(input.dps) || input.dps <= 0 || !finite(gPct) || gPct <= 0 || yieldMedian == null || yieldMedian <= 0) {
    skip("DDM", "missing");
  } else {
    const g = gPct / 100;
    const k = yieldMedian / 100;
    if (g >= k - DDM_MIN_SPREAD_POINTS / 100) skip("DDM", "growthAboveYield");
    else if (!push(estimates, price, "DDM", (input.dps * (1 + g)) / (k - g), input.sectorYield.lowConfidence)) {
      skip("DDM", "missing");
    }
  }

  if (input.epsBlock === "outlier") skip("HISTORICAL_PE", "outlierEps");
  else if (input.epsBlock === "negative") skip("HISTORICAL_PE", "negativeEps");
  else if (!finite(input.eps) || input.eps <= 0) skip("HISTORICAL_PE", "missing");
  else if (input.historicalPer == null) skip("HISTORICAL_PE", "thinHistory");
  else if (!push(estimates, price, "HISTORICAL_PE", input.historicalPer.median * input.eps, false)) {
    skip("HISTORICAL_PE", "missing");
  }

  return { estimates, skipped };
}

export type ValuationRangeMode = "none" | "single" | "range";

export function valuationRangeMode(methodCount: number): ValuationRangeMode {
  if (methodCount <= 0) return "none";
  if (methodCount === 1) return "single";
  return "range";
}
