// Fiche NGX → entrée de l'analyse fondamentale partagée (lib/fundamental/brvm-analysis.ts).
// Même onglet, mêmes 8 étapes et mêmes règles que la BRVM, avec les données NGX telles
// qu'enregistrées : montants en nairas, pairs = sociétés NGX du même groupe sectoriel.
// Aucune lecture base ici et aucune valeur inventée : une donnée absente reste null (N/D).

import type { PricePoint } from "@/lib/ngx/price-stats";
import { computeCompanyMetrics, type CompanyInput, type CompanyMetrics, type NgxSheetModel } from "@/lib/ngx/sheet-model";
import { cleanNgxName, ngxSectorGroup } from "@/lib/ngx/sectors";
import { returnOnEquityPercent } from "@/lib/ngx/valuation";
import { ngnPerReportingUnit, parseNgxProfileMeta, type NgxFinancialYear } from "@/lib/ngx/fundamentals";
import type { AnnualRatioPoint } from "./ratio-history";
import {
  buildBrvmFundamentalAnalysis,
  type BrvmFundamentalAnalysis,
  type BrvmFundamentalInput,
  type BrvmPeerSnapshot,
} from "./brvm-analysis";

function finite(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Dernier dividende enregistré (ligne canonique d'abord). null = aucune ligne. */
export function latestNgxDividend(rows: CompanyInput["dividends"]): number | null {
  const sorted = rows
    .filter((d) => Number.isInteger(d.year) && finite(d.amount))
    .sort((a, b) => b.year - a.year || Number(b.isCanonical) - Number(a.isCanonical));
  return sorted[0]?.amount ?? null;
}

/** Dernière clôture de chaque année (rendement historique du graphique des dividendes). */
export function yearEndPrices(series: readonly PricePoint[]): Record<number, number> {
  const prices: Record<number, number> = {};
  const sorted = series
    .filter((p) => p.value > 0 && /^\d{4}-\d{2}-\d{2}/.test(p.time))
    .sort((a, b) => (a.time < b.time ? -1 : 1));
  for (const p of sorted) prices[Number(p.time.slice(0, 4))] = p.value;
  return prices;
}

export function ngxPeerSnapshot(c: CompanyInput, m: CompanyMetrics): BrvmPeerSnapshot {
  return {
    ticker: c.ticker,
    name: cleanNgxName(c.name),
    sector: ngxSectorGroup(c.ticker, c.sectorSlug || c.sectorName),
    // 0 = non publié (convention de l'analyse partagée).
    per: finite(m.per) ? m.per : 0,
    mktcap: finite(m.marketCapBn) ? m.marketCapBn : 0,
    pbRatio: finite(m.pbr) ? m.pbr : null,
    roe: finite(m.roePercent) ? m.roePercent : null,
    netMargin: finite(m.netMarginPercent) ? m.netMarginPercent : null,
    revenueGrowth: finite(m.revenueCagrPercent) ? m.revenueCagrPercent : null,
    close: finite(c.close) && c.close > 0 ? c.close : null,
    dividend: latestNgxDividend(c.dividends),
  };
}

export interface NgxFundamentalArgs {
  company: CompanyInput;
  model: NgxSheetModel;
  universe: readonly CompanyInput[];
  /** Métriques déjà calculées (évite de les refaire). */
  universeMetrics?: ReadonlyArray<{ c: CompanyInput; m: CompanyMetrics }>;
  series: readonly PricePoint[];
  today: string;
  /**
   * Dernière clôture BRUTE (non ajustée des opérations sur titres) de chaque année : base du PER historique,
   * comparable au BPA publié de l'exercice. Absent = PER historique N/D (la série présentée est ajustée).
   */
  rawYearEndPrices?: Record<number, number>;
}

/** PER historique = clôture brute de fin d'exercice ÷ BPA publié (converti en ₦ au taux CBN de clôture si USD). */
export function historicalPer(y: NgxFinancialYear, yearEndClose: number | null | undefined): number | null {
  if (!finite(yearEndClose) || yearEndClose <= 0) return null;
  if (y.epsConfidence === "low" || !finite(y.epsNgn) || y.epsNgn <= 0) return null;
  const fx = (y.currency ?? "NGN") === "USD" ? y.ngnPerUsd ?? null : 1;
  if (!finite(fx)) return null;
  const per = yearEndClose / (y.epsNgn * fx);
  // Au-delà de 200× : BPA quasi nul ou unité douteuse, non significatif.
  return per > 0 && per <= 200 ? per : null;
}

function latestValue(years: readonly NgxFinancialYear[], pick: (y: NgxFinancialYear) => number | null | undefined) {
  for (let i = years.length - 1; i >= 0; i -= 1) {
    const v = pick(years[i]);
    if (finite(v)) return { year: years[i].year, value: v };
  }
  return null;
}

export function ngxFundamentalInput(args: NgxFundamentalArgs): BrvmFundamentalInput {
  const { company, model, today } = args;
  const metricsOf =
    args.universeMetrics ?? args.universe.map((c) => ({ c, m: computeCompanyMetrics(c, today) }));
  const own = metricsOf.find((x) => x.c.ticker === company.ticker)?.m ?? computeCompanyMetrics(company, today);
  const universe = metricsOf.map(({ c, m }) => {
    const snap = ngxPeerSnapshot(c, m);
    // Le cours de la fiche (série présentée) prime sur le dernier cours brut.
    return c.ticker === company.ticker && finite(model.header.close) ? { ...snap, close: model.header.close } : snap;
  });
  const years = model.performance.years;
  // Comptes publiés en USD : montants ramenés en ₦ au taux CBN enregistré (même base que le cours) ; sans taux, N/D.
  // Montants d'un exercice : taux CBN de clôture DE cet exercice (jamais le taux du jour appliqué à un ancien exercice).
  const toNgn = ngnPerReportingUnit(parseNgxProfileMeta(company.profileMeta));
  const rateOf = (y: NgxFinancialYear): number | null => {
    if ((y.currency ?? "NGN") !== "USD") return toNgn;
    return finite(y.ngnPerUsd) && y.ngnPerUsd > 0 ? y.ngnPerUsd : null;
  };
  const convY = (y: NgxFinancialYear, v: number | null | undefined): number | null => {
    const r = rateOf(y);
    return finite(v) && r != null ? v * r : null;
  };
  const prices = args.rawYearEndPrices ?? {};
  const ratioHistory: AnnualRatioPoint[] = years
    .map((y) => ({
      year: y.year,
      per: historicalPer(y, prices[y.year]),
      pbRatio: null,
      roe: y.equityConfidence === "low" ? null : returnOnEquityPercent(y.netIncomeBn, y.equityBn),
      netMargin: null,
      debtRatio: finite(y.debtRatioPercent) ? y.debtRatioPercent : null,
      revenueGrowth: null,
      fcf: convY(y, y.fcfBn),
    }))
    .filter((r) => r.roe != null || r.per != null || r.debtRatio != null || r.fcf != null);
  // Dette et FCF : dernière valeur publiée, affichée avec son exercice (le dernier exercice peut ne pas les avoir).
  const debtLatest = latestValue(years, (y) => y.debtRatioPercent);
  const fcfLatestNgn = latestValue(years, (y) => convY(y, y.fcfBn));
  const profile = model.presentation.profile;
  return {
    ticker: company.ticker,
    name: model.name,
    sector: model.sector.group,
    sectorLabel: model.sector.name,
    description: model.presentation.description,
    isin: model.presentation.isin,
    listedSince: model.presentation.listedSince,
    sharesOutstanding: model.presentation.shares?.value ?? null,
    close: model.header.close,
    per: finite(own.per) ? own.per : 0,
    mktcap: finite(own.marketCapBn) ? own.marketCapBn : 0,
    roe: own.roePercent,
    netMargin: own.netMarginPercent,
    debtRatio: debtLatest?.value ?? null,
    debtRatioYear: debtLatest?.year ?? null,
    pbRatio: own.pbr,
    revenueGrowth: null,
    fcf: fcfLatestNgn?.value ?? null,
    fcfYear: fcfLatestNgn?.year ?? null,
    ratioHistory,
    country: "Nigeria",
    floatPercent: profile?.freeFloatPercent ?? null,
    industry: null,
    income: years.map((y) => ({
      year: y.year,
      revenue: convY(y, y.revenueBn),
      netIncome: convY(y, y.netIncomeBn),
      operatingIncome: convY(y, y.operatingIncomeBn),
    })),
    dividends: model.dividends.lines.map((l) => ({
      year: l.year,
      amount: l.dps,
      exDate: l.exDate,
      paymentDate: l.paymentDate,
      source: null,
    })),
    series: args.series,
    outlook: model.outlook.synthesis,
    universe,
    today,
    market: "NGX",
    growthMeasure: "cagr",
  };
}

export function buildNgxFundamentalAnalysis(args: NgxFundamentalArgs): BrvmFundamentalAnalysis {
  return buildBrvmFundamentalAnalysis(ngxFundamentalInput(args));
}
