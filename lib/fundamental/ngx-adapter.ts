// Fiche NGX → entrée de l'analyse fondamentale partagée (lib/fundamental/brvm-analysis.ts).
// Même onglet, mêmes 8 étapes et mêmes règles que la BRVM, avec les données NGX telles
// qu'enregistrées : montants en nairas, pairs = sociétés NGX du même groupe sectoriel.
// Aucune lecture base ici et aucune valeur inventée : une donnée absente reste null (N/D).

import type { PricePoint } from "@/lib/ngx/price-stats";
import { computeCompanyMetrics, type CompanyInput, type CompanyMetrics, type NgxSheetModel } from "@/lib/ngx/sheet-model";
import { cleanNgxName, ngxSectorGroup } from "@/lib/ngx/sectors";
import { returnOnEquityPercent } from "@/lib/ngx/valuation";
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
  const ratioHistory: AnnualRatioPoint[] = years
    .map((y) => ({
      year: y.year,
      per: null,
      pbRatio: null,
      roe: y.equityConfidence === "low" ? null : returnOnEquityPercent(y.netIncomeBn, y.equityBn),
      netMargin: null,
      debtRatio: null,
      revenueGrowth: null,
      fcf: null,
    }))
    .filter((r) => r.roe != null);
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
    debtRatio: null,
    pbRatio: own.pbr,
    revenueGrowth: null,
    fcf: null,
    ratioHistory,
    country: "Nigeria",
    floatPercent: profile?.freeFloatPercent ?? null,
    industry: null,
    income: years.map((y) => ({
      year: y.year,
      revenue: y.revenueBn,
      netIncome: y.netIncomeBn,
      operatingIncome: y.operatingIncomeBn,
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
