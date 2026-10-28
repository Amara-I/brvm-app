// Étape 5 (logique pure) — transforme les CSV validés en un plan d'écriture. Aucun accès base ici.
import type { Confidence } from "./types";

export interface FundamentalsCsvRow {
  ticker: string;
  fiscal_year: string;
  currency: string;
  revenue_bn: string;
  operating_profit_bn: string;
  net_profit_bn: string;
  equity_bn: string;
  eps: string;
  conf_revenue: Confidence;
  conf_operating_profit: Confidence;
  conf_net_profit: Confidence;
  conf_equity: Confidence;
  conf_eps: Confidence;
  source_pdf: string;
  source_file: string;
  [k: string]: string;
}

export interface DividendCsvRow {
  ticker: string;
  fiscal_year: string;
  dps: string;
  confidence: Confidence;
  source_pdf: string;
  [k: string]: string;
}

const RANK: Record<Confidence, number> = { none: 0, low: 1, medium: 2, high: 3 };
export const meets = (c: Confidence, min: Confidence) => RANK[c] >= RANK[min] && RANK[c] > 0;
const numOrNull = (s: string | undefined) => (s === undefined || s === "" ? null : Number.isFinite(Number(s)) ? Number(s) : null);

export interface RatioPlan {
  ticker: string;
  year: number;
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
}
export interface MetaPlan {
  ticker: string;
  year: number;
  equityBn: number | null;
  epsNgn: number | null;
  sourceUrl: string | null;
}
export interface DividendPlan {
  ticker: string;
  year: number;
  amount: number;
  sourceUrl: string;
}
export interface DocumentPlan {
  ticker: string;
  year: number;
  url: string;
  filename: string;
}
export interface LoadPlan {
  ratios: RatioPlan[];
  meta: MetaPlan[];
  dividends: DividendPlan[];
  documents: DocumentPlan[];
  skipped: Array<{ ticker: string; year: number; reason: string }>;
}

/** Ne retient que les valeurs au niveau de confiance demandé ; les sociétés non-NGN sont écartées (devise ≠ ₦). */
export function buildLoadPlan(fund: FundamentalsCsvRow[], divs: DividendCsvRow[], minConfidence: Confidence = "high"): LoadPlan {
  const plan: LoadPlan = { ratios: [], meta: [], dividends: [], documents: [], skipped: [] };
  const docSeen = new Set<string>();
  for (const r of fund) {
    const year = Number(r.fiscal_year);
    if (r.currency && r.currency !== "NGN") {
      plan.skipped.push({ ticker: r.ticker, year, reason: `devise ${r.currency} ≠ NGN (colonnes de la base en ₦ bn) : non chargé` });
      continue;
    }
    const pick = (v: string, c: Confidence) => (meets(c, minConfidence) ? numOrNull(v) : null);
    const ratio: RatioPlan = {
      ticker: r.ticker,
      year,
      revenue: pick(r.revenue_bn, r.conf_revenue),
      operatingIncome: pick(r.operating_profit_bn, r.conf_operating_profit),
      netIncome: pick(r.net_profit_bn, r.conf_net_profit),
    };
    if (ratio.revenue !== null || ratio.operatingIncome !== null || ratio.netIncome !== null) plan.ratios.push(ratio);
    const meta: MetaPlan = { ticker: r.ticker, year, equityBn: pick(r.equity_bn, r.conf_equity), epsNgn: pick(r.eps, r.conf_eps), sourceUrl: r.source_pdf || null };
    if (meta.equityBn !== null || meta.epsNgn !== null) plan.meta.push(meta);
    if (r.source_pdf && !docSeen.has(r.source_pdf) && (ratio.revenue !== null || ratio.netIncome !== null || meta.equityBn !== null)) {
      docSeen.add(r.source_pdf);
      plan.documents.push({ ticker: r.ticker, year, url: r.source_pdf, filename: r.source_file });
    }
  }
  const nonNgn = new Set(fund.filter((r) => r.currency && r.currency !== "NGN").map((r) => r.ticker));
  for (const d of divs) {
    const year = Number(d.fiscal_year);
    const amount = numOrNull(d.dps);
    if (amount === null || amount <= 0) continue;
    if (nonNgn.has(d.ticker)) {
      plan.skipped.push({ ticker: d.ticker, year, reason: "DPS d'un émetteur non-NGN : non chargé" });
      continue;
    }
    if (!meets(d.confidence, minConfidence)) {
      plan.skipped.push({ ticker: d.ticker, year, reason: `DPS confiance ${d.confidence} < ${minConfidence}` });
      continue;
    }
    plan.dividends.push({ ticker: d.ticker, year, amount, sourceUrl: d.source_pdf });
  }
  return plan;
}
