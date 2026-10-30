"use client";

// Fiche société premium — alignée captures OuestBourse (étape 20).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizeSplitLabel } from "@/lib/i18n/split-label";
import type { FormatApi } from "@/lib/i18n/format";
import { C } from "@/lib/theme/colors";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import type {
  CompanyEventRow,
  CompanyNewsRow,
  CompanySheetPayload,
} from "@/lib/api/company-sheet-dataset";
import type { ChartClosePoint } from "@/lib/charts/indicators";
import { rangeFilter, type ChartRange } from "@/lib/charts/indicators";
import { downsampleLttb } from "@/lib/charts/downsample";
import { companyChartApiPath, lastPointAsOf } from "@/lib/charts/chart-window";
import { chartDisplayNeedsRefresh } from "@/lib/charts/chart-series-cache";
import { flatPriceBounds } from "@/lib/charts/sparse-series";
import {
  computeWindowChange,
  formatWindowChangePercent,
} from "@/lib/charts/window-change";
import OverviewPriceChart from "@/components/actions/OverviewPriceChart";
import CompanyProjectionPanel from "@/components/actions/CompanyProjectionPanel";
import CompanyComparisonPanel from "@/components/actions/CompanyComparisonPanel";
import OutlookSynthesisCard from "./OutlookSynthesisCard";
import FilterableSheetTable from "@/components/actions/FilterableSheetTable";
import ShareholdingPanel from "@/components/actions/ShareholdingPanel";
import { trackFeature } from "@/components/analytics/track-client";
import LazyChartWorkbench, { prefetchChartWorkbench } from "@/components/charts/LazyChartWorkbench";
import PortfolioTickerAction from "@/components/portfolio/PortfolioTickerAction";
import TickerAlertButton from "@/components/notifications/TickerAlertButton";
import ChangeValue from "@/components/ui/ChangeValue";
import EducationTermLink from "@/components/education/EducationTermLink";
import SheetTermLabel from "@/components/actions/SheetTermLabel";
import {
  OVERVIEW_KEY_TERM_SLUGS,
  educationSlugForRiskPillar,
} from "@/lib/education/analysis-terms";
import {
  frameCompanyForPortfolioType,
  keyTermSlugsForType,
  overviewScorecardForType,
  type PortfolioTypeId,
} from "@/lib/portfolio-types";
import { usePortfolioType } from "@/lib/portfolio-types/use-portfolio-type";
import PortfolioTypeSelector from "@/components/portfolio-types/PortfolioTypeSelector";
import PortfolioTypePerspective from "@/components/portfolio-types/PortfolioTypePerspective";
import {
  COMPANY_SHEET_TABS,
  normalizeSheetTab,
  type CompanySheetTabKey,
} from "@/lib/ui/company-sheet-tabs";
import styles from "./CompanySheet.module.css";

const DATA_SOURCE_KEYS = {
  BRVM_OFFICIEL: "company.sources.BRVM_OFFICIEL",
  SIKAFINANCE: "company.sources.SIKAFINANCE",
  OUESTBOURSE: "company.sources.OUESTBOURSE",
  RICHBOURSE: "company.sources.RICHBOURSE",
  MANUEL: "company.sources.MANUEL",
} as const;

const SKIP_REASON_KEYS: Record<string, "company.docs.recentData" | "company.docs.recentDocs" | "company.docs.disabled" | "company.docs.noKey"> = {
  "Actualisation récente — données rechargées depuis la base.": "company.docs.recentData",
  "Actualisation récente — documents rechargés depuis la base (prochain tirage dans quelques minutes).":
    "company.docs.recentDocs",
  "Catalogue documents désactivé (INGESTION_ENABLE_OB_DOCUMENTS=false).": "company.docs.disabled",
  "OUESTBOURSE_SUPABASE_ANON_KEY absent — catalogue BRVM/OB indisponible.": "company.docs.noKey",
};

const SCORECARD_KEYS: Record<string, "company.scorecard.perf5" | "company.scorecard.divYield" | "company.scorecard.risk" | "company.scorecard.confidence" | "company.scorecard.volatility" | "company.scorecard.fundamental" | "company.scorecard.technical"> = {
  "Perf. 5 ans": "company.scorecard.perf5",
  "Rend. div.": "company.scorecard.divYield",
  Risque: "company.scorecard.risk",
  Confiance: "company.scorecard.confidence",
  Volatilité: "company.scorecard.volatility",
  Fondamental: "company.scorecard.fundamental",
  Technique: "company.scorecard.technical",
};

type TabKey = CompanySheetTabKey;

const TABS = COMPANY_SHEET_TABS;

const RANGES: Array<{ key: ChartRange; labelKey: "company.ranges.1M" | "company.ranges.1A" | "company.ranges.5A" | "company.ranges.MAX" }> = [
  { key: "1M", labelKey: "company.ranges.1M" },
  { key: "1A", labelKey: "company.ranges.1A" },
  { key: "5A", labelKey: "company.ranges.5A" },
  { key: "MAX", labelKey: "company.ranges.MAX" },
];

function fmtPct(n: number | null | undefined, format: FormatApi): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const body = format.decimal(Math.abs(n), 1);
  return `${n >= 0 ? "+" : "-"}${body}%`;
}

function fmtNum(n: number, format: FormatApi): string {
  return format.integer(n);
}

function EventsFeed({ events }: { events: CompanyEventRow[] }) {
  const { t } = useI18n();
  if (events.length === 0) {
    return <p className={styles.empty}>{t("company.events.empty")}</p>;
  }
  return (
    <ul className={styles.metaList}>
      {events.map((ev) => (
        <li key={ev.id}>
          <time dateTime={ev.eventDate}>
            {ev.endDate ? `${ev.eventDate} → ${ev.endDate}` : ev.eventDate}
          </time>
          <span>
            {ev.title}
            {ev.comment ? ` — ${ev.comment}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function NewsFeed({ news }: { news: CompanyNewsRow[] }) {
  const { t } = useI18n();
  if (news.length === 0) {
    return <p className={styles.empty}>{t("company.news.empty")}</p>;
  }
  return (
    <ul className={styles.metaList}>
      {news.map((n) => (
        <li key={n.id}>
          <time dateTime={n.publishedAt}>{n.publishedAt.slice(0, 10)}</time>
          <a href={n.url} target="_blank" rel="noopener noreferrer">
            {n.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Introduction en bourse style BRVM : « 2 oct. 1998 ». */
function formatListingDate(iso: string | null | undefined, format: FormatApi, nd: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return nd;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return nd;
  return format.date(d, { day: "numeric", month: "short", year: "numeric" });
}

function websiteHref(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function websiteLabel(raw: string | null | undefined): string {
  const s = raw?.trim();
  if (!s) return "N/D";
  try {
    const u = new URL(websiteHref(s)!);
    return u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return s.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
}

export default function CompanySheetClient({
  payload,
  isAuthenticated = false,
  initialTab,
  preferredPortfolioType = null,
}: {
  payload: CompanySheetPayload;
  isAuthenticated?: boolean;
  /** Onglet initial (ex. ?tab=charts depuis le sélecteur de ticker du graphe). */
  initialTab?: TabKey;
  /** Préférence Profil — surmontable ici sans retourner au profil. */
  preferredPortfolioType?: PortfolioTypeId | null;
}) {
  const { t, format, labels, locale } = useI18n();
  const nd = t("common.nd");
  const {

    company,
    peers,
    metrics,
    health,
    series: initialSeries,
    seriesFromChartCache,
    seriesCacheStale,
    splitMarkers,
    performance,
    sessionDate,
    dayChangePercent,
    dayChangeAbs,
    isin,
    description,
    listedSince,
    profileMeta,
    outlook,
    documents: initialDocuments,
    events,
    news,
    incomeStatement: initialIncomeStatement,
    keyRows: initialKeyRows,
  } = payload;
  const [tab, setTab] = usePersistedState<string>(`ouestbourse:sheet:${company.ticker}:tab`, "overview");
  const resolvedTab = normalizeSheetTab(tab);
  const {
    type: portfolioType,
    setType: setPortfolioType,
    profileDefault,
    isOverride,
    resetToProfile,
  } = usePortfolioType(preferredPortfolioType);

  useEffect(() => {
    if (tab !== resolvedTab) setTab(resolvedTab);
  }, [tab, resolvedTab, setTab]);

  useEffect(() => {
    if (initialTab) setTab(normalizeSheetTab(initialTab));
  }, [initialTab, setTab]);
  const [range, setRange] = usePersistedState<ChartRange>(`ouestbourse:sheet:${company.ticker}:range`, "1A");
  const [series, setSeries] = useState<ChartClosePoint[]>(initialSeries);
  const [liveChange, setLiveChange] = useState<{ pct: number | null; abs: number | null } | null>(null);
  const [denseLoading, setDenseLoading] = useState(false);
  const [documents, setDocuments] = useState(initialDocuments);
  const [incomeStatement, setIncomeStatement] = useState(initialIncomeStatement);
  const [keyRows, setKeyRows] = useState(initialKeyRows);
  const [docsRefreshing, setDocsRefreshing] = useState(false);
  const [docsRefreshNote, setDocsRefreshNote] = useState<string | null>(null);
  const [docFilter, setDocFilter] = useState<"all" | "results">("all");

  // Cache `chart_series` chaud : la série SSR est déjà la base d'affichage.
  // Manquant ou périmé : compléter en arrière-plan (densify / tip), sans bloquer le premier paint.
  useEffect(() => {
    if (!chartDisplayNeedsRefresh(seriesFromChartCache, seriesCacheStale)) return;
    let cancelled = false;
    async function refreshDisplaySeries() {
      setDenseLoading(true);
      try {
        const res = await fetch(companyChartApiPath(company.ticker, "MAX", "1D"));
        const json = await res.json();
        if (!cancelled && json.ok && Array.isArray(json.data?.series) && json.data.series.length > 0) {
          const incoming = json.data.series as ChartClosePoint[];
          setSeries((prev) => {
            if (incoming.length > prev.length) return incoming;
            const prevLast = prev[prev.length - 1]?.time ?? "";
            const nextLast = incoming[incoming.length - 1]?.time ?? "";
            return nextLast > prevLast ? incoming : prev;
          });
          const stats = json.data.stats as { dayChangePercent?: number | null; dayChangeAbs?: number | null } | undefined;
          if (stats) {
            setLiveChange({
              pct: stats.dayChangePercent ?? null,
              abs: stats.dayChangeAbs ?? null,
            });
          }
        }
      } catch {
        /* conserve la série serveur */
      } finally {
        if (!cancelled) setDenseLoading(false);
      }
    }
    void refreshDisplaySeries();
    return () => {
      cancelled = true;
    };
  }, [company.ticker, seriesFromChartCache, seriesCacheStale]);

  useEffect(() => {
    prefetchChartWorkbench();
    if (chartDisplayNeedsRefresh(seriesFromChartCache, seriesCacheStale)) return;
    void fetch(companyChartApiPath(company.ticker, "1A", "1D"));
  }, [company.ticker, seriesFromChartCache, seriesCacheStale]);

  const chartUniverse = useMemo(
    () =>
      peers.map((c) => ({
        ticker: c.ticker,
        name: c.name,
        color: c.color,
        sector: c.sector,
        countryFlag: c.countryFlag,
      })),
    [peers]
  );

  const sectorPeers = useMemo(() => {
    return peers
      .filter((p) => p.sector === company.sector && p.ticker !== company.ticker)
      .map((p) => {
        const years = Object.keys(p.prices)
          .map(Number)
          .filter((y) => (p.prices[y] ?? 0) > 0)
          .sort((a, b) => a - b);
        const y = years[years.length - 1];
        const lastPrice = y != null ? p.prices[y]! : 0;
        return { ...p, lastPrice };
      })
      .sort((a, b) => a.name.localeCompare(b.name, locale === "en" ? "en" : "fr"));
  }, [peers, company.sector, company.ticker, locale]);

  const rangedSeries = useMemo(
    () => rangeFilter(series, range, lastPointAsOf(series)),
    [series, range]
  );
  const rangeChange = useMemo(() => computeWindowChange(rangedSeries), [rangedSeries]);
  const chartSeries = useMemo(() => downsampleLttb(rangedSeries, 360), [rangedSeries]);
  const chartYDomain = useMemo(() => {
    const bounds = flatPriceBounds(chartSeries.map((p) => p.value));
    return bounds ? ([bounds.min, bounds.max] as [number, number]) : (["auto", "auto"] as ["auto", "auto"]);
  }, [chartSeries]);
  const shortChart = chartSeries.length > 0 && chartSeries.length <= 12;
  const splitGuides = useMemo(
    () =>
      splitMarkers.flatMap((marker) => {
        const point = chartSeries.find((p) => p.time.slice(0, 10) >= marker.effectiveDate);
        if (!point) return [];
        return [
          {
            key: marker.effectiveDate,
            x: point.time,
          },
        ];
      }),
    [splitMarkers, chartSeries]
  );
  const last = rangedSeries[rangedSeries.length - 1] ?? series[series.length - 1];
  const prev = rangedSeries.length >= 2 ? rangedSeries[rangedSeries.length - 2] : null;
  const quote = series[series.length - 1];
  const quotePrev = series.length >= 2 ? series[series.length - 2] : null;
  const price = quote && quote.value > 0 ? quote.value : metrics.currentPrice || 0;
  const seriesChg =
    quote && quotePrev && quotePrev.value > 0
      ? Math.round(((quote.value - quotePrev.value) / quotePrev.value) * 10000) / 100
      : null;
  const seriesAbs = quote && quotePrev ? Math.round((quote.value - quotePrev.value) * 100) / 100 : null;
  const chgPct = liveChange?.pct ?? dayChangePercent ?? seriesChg;
  const chgAbs = liveChange?.abs ?? dayChangeAbs ?? seriesAbs;
  const up = (chgPct ?? 0) >= 0;

  const ohlc = useMemo(() => {
    if (!last || !prev) {
      return { o: nd, h: nd, l: nd, c: price > 0 ? fmtNum(price, format) : nd, vol: nd, var: nd };
    }
    const open = prev.value;
    const close = last.value;
    const high = Math.max(open, close);
    const low = Math.min(open, close);
    const v = open > 0 ? ((close - open) / open) * 100 : 0;
    return {
      o: fmtNum(open, format),
      h: fmtNum(high, format),
      l: fmtNum(low, format),
      c: fmtNum(close, format),
      vol: last.volume && last.volume > 0 ? format.number(last.volume) : nd,
      var: `${v >= 0 ? "+" : "-"}${format.decimal(Math.abs(v), 2)}%`,
    };
  }, [last, prev, price, format, nd]);

  const dividendChart = useMemo(
    () =>
      payload.years
        .filter((y) => (company.dividends[y] ?? 0) > 0)
        .map((y) => {
          const amount = company.dividends[y]!;
          const px = company.prices[y] ?? 0;
          const yieldPct = px > 0 ? Math.round((amount / px) * 10000) / 100 : null;
          return { year: String(y), amount, yieldPct };
        }),
    [payload.years, company]
  );

  const incomeChart = useMemo(
    () =>
      (incomeStatement ?? []).map((p) => ({
        year: String(p.year),
        ca: p.revenue,
        resultatNet: p.netIncome,
        resultatExploitation: p.operatingIncome,
      })),
    [incomeStatement]
  );

  const paidYears = dividendChart.length;
  const lastDiv = dividendChart[dividendChart.length - 1];
  const visibleDocuments = useMemo(
    () => (docFilter === "results" ? documents.filter((d) => d.kind === "results") : documents),
    [documents, docFilter]
  );
  const resultsDocCount = useMemo(
    () => documents.filter((d) => d.kind === "results").length,
    [documents]
  );

  async function refreshDocuments() {
    if (docsRefreshing) return;
    setDocsRefreshing(true);
    setDocsRefreshNote(null);
    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(company.ticker)}/refresh-documents`, {
        method: "POST",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setDocsRefreshNote(json.error ?? t("company.docs.refreshFailed"));
        return;
      }
      if (Array.isArray(json.data?.documents)) setDocuments(json.data.documents);
      if (Array.isArray(json.data?.incomeStatement)) setIncomeStatement(json.data.incomeStatement);
      if (Array.isArray(json.data?.keyRows)) setKeyRows(json.data.keyRows);
      const ing = json.data?.ingestion;
      if (ing?.skipped) {
        const skipKey = typeof ing.skipReason === "string" ? SKIP_REASON_KEYS[ing.skipReason] : undefined;
        setDocsRefreshNote(skipKey ? t(skipKey) : (ing.skipReason ?? t("company.docs.recentData")));
      } else {
        const src = ing?.source === "OUESTBOURSE" ? t("company.docs.sourceOb") : t("company.docs.sourceNd");
        setDocsRefreshNote(
          t("company.docs.updatedVia", { source: src }) +
            (typeof ing?.documentsUpserted === "number"
              ? ` · ${t("company.docs.docCount", { count: ing.documentsUpserted })}`
              : "") +
            (typeof ing?.resultsDocuments === "number"
              ? ` · ${t("company.docs.resultsCount", { count: ing.resultsDocuments })}`
              : "") +
            (typeof ing?.fundamentalsUpserted === "number" && ing.fundamentalsUpserted > 0
              ? ` · ${t("company.docs.accountsCount", { count: ing.fundamentalsUpserted })}`
              : "") +
            "."
        );
      }
      trackFeature("company_sheet", "refresh-documents");
    } catch {
      setDocsRefreshNote(t("company.docs.refreshFailed"));
    } finally {
      setDocsRefreshing(false);
    }
  }

  const sessionLabel = sessionDate
    ? format.date(new Date(`${sessionDate}T12:00:00Z`), {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : nd;

  const analysisPerspective = useMemo(
    () =>
      frameCompanyForPortfolioType({
        type: portfolioType,
        ticker: company.ticker,
        name: company.name,
        metrics,
      }),
    [portfolioType, company.ticker, company.name, metrics]
  );
  const scorecardCells = useMemo(
    () => overviewScorecardForType(portfolioType, metrics),
    [portfolioType, metrics]
  );
  const keyTermSlugs = keyTermSlugsForType(portfolioType);

  function sheetRangeWord(key: ChartRange): string {
    switch (key) {
      case "1M":
        return t("company.ranges.1M");
      case "1A":
        return t("company.ranges.1A");
      case "5A":
        return t("company.ranges.5A");
      case "MAX":
        return t("company.ranges.MAX");
      default:
        return key;
    }
  }

  function translateKeyLabel(label: string): string {
    const close = label.match(/^Cours de clôture(?: \((\d+)\))?$/);
    if (close) {
      return close[1] ? t("company.keys.closeYear", { year: close[1] }) : t("company.keys.close");
    }
    const revenue = label.match(/^Chiffre d'affaires(?: \((\d+)\))?$/);
    if (revenue) {
      return revenue[1] ? t("company.keys.revenueYear", { year: revenue[1] }) : t("company.keys.revenue");
    }
    const known: Record<string, Parameters<typeof t>[0]> = {
      "Dividende / action": "company.keys.dps",
      "Rendement dividende": "company.keys.divYield",
      PER: "company.keys.per",
      Capitalisation: "company.keys.mktcap",
      ROE: "company.keys.roe",
      "Marge nette": "company.keys.netMargin",
      "Ratio d'endettement": "company.keys.debt",
      "Price-to-Book": "company.keys.pb",
      "Croissance CA": "company.keys.revenueGrowth",
      "Free Cash Flow": "company.keys.fcf",
      "Volume moyen (20 j)": "company.keys.avgVolume",
      "Score d'analyse": "company.keys.score",
      "Résultat d'exploitation": "company.keys.operating",
      "Résultat net": "company.keys.net",
    };
    const key = known[label];
    return key ? t(key) : label;
  }

  function displayKeyValue(value: string): string {
    if (locale !== "en") return value;
    return value.replaceAll(" Md", " bn");
  }

  function scorecardText(k: string): string {
    const key = SCORECARD_KEYS[k];
    return key ? t(key) : k;
  }

  function scorecardValue(k: string, v: string): string {
    if (k === "Risque") return labels.riskLevel(v);
    if (k === "Confiance") return labels.confidence(v);
    return v;
  }

  function loosePercent(n: number): string {
    const body = format.number(n, { maximumFractionDigits: 8 });
    return locale === "en" ? `${body}%` : `${body} %`;
  }

  function riskSummaryText(): string {
    const ra = metrics.riskAnalysis;
    const tierRaw = labels.riskTier(ra.riskTier);
    const tier = locale === "en" ? tierRaw : tierRaw.toLowerCase();
    const scored = ra.pillars.filter((p) => p.score != null).slice(0, 3);
    const detail = scored.length
      ? t("company.risk.pillars", {
          list: scored.map((p) => `${t(`company.risk.short.${p.key}`)} ${p.score}`).join(", "),
        })
      : t("company.risk.noDetail");
    return t("company.risk.summary", { tier, score: ra.riskScore, detail });
  }

  const rangeChangeLabel = t("company.chart.rangeChange", { range: sheetRangeWord(range) });

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/societes-cotees">{t("company.breadcrumb")}</Link>
        <span aria-hidden="true"> / </span>
        <span>{company.ticker}</span>
      </div>

      {/* Header */}
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.logoMark} style={{ borderColor: company.color }}>
            {company.ticker.slice(0, 2)}
          </div>
          <div>
            <h1 className={styles.title}>{company.name}</h1>
            <div className={styles.subline}>
              <strong>{company.ticker}</strong>
              {isin && (
                <>
                  <span>·</span>
                  <span>ISIN {isin}</span>
                </>
              )}
              <span>·</span>
              <span>{labels.sector(company.sector)}</span>
              <span>·</span>
              <span>
                {company.countryFlag} {labels.country(company.country)}
              </span>
            </div>
          </div>
        </div>
        <div className={styles.heroPrice}>
          <div className={styles.price}>
            {price > 0 ? format.fcfa(price) : <span className="ob-nd">{nd}</span>}
          </div>
          <div className={styles.chg}>
            <ChangeValue value={chgPct} pill />
            {chgAbs != null ? (
              <span className="ob-num" style={{ marginLeft: 6, color: "var(--c-textdim)" }}>
                ({chgAbs >= 0 ? "+" : ""}
                {fmtNum(chgAbs, format)})
              </span>
            ) : null}
          </div>
        </div>
        <div className={styles.heroActions}>
          <Link
            href={`/outils/taille-position?ticker=${encodeURIComponent(company.ticker)}`}
            className={styles.btnOutline}
          >
            {t("company.positionSize")}
          </Link>
          <TickerAlertButton
            isAuthenticated={isAuthenticated}
            ticker={company.ticker}
            lastClose={price > 0 ? price : null}
            loginCallbackPath={`/actions/${company.ticker}`}
            className={styles.btnGhost}
          />
          <PortfolioTickerAction
            ticker={company.ticker}
            isAuthenticated={isAuthenticated}
            signal={{
              label: metrics.signal.label,
              color: metrics.signal.color,
              score: metrics.score,
            }}
            addClassName={styles.btnPrimary}
          />
        </div>
      </header>

      <PortfolioTypeSelector
        value={portfolioType}
        onChange={setPortfolioType}
        profileDefault={profileDefault}
        isOverride={isOverride}
        onResetToProfile={resetToProfile}
        idPrefix={`sheet-${company.ticker}`}
      />

      <div className={styles.tabs} role="tablist" aria-label={t("company.tabsAria")}>
        {TABS.map((tabDef) => (
          <button
            key={tabDef.key}
            type="button"
            role="tab"
            aria-selected={resolvedTab === tabDef.key}
            className={resolvedTab === tabDef.key ? styles.tabActive : styles.tab}
            onMouseEnter={() => {
              if (tabDef.key === "charts") prefetchChartWorkbench();
            }}
            onFocus={() => {
              if (tabDef.key === "charts") prefetchChartWorkbench();
            }}
            onClick={() => {
              if (tabDef.key === "charts") prefetchChartWorkbench();
              setTab(tabDef.key);
              trackFeature("company_sheet", `tab:${tabDef.key}`);
            }}
          >
            {t(`company.tabs.${tabDef.key}`)}
          </button>
        ))}
      </div>

      {resolvedTab === "charts" && (
        <div className={styles.chartWorkbenchWrap}>
          <LazyChartWorkbench
            universe={chartUniverse}
            initialTicker={company.ticker}
            embedded
            isAuthenticated={isAuthenticated}
            initialSeries={series}
            initialSeriesComplete={seriesFromChartCache && !seriesCacheStale}
          />
        </div>
      )}

      {resolvedTab === "overview" && (
        <div className={styles.layout}>
          <div className={styles.mainCol}>
            <PortfolioTypePerspective perspective={analysisPerspective} />
            {/* Cours + aperçu (vue d'ensemble) — graphes détaillés = onglet Graphes */}
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>{t("company.chart.price")}</h2>
                <div className={styles.rangeTools}>
                  <div
                    className={styles.rangeChgBlock}
                    aria-live="polite"
                    title={
                      rangeChange
                        ? `${rangeChangeLabel} · ${rangeChange.abs > 0 ? "+" : ""}${format.integer(rangeChange.abs)} FCFA`
                        : t("company.chart.rangeChangeNd")
                    }
                  >
                    <span className={styles.rangeChgLabel}>{rangeChangeLabel}</span>
                    <span
                      className={
                        rangeChange == null
                          ? styles.rangeChgNd
                          : rangeChange.percent >= 0
                            ? styles.rangeChgUp
                            : styles.rangeChgDown
                      }
                    >
                      {rangeChange == null
                        ? nd
                        : locale === "fr"
                          ? formatWindowChangePercent(rangeChange.percent)
                          : format.percent(rangeChange.percent, 2, true)}
                    </span>
                  </div>
                  <div className={styles.rangeRow}>
                    {RANGES.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        className={range === r.key ? styles.rangeActive : styles.rangeBtn}
                        onClick={() => {
                          setRange(r.key);
                          trackFeature("company_sheet", `range:${r.key}`);
                        }}
                      >
                        {t(r.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className={styles.sessionNote}>
                {t("company.chart.session", { date: sessionLabel })}
                {denseLoading ? ` · ${t("company.chart.densifying")}` : ""}
                {" · "}
                <button type="button" className={styles.textLink} onClick={() => setTab("charts")}>
                  {t("company.chart.openCharts")}
                </button>
              </p>
              {splitMarkers.map((marker) => (
                <p key={marker.effectiveDate} className={styles.splitNote}>
                  {localizeSplitLabel(marker.label, t, format)}
                </p>
              ))}
              <OverviewPriceChart
                chartSeries={chartSeries}
                rangedSeries={rangedSeries}
                shortChart={shortChart}
                yDomain={chartYDomain}
                splitGuides={splitGuides}
                defaultOhlc={ohlc}
                defaultUp={up}
                nd={nd}
                emptyLabel={t("company.chart.insufficient")}
              />
            </section>

                {/* Scorecard de décision — AD-2026-08-22-002 (approuvée) */}
                <section className={styles.card} aria-labelledby="scorecard-title">
                  <div className={styles.cardHead}>
                    <h2 id="scorecard-title" className={styles.cardTitle}>
                      {t("company.scorecard.title")}
                    </h2>
                    <span className={styles.cardMeta}>{t("company.scorecard.meta")}</span>
                  </div>
                  <div className={styles.scoreGrid}>
                    {scorecardCells.map((cell) => (
                      <div key={cell.k} className={styles.scoreCell}>
                        <span className={styles.scoreKey}>
                          <SheetTermLabel french={cell.k} text={scorecardText(cell.k)} />
                        </span>
                        <span
                          className={
                            cell.tone === "good"
                              ? styles.scoreGood
                              : cell.tone === "warn"
                                ? styles.scoreWarn
                                : cell.tone === "bad"
                                  ? styles.scoreBad
                                  : styles.scoreNeutral
                          }
                        >
                          {scorecardValue(cell.k, cell.v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={styles.card} aria-labelledby="key-terms-title">
                  <div className={styles.cardHead}>
                    <h2 id="key-terms-title" className={styles.cardTitle}>
                      {t("company.keyTerms.title")}
                    </h2>
                    <span className={styles.cardMeta}>{t("company.keyTerms.meta")}</span>
                  </div>
                  <ul className={styles.keyTerms}>
                    {(keyTermSlugs.length > 0 ? keyTermSlugs : OVERVIEW_KEY_TERM_SLUGS).map((slug) => (
                      <li key={slug}>
                        <EducationTermLink slug={slug} />
                      </li>
                    ))}
                  </ul>
                </section>

                <section className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.cardTitle}>{t("company.performance.title")}</h2>
                    <span className={styles.cardMeta}>{t("company.chart.sessionExDiv", { date: sessionLabel })}</span>
                  </div>
                  <div className={styles.perfGrid}>
                    {[
                      { l: t("company.performance.oneMonth"), v: performance.oneMonth },
                      { l: t("company.performance.threeMonths"), v: performance.threeMonths },
                      { l: t("company.performance.ytd"), v: performance.ytd },
                      { l: t("company.performance.oneYear"), v: performance.oneYear },
                      { l: t("company.performance.fiveYears"), v: performance.fiveYears },
                    ].map((p) => (
                      <div key={p.l} className={styles.perfItem}>
                        <div className={styles.perfLabel}>{p.l}</div>
                        <div
                          className={styles.perfValue}
                          style={{
                            color: p.v == null ? C.textDim : p.v >= 0 ? C.green : C.red,
                          }}
                        >
                          {fmtPct(p.v, format)}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.cardTitle}>{t("company.keyData.title")}</h2>
                    <span className={styles.cardMeta}>{t("company.keyData.meta")}</span>
                  </div>
                  <FilterableSheetTable
                    columns={[
                      {
                        key: "label",
                        label: t("company.keyData.indicator"),
                        getValue: (r) => r.label,
                        render: (r) => <SheetTermLabel french={r.labelFr} text={r.label} />,
                      },
                      { key: "current", label: t("company.keyData.recent"), getValue: (r) => r.current },
                      { key: "previous", label: t("company.keyData.previous"), getValue: (r) => r.previous },
                      {
                        key: "variation",
                        label: t("company.keyData.variation"),
                        getValue: (r) => r.variation,
                        render: (r) => (
                          <span
                            style={{
                              color: r.variation.startsWith("+")
                                ? C.green
                                : r.variation.startsWith("-")
                                  ? C.red
                                  : C.textDim,
                            }}
                          >
                            {r.variation}
                          </span>
                        ),
                      },
                    ]}
                    rows={keyRows.map((r) => ({
                      labelFr: r.label,
                      label: translateKeyLabel(r.label),
                      current: displayKeyValue(r.current),
                      previous: displayKeyValue(r.previous),
                      variation: r.variation,
                    }))}
                  />
                </section>

                <div className={styles.financeSplit}>
                  <section className={styles.card}>
                    <div className={styles.cardHead}>
                      <h2 className={styles.cardTitle}>{t("company.dividends.title")}</h2>
                      <span className={styles.cardMeta}>{t("company.dividends.meta")}</span>
                    </div>
                    {dividendChart.length > 0 ? (
                      <>
                        <p className={styles.divSummary}>
                          {t(paidYears > 1 ? "company.dividends.paidMany" : "company.dividends.paidOne", {
                            count: paidYears,
                          })}
                          {lastDiv
                            ? ` · ${t("company.dividends.last", {
                                amount: format.number(lastDiv.amount),
                                year: lastDiv.year,
                              })}${
                                lastDiv.yieldPct != null
                                  ? ` · ${format.number(lastDiv.yieldPct, { maximumFractionDigits: 8 })} %`
                                  : ""
                              }`
                            : ""}
                        </p>
                        <div className={styles.chartBox}>
                          <ResponsiveContainer width="100%" height={168}>
                            <ComposedChart data={dividendChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                              <CartesianGrid stroke={C.borderThin} strokeDasharray="3 3" />
                              <XAxis dataKey="year" stroke={C.textDim} fontSize={11} />
                              <YAxis
                                yAxisId="div"
                                stroke={C.textDim}
                                fontSize={11}
                                width={44}
                                tickFormatter={(v) => format.integer(Number(v))}
                              />
                              <YAxis
                                yAxisId="yield"
                                orientation="right"
                                stroke={C.textDim}
                                fontSize={11}
                                width={36}
                                tickFormatter={(v) => `${format.number(Number(v), { maximumFractionDigits: 8 })}%`}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: C.panel,
                                  border: `1px solid ${C.border}`,
                                  borderRadius: 8,
                                  fontSize: "0.72rem",
                                }}
                                formatter={(value, name) => {
                                  const yieldName = t("company.dividends.seriesYield");
                                  const divName = t("company.dividends.seriesDividend");
                                  if (name === "yieldPct" || name === yieldName) {
                                    if (value == null || !Number.isFinite(Number(value))) {
                                      return [nd, yieldName];
                                    }
                                    const body = format.number(Number(value), { maximumFractionDigits: 2 });
                                    return [locale === "en" ? `${body}%` : `${body} %`, yieldName];
                                  }
                                  return [`${format.number(Number(value))} FCFA`, divName];
                                }}
                                labelFormatter={(y) => t("company.dividends.fiscalYear", { year: String(y) })}
                              />
                              <Legend
                                wrapperStyle={{ fontSize: "0.65rem", paddingTop: 2 }}
                                iconSize={8}
                              />
                              <Bar
                                yAxisId="div"
                                dataKey="amount"
                                name={t("company.dividends.seriesDividend")}
                                fill={C.gold}
                                radius={[4, 4, 0, 0]}
                              />
                              <Line
                                yAxisId="yield"
                                type="monotone"
                                dataKey="yieldPct"
                                name={t("company.dividends.seriesYield")}
                                stroke={C.blue}
                                strokeWidth={2}
                                dot={{ r: 2 }}
                                connectNulls
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    ) : (
                      <p className={styles.empty}>{t("company.dividends.empty")}</p>
                    )}
                    <Link href="/calendrier-dividendes" className={styles.inlineLink}>
                      {t("company.dividends.calendar")}
                    </Link>
                  </section>

                  <section className={styles.card}>
                    <div className={styles.cardHead}>
                      <h2 className={styles.cardTitle}>{t("company.income.title")}</h2>
                      <span className={styles.cardMeta}>{t("company.income.meta")}</span>
                    </div>
                    {incomeChart.length > 0 ? (
                      <div className={styles.chartBox}>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={incomeChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                            <CartesianGrid stroke={C.borderThin} strokeDasharray="3 3" />
                            <XAxis dataKey="year" stroke={C.textDim} fontSize={11} />
                            <YAxis
                              stroke={C.textDim}
                              fontSize={11}
                              width={44}
                              tickFormatter={(v) => {
                                const n = Number(v);
                                if (Math.abs(n) >= 100) return String(Math.round(n));
                                return locale === "fr"
                                  ? String(n).replace(".", ",")
                                  : format.number(n, { maximumFractionDigits: 8 });
                              }}
                            />
                            <Tooltip
                              contentStyle={{
                                background: C.panel,
                                border: `1px solid ${C.border}`,
                                borderRadius: 8,
                                fontSize: "0.72rem",
                              }}
                              formatter={(value, name) => {
                                const label =
                                  name === "ca"
                                    ? t("company.income.revenue")
                                    : name === "resultatNet"
                                      ? t("company.income.net")
                                      : name === "resultatExploitation"
                                        ? t("company.income.operating")
                                        : String(name);
                                if (value == null || !Number.isFinite(Number(value))) {
                                  return [nd, label];
                                }
                                return [
                                  t("company.income.md", {
                                    value: format.number(Number(value), { maximumFractionDigits: 2 }),
                                  }),
                                  label,
                                ];
                              }}
                              labelFormatter={(y) => t("company.income.fiscalYear", { year: String(y) })}
                            />
                            <Legend
                              wrapperStyle={{ fontSize: "0.65rem", paddingTop: 2 }}
                              iconSize={8}
                              formatter={(value) =>
                                value === "ca"
                                  ? t("company.income.caPnb")
                                  : value === "resultatNet"
                                    ? t("company.income.net")
                                    : value === "resultatExploitation"
                                      ? t("company.income.operating")
                                      : value
                              }
                            />
                            <Line
                              type="monotone"
                              dataKey="ca"
                              name="ca"
                              stroke={C.gold}
                              strokeWidth={2}
                              dot={{ r: 2 }}
                              connectNulls
                            />
                            <Line
                              type="monotone"
                              dataKey="resultatExploitation"
                              name="resultatExploitation"
                              stroke={C.blue}
                              strokeWidth={2}
                              dot={{ r: 2 }}
                              connectNulls
                            />
                            <Line
                              type="monotone"
                              dataKey="resultatNet"
                              name="resultatNet"
                              stroke={C.green}
                              strokeWidth={2}
                              dot={{ r: 2 }}
                              connectNulls
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className={styles.empty}>{t("company.income.empty")}</p>
                    )}
                    <button type="button" className={styles.inlineLinkBtn} onClick={() => setTab("documents")}>
                      {t("company.income.resultsLink")}
                    </button>
                  </section>
                </div>

                <OutlookSynthesisCard synthesis={outlook} />

                <div className={styles.eventsNewsSplit}>
                  <section className={styles.card}>
                    <div className={styles.cardHead}>
                      <h2 className={styles.cardTitle}>{t("company.events.title")}</h2>
                      <span className={styles.cardMeta}>{t("company.events.meta")}</span>
                    </div>
                    <EventsFeed events={events} />
                    <button
                      type="button"
                      className={styles.inlineLinkBtn}
                      onClick={() => setTab("actualites")}
                    >
                      {t("company.events.all")}
                    </button>
                  </section>
                  <section className={styles.card}>
                    <div className={styles.cardHead}>
                      <h2 className={styles.cardTitle}>{t("company.news.title")}</h2>
                      <span className={styles.cardMeta}>{t("company.news.meta")}</span>
                    </div>
                    <NewsFeed news={news} />
                    <button
                      type="button"
                      className={styles.inlineLinkBtn}
                      onClick={() => setTab("actualites")}
                    >
                      {t("company.news.all")}
                    </button>
                  </section>
                </div>

                <section className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.cardTitle}>{t("company.interims.title")}</h2>
                    <span className={styles.cardMeta}>{t("company.interims.meta")}</span>
                  </div>
                  <p className={styles.empty}>{t("company.interims.empty", { ticker: company.ticker })}</p>
                </section>
          </div>

          <aside className={styles.sideCol}>
            <section className={styles.sideCard}>
              <h3 className={styles.sideTitle}>
                <EducationTermLink slug="sante-financiere">{t("company.health.title")}</EducationTermLink>
              </h3>
              <div className={styles.healthScore}>
                <span className={styles.healthBig}>{format.decimal(health.overall, 1)} / 10</span>
                <span className={styles.healthPill} style={{ color: C.green }}>
                  {labels.health(health.label)}
                </span>
              </div>
              <div className={styles.healthBar}>
                <div className={styles.healthFill} style={{ width: `${health.overall * 10}%` }} />
              </div>
              <ul className={styles.pillarList}>
                {health.pillars.map((p) => (
                  <li key={p.key}>
                    <span>
                      <SheetTermLabel french={p.label} text={labels.healthPillar(p.key, p.label)} />
                    </span>
                    <strong>{format.decimal(p.score, 1)}</strong>
                  </li>
                ))}
              </ul>
              <p className={styles.sideNote}>
                {labels.healthNote(health, { score: metrics.score, confidence: metrics.confidence })}
              </p>
            </section>

            <section className={styles.sideCard}>
              <h3 className={styles.sideTitle}>
                <EducationTermLink slug="gestion-du-risque">{t("company.risk.title")}</EducationTermLink>
              </h3>
              <div className={styles.healthScore}>
                <span className={styles.healthBig}>{metrics.riskAnalysis.riskScore}/100</span>
                <span
                  className={styles.healthPill}
                  style={{
                    color:
                      metrics.riskAnalysis.riskScore < 40
                        ? C.green
                        : metrics.riskAnalysis.riskScore > 65
                          ? C.red
                          : C.gold,
                  }}
                >
                  {labels.riskTier(metrics.riskAnalysis.riskTier)}
                </span>
              </div>
              <div className={styles.healthBar}>
                <div
                  className={styles.healthFill}
                  style={{
                    width: `${metrics.riskAnalysis.riskScore}%`,
                    background:
                      metrics.riskAnalysis.riskScore < 40
                        ? C.green
                        : metrics.riskAnalysis.riskScore > 65
                          ? C.red
                          : C.gold,
                  }}
                />
              </div>
              <ul className={styles.pillarList}>
                {metrics.riskAnalysis.pillars.map((p) => {
                  const slug = educationSlugForRiskPillar(p.key);
                  const label = t(`company.risk.link.${p.key}`);
                  return (
                    <li key={p.key}>
                      <span>
                        {slug ? <EducationTermLink slug={slug}>{label}</EducationTermLink> : label}
                      </span>
                      <strong>{p.score == null ? nd : p.score}</strong>
                    </li>
                  );
                })}
              </ul>
              <p className={styles.sideNote}>{riskSummaryText()}</p>
              {(metrics.riskAnalysis.maxDrawdownPercent != null ||
                metrics.riskAnalysis.var95Percent != null) && (
              <p className={styles.sideNote}>
                {metrics.riskAnalysis.maxDrawdownPercent != null ? (
                  <>
                    <EducationTermLink slug="drawdown-maximal">{t("company.risk.drawdown")}</EducationTermLink>
                    {" : "}
                    {loosePercent(metrics.riskAnalysis.maxDrawdownPercent)}
                  </>
                ) : (
                  <>
                    <EducationTermLink slug="drawdown-maximal">{t("company.risk.drawdown")}</EducationTermLink>
                    {" : "}
                    {nd}
                  </>
                )}
                {" · "}
                {metrics.riskAnalysis.var95Percent != null ? (
                  <>
                    <EducationTermLink slug="var-value-at-risk">{t("company.risk.var95")}</EducationTermLink>
                    {" : "}
                    {loosePercent(metrics.riskAnalysis.var95Percent)}
                  </>
                ) : (
                  <>
                    <EducationTermLink slug="var-value-at-risk">{t("company.risk.var95")}</EducationTermLink>
                    {" : "}
                    {nd}
                  </>
                )}
                {metrics.riskAnalysis.var99Percent != null ? (
                  <>
                    {" · "}
                    <EducationTermLink slug="var-value-at-risk">{t("company.risk.var99")}</EducationTermLink>
                    {" : "}
                    {loosePercent(metrics.riskAnalysis.var99Percent)}
                  </>
                ) : null}
                {metrics.riskAnalysis.cvar95Percent != null ? (
                  <>
                    {" · "}
                    <EducationTermLink slug="cvar-expected-shortfall">{t("company.risk.cvar95")}</EducationTermLink>
                    {" : "}
                    {loosePercent(metrics.riskAnalysis.cvar95Percent)}
                  </>
                ) : null}
              </p>
              )}
            </section>

            <section className={styles.sideCard}>
              <h3 className={styles.sideTitle}>{t("company.identity.title")}</h3>
              <dl className={styles.identity}>
                <div>
                  <dt>{t("company.identity.sector")}</dt>
                  <dd>{labels.sector(company.sector)}</dd>
                </div>
                <div>
                  <dt>{t("company.identity.country")}</dt>
                  <dd>
                    {company.countryFlag} {labels.country(company.country)}
                  </dd>
                </div>
                <div>
                  <dt>{t("company.identity.ticker")}</dt>
                  <dd>{company.ticker}</dd>
                </div>
              </dl>
              <p className={styles.sideNote}>{t("company.identity.note")}</p>
            </section>

            <section className={styles.sideCard}>
              <h3 className={styles.sideTitle}>
                <EducationTermLink slug="signal-ouestbourse">{t("company.signal.title")}</EducationTermLink>
              </h3>
              <div className={styles.signalBox} style={{ borderColor: metrics.signal.color }}>
                <div style={{ color: metrics.signal.color, fontWeight: 800 }}>{labels.signal(metrics.signal.label)}</div>
                <div className={styles.sideNote}>
                  <EducationTermLink slug="score-composite">{t("company.signal.score")}</EducationTermLink> {metrics.score}/100 ·{" "}
                  <EducationTermLink slug="confiance-du-signal">{t("company.signal.confidence")}</EducationTermLink>{" "}
                  {labels.confidence(metrics.confidence)}
                </div>
                <p className={styles.signalText}>
                  {labels.signalSummary({
                    label: metrics.signal.label,
                    score: metrics.score,
                    confidence: metrics.confidence,
                    signalSummary: metrics.signalSummary,
                    signalReasons: metrics.signalReasons,
                  })}
                </p>
              </div>
              <ul className={styles.pillarList} style={{ marginTop: 12 }}>
                <li>
                  <span>
                    <SheetTermLabel french="Court terme" text={labels.horizon("COURT", "full")} />
                  </span>
                  <strong>{metrics.horizonScores.court}</strong>
                </li>
                <li>
                  <span>
                    <SheetTermLabel french="Moyen terme" text={labels.horizon("MOYEN", "full")} />
                  </span>
                  <strong>{metrics.horizonScores.moyen}</strong>
                </li>
                <li>
                  <span>
                    <SheetTermLabel french="Long terme" text={labels.horizon("LONG", "full")} />
                  </span>
                  <strong>{metrics.horizonScores.long}</strong>
                </li>
                <li>
                  <span>
                    <SheetTermLabel french="Technique" text={t("company.signal.technical")} />
                  </span>
                  <strong>{metrics.technicalScore}</strong>
                </li>
                <li>
                  <span>
                    <SheetTermLabel french="Fondamental" text={t("company.signal.fundamental")} />
                  </span>
                  <strong>{metrics.fundamentalScore}</strong>
                </li>
                <li>
                  <span>
                    <SheetTermLabel french="Sectoriel" text={t("company.signal.sector")} />
                  </span>
                  <strong>{metrics.sectorScore}</strong>
                </li>
              </ul>
              {metrics.technical.available ? (
                <p className={styles.sideNote}>
                  <EducationTermLink slug="rsi">{t("company.signal.rsi")}</EducationTermLink>
                  {" : "}
                  {metrics.technical.rsi14 ?? nd}
                  {metrics.technical.macd ? (
                    <>
                      {" · "}
                      <EducationTermLink slug="macd">{t("company.signal.macd")}</EducationTermLink>
                      {t("company.signal.macdHist")}
                      {metrics.technical.macd.histogram}
                    </>
                  ) : (
                    <>
                      {" · "}
                      <EducationTermLink slug="macd">{t("company.signal.macd")}</EducationTermLink> {nd}
                    </>
                  )}
                  {metrics.technical.sma10 != null ? (
                    <>
                      {" · "}
                      <EducationTermLink slug="moyenne-mobile">{t("company.signal.sma10")}</EducationTermLink>{" "}
                      {metrics.technical.sma10}
                    </>
                  ) : null}
                  {metrics.technical.sma20 != null ? (
                    <>
                      {" · "}
                      <EducationTermLink slug="moyenne-mobile">{t("company.signal.sma20")}</EducationTermLink>{" "}
                      {metrics.technical.sma20}
                    </>
                  ) : null}
                </p>
              ) : (
                <p className={styles.sideNote}>{t("company.signal.techNd")}</p>
              )}
              <Link href={`/marche`} className={styles.inlineLink}>
                {t("company.signal.seeMarket")}
              </Link>
              <Link
                href={`/outils/taille-position?ticker=${encodeURIComponent(company.ticker)}`}
                className={styles.inlineLink}
              >
                {t("company.positionSizeShort")}
              </Link>
              <button type="button" className={styles.inlineLinkBtn} onClick={() => setTab("charts")}>
                {t("company.signal.chartAnalysis")}
              </button>
            </section>

            <section className={styles.sideCard}>
              <h3 className={styles.sideTitle}>{t("company.provenance.title")}</h3>
              <dl className={styles.identity}>
                <div>
                  <dt>{t("common.source")}</dt>
                  <dd>
                    {company.dataSource
                      ? DATA_SOURCE_KEYS[company.dataSource as keyof typeof DATA_SOURCE_KEYS]
                        ? t(DATA_SOURCE_KEYS[company.dataSource as keyof typeof DATA_SOURCE_KEYS])
                        : company.dataSource
                      : nd}
                  </dd>
                </div>
                <div>
                  <dt>{t("company.provenance.synced")}</dt>
                  <dd>
                    {company.lastSyncedAt
                      ? format.date(company.lastSyncedAt, {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : nd}
                  </dd>
                </div>
                <div>
                  <dt>{t("company.provenance.points")}</dt>
                  <dd>{series.length || nd}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      )}

      {resolvedTab === "projection" && (
        <>
          <PortfolioTypePerspective perspective={analysisPerspective} compact />
          <CompanyProjectionPanel company={company} years={payload.years} metrics={metrics} />
          <OutlookSynthesisCard synthesis={outlook} />
        </>
      )}

      {resolvedTab === "comparison" && (
        <>
          <PortfolioTypePerspective perspective={analysisPerspective} compact />
          <CompanyComparisonPanel company={company} companies={peers} years={payload.years} />
        </>
      )}

      {resolvedTab === "societe" && (
        <>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t("company.profile.title")}</h2>
            <dl className={styles.profileMeta}>
              <div>
                <dt>{t("company.profile.legalName")}</dt>
                <dd>{company.name}</dd>
              </div>
              <div>
                <dt>{t("company.profile.ticker")}</dt>
                <dd>{company.ticker}</dd>
              </div>
              <div>
                <dt>{t("company.profile.isin")}</dt>
                <dd>{isin ?? nd}</dd>
              </div>
              <div>
                <dt>{t("company.profile.shares")}</dt>
                <dd>
                  {profileMeta?.sharesOutstanding != null ? format.number(profileMeta.sharesOutstanding) : nd}
                </dd>
              </div>
              <div>
                <dt>{t("company.profile.float")}</dt>
                <dd>
                  {profileMeta?.floatPercent != null
                    ? `${format.number(profileMeta.floatPercent, { maximumFractionDigits: 8 })}%`
                    : nd}
                </dd>
              </div>
              <div>
                <dt>{t("company.profile.valuation")}</dt>
                <dd>{profileMeta?.valuationLabel ?? nd}</dd>
              </div>
              <div>
                <dt>{t("company.profile.phone")}</dt>
                <dd>{profileMeta?.phone ?? nd}</dd>
              </div>
              <div>
                <dt>{t("company.profile.fax")}</dt>
                <dd>{profileMeta?.fax ?? nd}</dd>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <dt>{t("company.profile.address")}</dt>
                <dd>{profileMeta?.address ?? nd}</dd>
              </div>
            </dl>

            <h3 className={styles.profileDescTitle}>{t("company.profile.description")}</h3>
            {description ? (
              <p className={styles.profileDesc}>{description}</p>
            ) : (
              <p className={styles.empty}>{t("company.profile.descriptionEmpty")}</p>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t("company.profile.details")}</h2>
            <dl className={styles.profileMeta}>
              <div>
                <dt>{t("company.profile.sector")}</dt>
                <dd>{company.sector ? labels.sector(company.sector) : nd}</dd>
              </div>
              <div>
                <dt>{t("company.profile.country")}</dt>
                <dd>
                  {company.country ? `${company.countryFlag} ${labels.country(company.country)}` : nd}
                </dd>
              </div>
              <div>
                <dt>{t("company.profile.industry")}</dt>
                <dd>{profileMeta?.industry ?? nd}</dd>
              </div>
              <div>
                <dt>{t("company.profile.ceo")}</dt>
                <dd>{profileMeta?.ceo ?? profileMeta?.directors ?? nd}</dd>
              </div>
              <div>
                <dt>{t("company.profile.chairman")}</dt>
                <dd>{profileMeta?.chairman ?? nd}</dd>
              </div>
              <div>
                <dt>{t("company.profile.listing")}</dt>
                <dd>{formatListingDate(listedSince ?? profileMeta?.listingDate, format, nd)}</dd>
              </div>
              <div>
                <dt>{t("company.profile.website")}</dt>
                <dd>
                  {profileMeta?.website ? (
                    <a
                      href={websiteHref(profileMeta.website) ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.extLink}
                    >
                      {websiteLabel(profileMeta.website)}
                    </a>
                  ) : (
                    nd
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <div className={styles.societeSplit}>
            <ShareholdingPanel profileMeta={profileMeta} />

            <section className={styles.card}>
              <h2 className={styles.cardTitle}>{t("company.profile.peers")}</h2>
              <p className={styles.sideNote} style={{ marginTop: 0, marginBottom: 8 }}>
                {t("company.profile.sectorLine", { sector: labels.sector(company.sector) })}
              </p>
              {sectorPeers.length === 0 ? (
                <p className={styles.empty}>{t("company.profile.noPeers")}</p>
              ) : (
                <ul className={styles.peerList}>
                  {sectorPeers.map((p) => (
                    <li key={p.ticker}>
                      <Link href={`/actions/${p.ticker}`} className={styles.peerLink}>
                        <span className={styles.peerTicker}>{p.ticker}</span>
                        <span className={styles.peerName}>
                          {p.countryFlag} {p.name}
                        </span>
                        <strong className={styles.peerPrice}>
                          {p.lastPrice > 0 ? format.fcfa(p.lastPrice) : nd}
                        </strong>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      {resolvedTab === "actualites" && (
        <div className={styles.eventsNewsSplit}>
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>{t("company.events.title")}</h2>
              <span className={styles.cardMeta}>{t("company.events.meta")}</span>
            </div>
            <EventsFeed events={events} />
          </section>
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>{t("company.news.title")}</h2>
              <span className={styles.cardMeta}>{t("company.news.meta")}</span>
            </div>
            <NewsFeed news={news} />
          </section>
        </div>
      )}

      {resolvedTab === "documents" && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>{t("company.docs.title")}</h2>
            <span className={styles.cardMeta}>{t("company.docs.meta")}</span>
          </div>
          <div className={styles.docToolbar}>
            <div className={styles.docFilters} role="group" aria-label={t("company.docs.filterAria")}>
              <button
                type="button"
                className={docFilter === "all" ? styles.docChipActive : styles.docChip}
                onClick={() => setDocFilter("all")}
              >
                {t("company.docs.all", { count: documents.length })}
              </button>
              <button
                type="button"
                className={docFilter === "results" ? styles.docChipActive : styles.docChip}
                onClick={() => setDocFilter("results")}
              >
                {t("company.docs.results", { count: resultsDocCount })}
              </button>
            </div>
            <button
              type="button"
              className={styles.btnOutline}
              onClick={() => void refreshDocuments()}
              disabled={docsRefreshing}
            >
              {docsRefreshing ? t("company.docs.refreshing") : t("company.docs.refresh")}
            </button>
          </div>
          {docsRefreshNote ? <p className={styles.docNote}>{docsRefreshNote}</p> : null}
          {visibleDocuments.length === 0 ? (
            <p className={styles.empty}>
              {documents.length === 0 ? t("company.docs.empty") : t("company.docs.noResults")}
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.docsTable}>
                <thead>
                  <tr>
                    <th scope="col">{t("company.docs.published")}</th>
                    <th scope="col">{t("company.docs.type")}</th>
                    <th scope="col">{t("company.docs.period")}</th>
                    <th scope="col">{t("company.docs.heading")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDocuments.map((d) => {
                    const label = d.filename || d.title || d.url;
                    return (
                      <tr key={d.id} className={d.kind === "results" ? styles.docResultRow : undefined}>
                        <td>{d.publishedAt ?? nd}</td>
                        <td>{d.docType ?? nd}</td>
                        <td>{d.periodLabel ?? nd}</td>
                        <td>
                          <a href={d.url} target="_blank" rel="noopener noreferrer">
                            {label}
                          </a>
                          {d.kind === "results" ? (
                            <span className={styles.docBadge}>{t("company.docs.resultsBadge")}</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
