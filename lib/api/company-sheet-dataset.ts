// Agrégat fiche société /actions/[ticker]

import { prisma } from "@/lib/prisma";
import { getCompaniesFullDataset, type CompanyFullDataset } from "@/lib/api/companies-full-dataset";
import { calcMetrics, type CalcMetricsResult } from "@/lib/calc/calc-metrics";
import { computeFinancialHealth, type FinancialHealth } from "@/lib/calc/financial-health";
import { dedupeChartPointsByDay, type ChartClosePoint } from "@/lib/charts/indicators";
import { computeAverageDailyVolume } from "@/lib/charts/chart-indicators";
import {
  loadEnrichedDividendsForCompany,
  type EnrichedDividendRow,
} from "@/lib/api/dividend-enrichment";
import {
  fetchOuestbourseFinancialsAnnual,
  isOuestbourseSupabaseConfigured,
} from "@/lib/ingestion/connectors/ouestbourse_supabase";

function mdFromFcfa(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v) || v === 0) return null;
  return Math.round((v / 1_000_000_000) * 100) / 100;
}

function hasAnyIncome(p: AnnualIncomePoint): boolean {
  return p.revenue != null || p.netIncome != null || p.operatingIncome != null;
}

async function loadIncomeStatementSeries(
  companyId: string | undefined,
  ticker: string
): Promise<AnnualIncomePoint[]> {
  const byYear = new Map<number, AnnualIncomePoint>();

  if (companyId) {
    try {
      const rows = await prisma.$queryRaw<
        Array<{
          year: number;
          revenue: unknown;
          net_income: unknown;
          operating_income: unknown;
        }>
      >`
        SELECT year, revenue, net_income, operating_income
        FROM financial_ratios
        WHERE company_id = ${companyId}
          AND is_canonical = true
          AND (revenue IS NOT NULL OR net_income IS NOT NULL OR operating_income IS NOT NULL)
        ORDER BY year ASC
      `;
      for (const r of rows) {
        byYear.set(Number(r.year), {
          year: Number(r.year),
          revenue: r.revenue != null ? Number(r.revenue) : null,
          netIncome: r.net_income != null ? Number(r.net_income) : null,
          operatingIncome: r.operating_income != null ? Number(r.operating_income) : null,
        });
      }
    } catch {
      // Colonnes absentes ou client Prisma non régénéré : repli OB ci-dessous.
    }
  }

  // Repli : comptes annuels OB (documents BRVM) si la base locale est vide ou lacunaire.
  if (isOuestbourseSupabaseConfigured()) {
    try {
      const annuals = await fetchOuestbourseFinancialsAnnual(ticker);
      for (const a of annuals) {
        const existing = byYear.get(a.year);
        const revenue = mdFromFcfa(a.revenue ?? a.net_banking_income);
        const netIncome = mdFromFcfa(a.net_income);
        const operatingIncome = mdFromFcfa(a.operating_income ?? a.gross_operating_income);
        const point: AnnualIncomePoint = {
          year: a.year,
          revenue: existing?.revenue ?? revenue,
          netIncome: existing?.netIncome ?? netIncome,
          operatingIncome: existing?.operatingIncome ?? operatingIncome,
        };
        if (hasAnyIncome(point)) byYear.set(a.year, point);
      }
    } catch {
      // Best-effort : N/D côté UI si la source est indisponible.
    }
  }

  return [...byYear.values()].filter(hasAnyIncome).sort((a, b) => a.year - b.year);
}

export interface SheetPerformance {
  oneMonth: number | null;
  threeMonths: number | null;
  ytd: number | null;
  oneYear: number | null;
  fiveYears: number | null;
}

export interface SheetKeyRow {
  label: string;
  current: string;
  previous: string;
  variation: string;
}

/** Comptes annuels (Md FCFA) pour le graphe CA / résultats. */
export interface AnnualIncomePoint {
  year: number;
  /** Chiffre d'affaires (Md FCFA), ou null si N/D. */
  revenue: number | null;
  /** Résultat net (Md FCFA), ou null si N/D. */
  netIncome: number | null;
  /** Résultat d'exploitation (Md FCFA), ou null si N/D. */
  operatingIncome: number | null;
}

export interface CompanySheetPayload {
  company: CompanyFullDataset;
  /** Toutes les sociétés (pour Comparaison sur la fiche). */
  peers: CompanyFullDataset[];
  years: number[];
  metrics: CalcMetricsResult;
  health: FinancialHealth;
  series: ChartClosePoint[];
  performance: SheetPerformance;
  keyRows: SheetKeyRow[];
  sessionDate: string | null;
  dayChangePercent: number | null;
  dayChangeAbs: number | null;
  /** ISIN si connu en base (ex. enrichissement Sikafinance). */
  isin: string | null;
  /** Description activité si connue. */
  description: string | null;
  /** Date d'introduction en bourse (YYYY-MM-DD) ou null. */
  listedSince: string | null;
  /** Profil étendu (téléphone, dirigeants, actionnaires…). */
  profileMeta: CompanyProfileMeta | null;
  documents: CompanyDocumentRow[];
  events: CompanyEventRow[];
  news: CompanyNewsRow[];
  /** Dividendes avec dates de détachement / paiement si connues. */
  dividendSchedule: EnrichedDividendRow[];
  /** Série annuelle CA / résultat net / résultat d'exploitation (Md FCFA). */
  incomeStatement: AnnualIncomePoint[];
}

export interface CompanyProfileMeta {
  phone?: string | null;
  fax?: string | null;
  address?: string | null;
  directors?: string | null;
  /** Direction générale (CEO), ex. « Sékou DRAME ». */
  ceo?: string | null;
  /** Présidence du conseil, ex. « Orange AMEA ». */
  chairman?: string | null;
  /** Industrie BRVM, ex. « TELECOMMUNICATION ». */
  industry?: string | null;
  website?: string | null;
  /** Date d'introduction ISO (YYYY-MM-DD). */
  listingDate?: string | null;
  sharesOutstanding?: number | null;
  floatPercent?: number | null;
  valuationLabel?: string | null;
  shareholders?: Array<{ name: string; percent: number | null }>;
  shareholdersAsOf?: string | null;
  source?: string;
  fetchedAt?: string;
}

export interface CompanyDocumentRow {
  id: string;
  title: string | null;
  filename: string | null;
  url: string;
  docType: string | null;
  periodLabel: string | null;
  publishedAt: string | null;
  sourceName: string;
}

export interface CompanyEventRow {
  id: string;
  title: string;
  eventDate: string;
  endDate: string | null;
  comment: string | null;
  sourceName: string;
}

export interface CompanyNewsRow {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  sourceName: string;
}

function pctChange(from: number | null | undefined, to: number | null | undefined): number | null {
  if (from == null || to == null || !from || !to || !Number.isFinite(from) || !Number.isFinite(to)) {
    return null;
  }
  return Math.round(((to - from) / from) * 1000) / 10;
}

function fmtVariation(from: number | null | undefined, to: number | null | undefined): string {
  const v = pctChange(from, to);
  if (v == null) return "N/D";
  return `${v >= 0 ? "+" : ""}${v}%`;
}

function findClosest(series: ChartClosePoint[], targetIso: string): ChartClosePoint | null {
  let best: ChartClosePoint | null = null;
  for (const p of series) {
    if (p.time <= targetIso) best = p;
    else break;
  }
  return best;
}

export function computeSheetPerformance(series: ChartClosePoint[], asOf = new Date()): SheetPerformance {
  if (series.length < 2) {
    return { oneMonth: null, threeMonths: null, ytd: null, oneYear: null, fiveYears: null };
  }
  const last = series[series.length - 1]!;
  const shift = (days: number) => {
    const d = new Date(asOf);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  };
  const ytdIso = `${asOf.getUTCFullYear()}-01-01`;
  const five = new Date(asOf);
  five.setUTCFullYear(five.getUTCFullYear() - 5);

  return {
    oneMonth: pctChange(findClosest(series, shift(30))?.value ?? 0, last.value),
    threeMonths: pctChange(findClosest(series, shift(90))?.value ?? 0, last.value),
    ytd: pctChange(findClosest(series, ytdIso)?.value ?? 0, last.value),
    oneYear: pctChange(findClosest(series, shift(365))?.value ?? 0, last.value),
    fiveYears: pctChange(findClosest(series, five.toISOString().slice(0, 10))?.value ?? 0, last.value),
  };
}

function buildKeyRows(
  company: CompanyFullDataset,
  years: number[],
  metrics: CalcMetricsResult,
  avgDailyVolume: number | null
): SheetKeyRow[] {
  const withPrice = years.filter((y) => (company.prices[y] ?? 0) > 0);
  const y0 = withPrice[withPrice.length - 1];
  const y1 = withPrice[withPrice.length - 2];
  const fmt = (n: number | null | undefined, suffix = "") =>
    n == null || !Number.isFinite(n) || n === 0 ? "N/D" : `${n.toLocaleString("fr-FR")}${suffix}`;
  const fmtPct = (n: number | null | undefined) =>
    n == null || !Number.isFinite(n) ? "N/D" : `${n.toFixed(2).replace(".", ",")}%`;
  const fmtRatio = (n: number | null | undefined) =>
    n == null || !Number.isFinite(n) ? "N/D" : n.toFixed(2).replace(".", ",");

  const div0 = y0 ? company.dividends[y0] ?? 0 : 0;
  const div1 = y1 ? company.dividends[y1] ?? 0 : 0;
  const price0 = y0 ? company.prices[y0] : 0;
  const price1 = y1 ? company.prices[y1] : 0;
  const yield0 = price0 > 0 && div0 > 0 ? (div0 / price0) * 100 : null;
  const yield1 = price1 > 0 && div1 > 0 ? (div1 / price1) * 100 : null;

  const rows: SheetKeyRow[] = [
    {
      label: `Cours de clôture${y0 ? ` (${y0})` : ""}`,
      current: fmt(price0, " FCFA"),
      previous: fmt(price1, " FCFA"),
      variation: fmtVariation(price1, price0),
    },
    {
      label: "Dividende / action",
      current: div0 > 0 ? `${div0.toLocaleString("fr-FR")} FCFA` : "N/D",
      previous: div1 > 0 ? `${div1.toLocaleString("fr-FR")} FCFA` : "N/D",
      variation: fmtVariation(div1, div0),
    },
    {
      label: "Rendement dividende",
      current: yield0 != null ? `${yield0.toFixed(2).replace(".", ",")}%` : "N/D",
      previous: yield1 != null ? `${yield1.toFixed(2).replace(".", ",")}%` : "N/D",
      variation: fmtVariation(yield1, yield0),
    },
    {
      label: "PER",
      current: company.per > 0 ? company.per.toFixed(2).replace(".", ",") : "N/D",
      previous: company.prevPer != null && company.prevPer > 0 ? company.prevPer.toFixed(2).replace(".", ",") : "N/D",
      variation: fmtVariation(company.prevPer, company.per > 0 ? company.per : null),
    },
    {
      label: "Capitalisation",
      current: company.mktcap > 0 ? `${company.mktcap.toLocaleString("fr-FR")} Md` : "N/D",
      previous:
        company.prevMktcap != null && company.prevMktcap > 0
          ? `${company.prevMktcap.toLocaleString("fr-FR")} Md`
          : "N/D",
      variation: fmtVariation(company.prevMktcap, company.mktcap > 0 ? company.mktcap : null),
    },
    {
      label: "ROE",
      current: fmtPct(company.roe),
      previous: fmtPct(company.prevRoe),
      variation: fmtVariation(company.prevRoe, company.roe),
    },
    {
      label: "Marge nette",
      current: fmtPct(company.netMargin),
      previous: fmtPct(company.prevNetMargin),
      variation: fmtVariation(company.prevNetMargin, company.netMargin),
    },
    {
      label: "Ratio d'endettement",
      current: fmtPct(company.debtRatio),
      previous: fmtPct(company.prevDebtRatio),
      variation: fmtVariation(company.prevDebtRatio, company.debtRatio),
    },
    {
      label: "Price-to-Book",
      current: fmtRatio(company.pbRatio),
      previous: fmtRatio(company.prevPbRatio),
      variation: fmtVariation(company.prevPbRatio, company.pbRatio),
    },
    {
      label: "Croissance CA",
      current: fmtPct(company.revenueGrowth),
      previous: fmtPct(company.prevRevenueGrowth),
      variation: fmtVariation(company.prevRevenueGrowth, company.revenueGrowth),
    },
    {
      label: "Free Cash Flow",
      current: company.fcf != null && Number.isFinite(company.fcf) ? `${company.fcf.toLocaleString("fr-FR")} Md` : "N/D",
      previous:
        company.prevFcf != null && Number.isFinite(company.prevFcf)
          ? `${company.prevFcf.toLocaleString("fr-FR")} Md`
          : "N/D",
      variation: fmtVariation(company.prevFcf, company.fcf),
    },
    {
      label: "Volume moyen (20 j)",
      current:
        avgDailyVolume != null && avgDailyVolume > 0
          ? avgDailyVolume.toLocaleString("fr-FR")
          : "N/D",
      previous: "N/D",
      variation: "N/D",
    },
    {
      label: "Score d'analyse",
      current: `${metrics.score}/100`,
      previous: "N/D",
      variation: "N/D",
    },
  ];
  return rows;
}

export async function getCompanySheetPayload(ticker: string): Promise<CompanySheetPayload | null> {
  const t = ticker.toUpperCase();
  const dataset = await getCompaniesFullDataset();
  const company = dataset.companies.find((c) => c.ticker === t);
  if (!company) return null;

  const dbCompany = await prisma.company.findUnique({
    where: { ticker: t },
    select: { id: true, isin: true, description: true, listedSince: true, profileMeta: true },
  });

  const [docRows, eventRows, newsRows] = dbCompany
    ? await Promise.all([
        prisma.companyDocument.findMany({
          where: { companyId: dbCompany.id },
          orderBy: [{ publishedAt: "desc" }, { filename: "asc" }],
          take: 100,
        }),
        prisma.companyEvent.findMany({
          where: { companyId: dbCompany.id },
          orderBy: { eventDate: "desc" },
          take: 40,
        }),
        prisma.newsArticle.findMany({
          where: { companyId: dbCompany.id },
          orderBy: { publishedAt: "desc" },
          take: 20,
          select: { id: true, title: true, url: true, publishedAt: true, sourceName: true },
        }),
      ])
    : [[], [], []];

  let series: ChartClosePoint[] = [];
  let officialDayChangePercent: number | null = null;
  if (dbCompany) {
    const since = new Date();
    since.setUTCFullYear(since.getUTCFullYear() - 8);
    const rows = await prisma.priceHistory.findMany({
      where: {
        companyId: dbCompany.id,
        isCanonical: true,
        date: { gte: since, lte: new Date() },
      },
      orderBy: { date: "asc" },
      select: { date: true, closePrice: true, volume: true, changePercent: true },
    });
    const now = Date.now();
    series = dedupeChartPointsByDay(
      rows
        .filter((r) => r.date.getTime() <= now)
        .map((r) => ({
          time: r.date.toISOString().slice(0, 10),
          value: Number(r.closePrice),
          volume: r.volume != null ? Number(r.volume) : null,
        }))
    );
    const latestWithVar = [...rows].reverse().find((r) => r.changePercent != null);
    if (latestWithVar?.changePercent != null) {
      officialDayChangePercent = Math.round(Number(latestWithVar.changePercent) * 100) / 100;
    }
  }

  // Repli : points annuels du dataset
  if (series.length < 2) {
    series = dataset.years
      .filter((y) => (company.prices[y] ?? 0) > 0)
      .map((y) => ({
        time: `${y}-12-31`,
        value: company.prices[y]!,
        volume: null,
      }));
  }

  const metrics = calcMetrics({
    years: dataset.years,
    prices: company.prices,
    dividends: company.dividends,
    per: company.per,
    mktcap: company.mktcap,
    sector: company.sector,
    closes: series,
  });
  const health = computeFinancialHealth(metrics, company.per);
  const avgDailyVolume = computeAverageDailyVolume(series, 20);

  const last = series[series.length - 1] ?? null;
  const prev = series.length >= 2 ? series[series.length - 2]! : null;
  const dayChangePercent =
    officialDayChangePercent ??
    (last && prev && prev.value > 0
      ? Math.round(((last.value - prev.value) / prev.value) * 1000) / 10
      : null);
  const dayChangeAbs =
    last && prev && dayChangePercent != null
      ? Math.round((last.value - prev.value) * 100) / 100
      : last && prev
        ? Math.round((last.value - prev.value) * 100) / 100
        : null;

  const [dividendSchedule, incomeStatement] = await Promise.all([
    dbCompany ? loadEnrichedDividendsForCompany(dbCompany.id) : Promise.resolve([]),
    loadIncomeStatementSeries(dbCompany?.id, t),
  ]);

  return {
    company,
    peers: dataset.companies,
    years: dataset.years,
    metrics,
    health,
    series,
    performance: computeSheetPerformance(series),
    keyRows: buildKeyRows(company, dataset.years, metrics, avgDailyVolume),
    sessionDate: last?.time ?? null,
    dayChangePercent,
    dayChangeAbs,
    isin: dbCompany?.isin ?? null,
    description: dbCompany?.description ?? null,
    listedSince: dbCompany?.listedSince
      ? dbCompany.listedSince.toISOString().slice(0, 10)
      : ((dbCompany?.profileMeta as CompanyProfileMeta | null)?.listingDate ?? null),
    profileMeta: (dbCompany?.profileMeta as CompanyProfileMeta | null) ?? null,
    documents: [...docRows]
      .sort((a, b) => {
        if (!a.publishedAt && !b.publishedAt) {
          return (a.filename ?? "").localeCompare(b.filename ?? "", "fr");
        }
        if (!a.publishedAt) return 1;
        if (!b.publishedAt) return -1;
        return b.publishedAt.getTime() - a.publishedAt.getTime();
      })
      .map((d) => ({
      id: d.id,
      title: d.title,
      filename: d.filename,
      url: d.url,
      docType: d.docType,
      periodLabel: d.periodLabel,
      publishedAt: d.publishedAt ? d.publishedAt.toISOString().slice(0, 10) : null,
      sourceName: d.sourceName,
    })),
    events: eventRows.map((e) => ({
      id: e.id,
      title: e.title,
      eventDate: e.eventDate.toISOString().slice(0, 10),
      endDate: e.endDate ? e.endDate.toISOString().slice(0, 10) : null,
      comment: e.comment,
      sourceName: e.sourceName,
    })),
    news: newsRows.map((n) => ({
      id: n.id,
      title: n.title,
      url: n.url,
      publishedAt: n.publishedAt.toISOString(),
      sourceName: n.sourceName,
    })),
    dividendSchedule,
    incomeStatement,
  };
}
