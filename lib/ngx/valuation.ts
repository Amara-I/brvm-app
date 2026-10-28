// Calculs de valorisation NGX — fonctions pures, testées (valuation.test.ts).
// Les ratios sont calculés dans l'application à partir du cours et des comptes publiés :
// aucune valeur n'est lue d'un site tiers. Toute donnée manquante donne null.

import type { NgxFinancialYear } from "./fundamentals";

const BN = 1e9;

function finite(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function median(values: readonly number[]): number | null {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** BPA en ₦ à partir du résultat net (milliards de ₦) et du nombre de titres. */
export function earningsPerShare(netIncomeBn: number | null, shares: number | null): number | null {
  if (!finite(netIncomeBn) || !finite(shares) || shares <= 0) return null;
  return (netIncomeBn * BN) / shares;
}

/** Actif net par action en ₦ à partir des capitaux propres (milliards de ₦). */
export function bookValuePerShare(equityBn: number | null, shares: number | null): number | null {
  if (!finite(equityBn) || !finite(shares) || shares <= 0) return null;
  return (equityBn * BN) / shares;
}

/** PER = cours / BPA. Non significatif (null) si le bénéfice est nul ou négatif. */
export function priceToEarnings(price: number | null, eps: number | null): number | null {
  if (!finite(price) || !finite(eps) || price <= 0 || eps <= 0) return null;
  return price / eps;
}

/** PBR = cours / actif net par action. Non significatif si les capitaux propres sont ≤ 0. */
export function priceToBook(price: number | null, bvps: number | null): number | null {
  if (!finite(price) || !finite(bvps) || price <= 0 || bvps <= 0) return null;
  return price / bvps;
}

/** Rendement du dividende en % = dividende par action / cours. */
export function dividendYieldPercent(dps: number | null, price: number | null): number | null {
  if (!finite(dps) || !finite(price) || price <= 0 || dps < 0) return null;
  return (dps / price) * 100;
}

/** Taux de distribution en % = dividende par action / BPA (null si BPA ≤ 0). */
export function payoutPercent(dps: number | null, eps: number | null): number | null {
  if (!finite(dps) || !finite(eps) || eps <= 0 || dps < 0) return null;
  return (dps / eps) * 100;
}

/** Capitalisation en milliards de ₦ = cours × titres. */
export function marketCapBn(price: number | null, shares: number | null): number | null {
  if (!finite(price) || !finite(shares) || price <= 0 || shares <= 0) return null;
  return (price * shares) / BN;
}

/** ROE en % = résultat net / capitaux propres (fin de période). */
export function returnOnEquityPercent(netIncomeBn: number | null, equityBn: number | null): number | null {
  if (!finite(netIncomeBn) || !finite(equityBn) || equityBn <= 0) return null;
  return (netIncomeBn / equityBn) * 100;
}

export function marginPercent(numeratorBn: number | null, revenueBn: number | null): number | null {
  if (!finite(numeratorBn) || !finite(revenueBn) || revenueBn <= 0) return null;
  return (numeratorBn / revenueBn) * 100;
}

/** Croissance annuelle composée en % — exige deux bornes strictement positives. */
export function cagrPercent(first: number | null, last: number | null, years: number): number | null {
  if (!finite(first) || !finite(last) || first <= 0 || last <= 0 || !(years > 0)) return null;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

export function growthPercent(previous: number | null, current: number | null): number | null {
  if (!finite(previous) || !finite(current) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** CAGR d'une série annuelle sur la première et la dernière année exploitables (≥ 3 ans d'écart conseillé). */
export function seriesCagrPercent(
  years: readonly NgxFinancialYear[],
  pick: (y: NgxFinancialYear) => number | null,
): {
  cagr: number | null;
  fromYear: number | null;
  toYear: number | null;
  span: number;
} {
  const pts = years.map((y) => ({ year: y.year, v: pick(y) })).filter((p) => finite(p.v));
  if (pts.length < 2) return { cagr: null, fromYear: null, toYear: null, span: 0 };
  const first = pts[0];
  const last = pts[pts.length - 1];
  const span = last.year - first.year;
  return {
    cagr: cagrPercent(first.v, last.v, span),
    fromYear: first.year,
    toYear: last.year,
    span,
  };
}

// ───────────── Médianes sectorielles ─────────────

export const SECTOR_MIN_PEERS = 4;

export interface SectorStat {
  median: number | null;
  /** Nombre de sociétés comparables ayant la donnée. */
  n: number;
  /** Moins de SECTOR_MIN_PEERS sociétés : médiane indicative seulement. */
  lowConfidence: boolean;
}

export function sectorStat(values: ReadonlyArray<number | null | undefined>): SectorStat {
  const v = values.filter((x): x is number => finite(x));
  return {
    median: median(v),
    n: v.length,
    lowConfidence: v.length < SECTOR_MIN_PEERS,
  };
}

/** Écart relatif en % de `value` par rapport à `reference` ; null si non calculable. */
export function relativeGapPercent(value: number | null, reference: number | null): number | null {
  if (!finite(value) || !finite(reference) || reference === 0) return null;
  return ((value - reference) / Math.abs(reference)) * 100;
}

// ───────────── Valeur indicative (section 5) ─────────────

export type FairValueMethod = "SECTOR_PER" | "SECTOR_PBR" | "GRAHAM";

export interface FairValueEstimate {
  method: FairValueMethod;
  /** Valeur indicative par action en ₦. */
  value: number;
  /** Écart du cours actuel par rapport à cette valeur, en % (négatif = cours sous la valeur). */
  priceGapPercent: number;
  /** Hypothèse sectorielle faible (< 4 sociétés). */
  lowConfidence: boolean;
}

/** Nombre de Graham : racine de 22,5 × BPA × actif net par action (formule publique, indicative). */
export function grahamNumber(eps: number | null, bvps: number | null): number | null {
  if (!finite(eps) || !finite(bvps) || eps <= 0 || bvps <= 0) return null;
  return Math.sqrt(22.5 * eps * bvps);
}

export function estimateFairValues(input: {
  price: number | null;
  eps: number | null;
  bvps: number | null;
  sectorPer: SectorStat;
  sectorPbr: SectorStat;
}): FairValueEstimate[] {
  const { price, eps, bvps, sectorPer, sectorPbr } = input;
  if (!finite(price) || price <= 0) return [];
  const out: FairValueEstimate[] = [];
  const push = (method: FairValueMethod, value: number | null, lowConfidence: boolean) => {
    if (!finite(value) || value <= 0) return;
    out.push({
      method,
      value,
      priceGapPercent: ((price - value) / value) * 100,
      lowConfidence,
    });
  };
  if (finite(eps) && eps > 0 && sectorPer.median != null && sectorPer.median > 0) {
    push("SECTOR_PER", eps * sectorPer.median, sectorPer.lowConfidence);
  }
  if (finite(bvps) && bvps > 0 && sectorPbr.median != null && sectorPbr.median > 0) {
    push("SECTOR_PBR", bvps * sectorPbr.median, sectorPbr.lowConfidence);
  }
  push("GRAHAM", grahamNumber(eps, bvps), false);
  return out;
}

export type ValuationVerdict = "BELOW" | "WITHIN" | "ABOVE" | "UNKNOWN";

/** Marge de ±15 % autour de la fourchette de valeurs indicatives. */
export const VALUATION_BAND_PERCENT = 15;

export interface ValuationSummary {
  verdict: ValuationVerdict;
  low: number | null;
  high: number | null;
  mid: number | null;
  /** Écart du cours par rapport à la valeur médiane des estimations. */
  gapToMidPercent: number | null;
  methods: number;
}

export function summarizeValuation(price: number | null, estimates: readonly FairValueEstimate[]): ValuationSummary {
  if (!finite(price) || estimates.length === 0) {
    return {
      verdict: "UNKNOWN",
      low: null,
      high: null,
      mid: null,
      gapToMidPercent: null,
      methods: 0,
    };
  }
  const values = estimates.map((e) => e.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const mid = median(values);
  const lowEdge = low * (1 - VALUATION_BAND_PERCENT / 100);
  const highEdge = high * (1 + VALUATION_BAND_PERCENT / 100);
  const verdict: ValuationVerdict = price < lowEdge ? "BELOW" : price > highEdge ? "ABOVE" : "WITHIN";
  return {
    verdict,
    low,
    high,
    mid,
    gapToMidPercent: mid ? ((price - mid) / mid) * 100 : null,
    methods: estimates.length,
  };
}

// ───────────── Dividendes ─────────────

export interface DividendYearLike {
  year: number;
  amount: number;
}

/**
 * Exercices avec dividende > 0 parmi les `window` derniers exercices connus de la société.
 * `known` = exercices de la fenêtre pour lesquels une ligne DPS existe (montant 0 compris) :
 * un exercice sans ligne est « non confirmé », il n'est jamais compté comme « sans dividende ».
 */
export function dividendYearsPaid(
  dividends: readonly DividendYearLike[],
  lastYear: number,
  window = 5,
): { paid: number; window: number; known: number } {
  const recorded = new Set(dividends.map((d) => d.year));
  const set = new Set(dividends.filter((d) => d.amount > 0).map((d) => d.year));
  let paid = 0;
  let known = 0;
  for (let y = lastYear - window + 1; y <= lastYear; y += 1) {
    if (set.has(y)) paid += 1;
    if (recorded.has(y)) known += 1;
  }
  return { paid, window, known };
}
