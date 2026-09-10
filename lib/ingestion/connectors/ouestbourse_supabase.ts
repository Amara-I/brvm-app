// Historique public ouestbourse.com via Supabase REST (`brvm_price_history`).
// Clé : publishable client-side (même usage que le front https://ouestbourse.com).

import type { ChartClosePoint } from "@/lib/charts/indicators";
import type {
  RawCompanyDocument,
  RawCompanyFundamentals,
  RawCompanyProfile,
  RawPriceQuote,
} from "@/lib/ingestion/types";

const DEFAULT_URL = "https://jwgjnopoktdwhqujpybr.supabase.co";

export interface ObPriceBar {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
}

function supabaseConfig(): { url: string; key: string } | null {
  const url = (process.env.OUESTBOURSE_SUPABASE_URL || DEFAULT_URL).replace(/\/$/, "");
  const key = process.env.OUESTBOURSE_SUPABASE_ANON_KEY?.trim() || "";
  if (!key) return null;
  return { url, key };
}

async function restGet<T>(pathAndQuery: string): Promise<T> {
  const cfg = supabaseConfig();
  if (!cfg) {
    throw new Error(
      "OUESTBOURSE_SUPABASE_ANON_KEY manquant — clé publishable du front ouestbourse.com"
    );
  }
  const res = await fetch(`${cfg.url}/rest/v1/${pathAndQuery}`, {
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      Accept: "application/json",
      "Accept-Profile": "public",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OuestBourse Supabase ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Liste des symboles listés sur ouestbourse.com. */
export async function fetchOuestbourseSymbols(): Promise<string[]> {
  const rows = await restGet<Array<{ symbol: string }>>(
    "brvm_companies?select=symbol&status=eq.listed&order=symbol.asc"
  );
  return rows.map((r) => r.symbol.toUpperCase()).filter(Boolean);
}

/**
 * Historique OHLC journalier (pagination 1000).
 * Retourne les clôtures pour persistance / densification graphes.
 */
export async function fetchOuestboursePriceHistory(symbol: string): Promise<ObPriceBar[]> {
  const t = symbol.toUpperCase();
  const out: ObPriceBar[] = [];
  const page = 1000;
  for (let offset = 0; offset < 50_000; offset += page) {
    const rows = await restGet<
      Array<{
        date: string;
        open: number | null;
        high: number | null;
        low: number | null;
        close: number | null;
        volume: number | null;
      }>
    >(
      `brvm_price_history?select=date,open,high,low,close,volume` +
        `&symbol=eq.${encodeURIComponent(t)}` +
        `&order=date.asc&offset=${offset}&limit=${page}`
    );
    if (rows.length === 0) break;
    for (const r of rows) {
      if (r.close == null || !(r.close > 0) || !r.date) continue;
      out.push({
        date: r.date.slice(0, 10),
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume != null && r.volume > 0 ? r.volume : null,
      });
    }
    if (rows.length < page) break;
  }
  return out;
}

export function obBarsToQuotes(ticker: string, bars: ObPriceBar[]): RawPriceQuote[] {
  const fetchedAt = new Date().toISOString();
  return bars.map((b) => ({
    ticker,
    date: b.date,
    closePrice: Math.round(b.close * 100) / 100,
    volume: b.volume,
    source: "OUESTBOURSE" as const,
    fetchedAt,
  }));
}

export function obBarsToChartPoints(bars: ObPriceBar[]): ChartClosePoint[] {
  return bars.map((b) => ({
    time: b.date,
    value: Math.round(b.close * 100) / 100,
    volume: b.volume,
  }));
}

export function isOuestbourseSupabaseConfigured(): boolean {
  return Boolean(process.env.OUESTBOURSE_SUPABASE_ANON_KEY?.trim());
}

export interface ObShareholderRow {
  holder_name: string;
  holder_type: string | null;
  pct: number | null;
  as_of: string | null;
  source: string | null;
}

export interface ObDocumentRow {
  id: string;
  url: string;
  filename: string | null;
  title: string | null;
  published_at: string | null;
  doc_type: string | null;
  period_type: string | null;
  exercise_year: number | null;
  source: string | null;
}

/** Actionnariat catalogue ouestbourse.com (`brvm_shareholders`). */
export async function fetchOuestbourseShareholders(symbol: string): Promise<ObShareholderRow[]> {
  const t = symbol.toUpperCase();
  return restGet<ObShareholderRow[]>(
    `brvm_shareholders?select=holder_name,holder_type,pct,as_of,source` +
      `&symbol=eq.${encodeURIComponent(t)}&order=pct.desc.nullslast`
  );
}

/** Profil émetteur BRVM (`brvm_company_profiles` — détail industrie / DG / IPO / site). */
export interface ObCompanyProfile {
  symbol: string;
  industry: string | null;
  ceo: string | null;
  chairman: string | null;
  listing_date: string | null;
  website: string | null;
  as_of: string | null;
  source: string | null;
}

export async function fetchOuestbourseCompanyProfile(
  symbol: string
): Promise<ObCompanyProfile | null> {
  const t = symbol.toUpperCase();
  const rows = await restGet<ObCompanyProfile[]>(
    `brvm_company_profiles?select=symbol,industry,ceo,chairman,listing_date,website,as_of,source` +
      `&symbol=eq.${encodeURIComponent(t)}&limit=1`
  );
  return rows[0] ?? null;
}

export function obCompanyProfileToRaw(
  ticker: string,
  row: ObCompanyProfile,
  fetchedAt = new Date().toISOString()
): RawCompanyProfile {
  return {
    ticker: ticker.toUpperCase(),
    isin: null,
    description: null,
    sharesOutstanding: null,
    floatPercent: null,
    phone: null,
    fax: null,
    address: null,
    directors: null,
    valuationLabel: null,
    shareholders: [],
    ceo: row.ceo?.trim() || null,
    chairman: row.chairman?.trim() || null,
    industry: row.industry?.trim() || null,
    website: row.website?.trim() || null,
    listingDate: row.listing_date ? row.listing_date.slice(0, 10) : null,
    source: "OUESTBOURSE",
    fetchedAt,
  };
}

function formatPeriodLabel(periodType: string | null, year: number | null): string | null {
  if (!periodType && year == null) return null;
  const pt = (periodType ?? "").trim();
  if (!pt && year != null) return `Annuel ${year}`;
  if (/^annuel$/i.test(pt) && year != null) return `Annuel ${year}`;
  if (year != null) return `${pt} ${year}`;
  return pt || null;
}

/** Documents déposés (`brvm_documents`) — PDF sur brvm.org. */
export async function fetchOuestbourseDocuments(symbol: string): Promise<ObDocumentRow[]> {
  const t = symbol.toUpperCase();
  const out: ObDocumentRow[] = [];
  const page = 200;
  for (let offset = 0; offset < 5_000; offset += page) {
    const rows = await restGet<ObDocumentRow[]>(
      `brvm_documents?select=id,url,filename,title,published_at,doc_type,period_type,exercise_year,source` +
        `&symbol=eq.${encodeURIComponent(t)}` +
        `&order=published_at.desc.nullslast&offset=${offset}&limit=${page}`
    );
    if (rows.length === 0) break;
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

export function obDocumentsToRaw(
  ticker: string,
  rows: ObDocumentRow[],
  fetchedAt = new Date().toISOString()
): RawCompanyDocument[] {
  return rows
    .filter((r) => r.url)
    .map((r) => ({
      ticker: ticker.toUpperCase(),
      title: r.title,
      filename: r.filename,
      url: r.url,
      docType: r.doc_type,
      periodLabel: formatPeriodLabel(r.period_type, r.exercise_year),
      publishedAt: r.published_at ? r.published_at.slice(0, 10) : null,
      sourceName: r.source?.includes("brvm") ? "BRVM.org" : "OuestBourse.com",
      externalId: r.id,
      fetchedAt,
    }));
}

export function obShareholdersToProfilePatch(
  rows: ObShareholderRow[],
  fetchedAt = new Date().toISOString()
): {
  shareholders: Array<{ name: string; percent: number | null }>;
  floatPercent: number | null;
  shareholdersAsOf: string | null;
  source: "OUESTBOURSE";
  fetchedAt: string;
} | null {
  if (rows.length === 0) return null;
  const shareholders = rows.map((r) => ({
    name: r.holder_name.trim(),
    percent: r.pct != null && Number.isFinite(r.pct) ? r.pct : null,
  }));
  const floatRow = rows.find((r) =>
    /flottant|float|public/i.test(`${r.holder_type ?? ""} ${r.holder_name}`)
  );
  const asOf =
    rows.map((r) => r.as_of).find((d) => d && /^\d{4}-\d{2}-\d{2}/.test(d))?.slice(0, 10) ?? null;
  return {
    shareholders,
    floatPercent: floatRow?.pct ?? null,
    shareholdersAsOf: asOf,
    source: "OUESTBOURSE",
    fetchedAt,
  };
}

export interface ObScreenerMetrics {
  symbol: string;
  fiscal_year: number | null;
  prior_fiscal_year: number | null;
  market_cap: number | null;
  pe_ratio: number | null;
  pe_ttm: number | null;
  price_to_book: number | null;
  roe: number | null;
  net_profit_margin: number | null;
  revenue: number | null;
  prior_revenue: number | null;
  net_income: number | null;
  prior_net_income: number | null;
  total_equity: number | null;
  total_assets: number | null;
  total_debt: number | null;
  revenue_growth: number | null;
  revenue_cagr3: number | null;
  free_cash_flow?: number | null;
  fcf?: number | null;
}

export interface ObFinancialsAnnual {
  symbol: string;
  year: number;
  revenue: number | null;
  net_income: number | null;
  total_equity: number | null;
  total_assets: number | null;
  total_debt: number | null;
  cash_and_equivalents: number | null;
  operating_income: number | null;
  /** Produit net bancaire (banques) — repli pour le CA quand `revenue` est absent. */
  net_banking_income?: number | null;
  /** Résultat brut d'exploitation — repli pour le REX quand `operating_income` est absent. */
  gross_operating_income?: number | null;
  revenue_growth: number | null;
}

/** Métriques dérivées des documents BRVM (vue screener OB). */
export async function fetchOuestbourseScreenerMetrics(
  symbol?: string
): Promise<ObScreenerMetrics[]> {
  if (symbol) {
    return restGet<ObScreenerMetrics[]>(
      `brvm_screener_metrics?select=*&symbol=eq.${encodeURIComponent(symbol.toUpperCase())}`
    );
  }
  const out: ObScreenerMetrics[] = [];
  const page = 200;
  for (let offset = 0; offset < 5_000; offset += page) {
    const rows = await restGet<ObScreenerMetrics[]>(
      `brvm_screener_metrics?select=*&order=symbol.asc&offset=${offset}&limit=${page}`
    );
    if (rows.length === 0) break;
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

/** États financiers annuels extraits des PDF BRVM. */
export async function fetchOuestbourseFinancialsAnnual(
  symbol: string
): Promise<ObFinancialsAnnual[]> {
  return restGet<ObFinancialsAnnual[]>(
    `brvm_financials_annual?select=symbol,year,revenue,net_income,total_equity,total_assets,total_debt,cash_and_equivalents,operating_income,net_banking_income,gross_operating_income,revenue_growth` +
      `&symbol=eq.${encodeURIComponent(symbol.toUpperCase())}&order=year.desc`
  );
}

function asPercent(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  // Fractions 0–1 → %, sinon déjà en %
  if (Math.abs(raw) <= 1.5) return Math.round(raw * 10000) / 100;
  return Math.round(raw * 100) / 100;
}

function mdFromFcfa(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v) || v === 0) return null;
  return Math.round((v / 1_000_000_000) * 100) / 100;
}

function safeYoy(current: number | null, prior: number | null): number | null {
  if (current == null || prior == null || !(prior > 0) || !(current > 0)) return null;
  // Rejette les YoY aberrants (souvent social vs consolidé mélangés).
  const g = ((current - prior) / prior) * 100;
  if (!Number.isFinite(g) || Math.abs(g) > 50) return null;
  return Math.round(g * 100) / 100;
}

/**
 * Convertit screener + comptes annuels OB (issus des documents BRVM) en
 * fondamentaux persistables. Pas de chiffre inventé : uniquement dérivés
 * des champs présents.
 */
export function obFinancialsToFundamentals(
  ticker: string,
  screener: ObScreenerMetrics | null,
  annuals: ObFinancialsAnnual[],
  fetchedAt = new Date().toISOString()
): RawCompanyFundamentals[] {
  const t = ticker.toUpperCase();
  const byYear = new Map<number, RawCompanyFundamentals>();

  const ensure = (year: number) => {
    let row = byYear.get(year);
    if (!row) {
      row = {
        ticker: t,
        year,
        per: null,
        mktCapMds: null,
        closePrice: null,
        source: "OUESTBOURSE",
        fetchedAt,
        roe: null,
        netMargin: null,
        revenueGrowth: null,
        revenue: null,
        netIncome: null,
        operatingIncome: null,
        debtRatio: null,
        pbRatio: null,
        fcf: null,
      };
      byYear.set(year, row);
    }
    return row;
  };

  const sorted = [...annuals].sort((a, b) => a.year - b.year);
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]!;
    const row = ensure(a.year);
    // CA : chiffre d'affaires, sinon PNB (banques) — jamais inventé.
    if (row.revenue == null) {
      row.revenue = mdFromFcfa(a.revenue ?? a.net_banking_income);
    }
    if (row.netIncome == null) row.netIncome = mdFromFcfa(a.net_income);
    // REX : résultat d'exploitation, sinon RBE documentaire.
    if (row.operatingIncome == null) {
      row.operatingIncome = mdFromFcfa(a.operating_income ?? a.gross_operating_income);
    }
    const revenueFcfa = a.revenue ?? a.net_banking_income;
    if (a.net_income != null && revenueFcfa != null && revenueFcfa > 0) {
      row.netMargin = Math.round((a.net_income / revenueFcfa) * 10000) / 100;
    }
    if (a.net_income != null && a.total_equity != null && a.total_equity > 0) {
      row.roe = Math.round((a.net_income / a.total_equity) * 10000) / 100;
    }
    if (a.total_debt != null && a.total_equity != null && a.total_equity > 0) {
      row.debtRatio = Math.round((a.total_debt / a.total_equity) * 10000) / 100;
    } else if (a.total_debt != null && a.total_assets != null && a.total_assets > 0) {
      row.debtRatio = Math.round((a.total_debt / a.total_assets) * 10000) / 100;
    }
    const prior = i > 0 ? sorted[i - 1]! : null;
    const curRev = a.revenue ?? a.net_banking_income ?? null;
    const priorRev = prior ? prior.revenue ?? prior.net_banking_income ?? null : null;
    const yoy =
      a.revenue_growth != null && Math.abs(a.revenue_growth) <= 1.5
        ? asPercent(a.revenue_growth)
        : safeYoy(curRev, priorRev);
    if (yoy != null) row.revenueGrowth = yoy;

    // FCF approx. documentaire : cash − dette court terme non dispo ;
    // si cash_and_equivalents seul, on ne force pas un FCF inventé.
  }

  if (screener) {
    const year = screener.fiscal_year ?? new Date().getUTCFullYear();
    const row = ensure(year);
    if (row.per == null) {
      row.per =
        screener.pe_ttm != null && screener.pe_ttm > 0
          ? Math.round(screener.pe_ttm * 100) / 100
          : screener.pe_ratio != null && screener.pe_ratio > 0
            ? Math.round(screener.pe_ratio * 100) / 100
            : null;
    }
    if (row.mktCapMds == null) row.mktCapMds = mdFromFcfa(screener.market_cap);
    if (row.netMargin == null) row.netMargin = asPercent(screener.net_profit_margin);
    if (row.roe == null) row.roe = asPercent(screener.roe);
    if (row.pbRatio == null && screener.price_to_book != null && screener.price_to_book > 0) {
      row.pbRatio = Math.round(screener.price_to_book * 100) / 100;
    }
    if (
      row.pbRatio == null &&
      screener.market_cap != null &&
      screener.total_equity != null &&
      screener.total_equity > 0
    ) {
      row.pbRatio = Math.round((screener.market_cap / screener.total_equity) * 100) / 100;
    }
    if (row.revenueGrowth == null) {
      const yoy = safeYoy(screener.revenue, screener.prior_revenue);
      if (yoy != null) row.revenueGrowth = yoy;
      else if (screener.revenue_cagr3 != null) {
        // Repli honnête : CAGR 3 ans (pas un YoY inventé).
        row.revenueGrowth = asPercent(screener.revenue_cagr3);
      }
    }
    if (row.revenue == null) row.revenue = mdFromFcfa(screener.revenue);
    if (row.netIncome == null) row.netIncome = mdFromFcfa(screener.net_income);
    const fcfRaw = screener.free_cash_flow ?? screener.fcf ?? null;
    if (row.fcf == null) row.fcf = mdFromFcfa(fcfRaw);

    // P/B depuis equity de l'exercice fiscal si dispo dans annuals
    if (row.pbRatio == null && screener.market_cap != null) {
      const eq = annuals.find((a) => a.year === year)?.total_equity
        ?? annuals.find((a) => a.total_equity != null)?.total_equity;
      if (eq != null && eq > 0) {
        row.pbRatio = Math.round((screener.market_cap / eq) * 100) / 100;
      }
    }
  }

  // P/B par année si market_cap screener + equity annuelle
  if (screener?.market_cap != null) {
    for (const a of annuals) {
      if (a.total_equity != null && a.total_equity > 0) {
        const row = ensure(a.year);
        if (row.pbRatio == null) {
          row.pbRatio = Math.round((screener.market_cap / a.total_equity) * 100) / 100;
        }
      }
    }
  }

  return [...byYear.values()].filter(
    (r) =>
      r.per != null ||
      r.mktCapMds != null ||
      r.roe != null ||
      r.netMargin != null ||
      r.revenueGrowth != null ||
      r.debtRatio != null ||
      r.pbRatio != null ||
      r.fcf != null
  );
}
