"use client";

// Tableau Marché : liste + aperçus sparklines + lignes expansibles (perf / liens).

import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { calcMetrics } from "@/lib/calc/calc-metrics";
import { pricesSyncedToLatestClose } from "@/lib/calc/sync-prices-to-closes";
import type { CompaniesFullDataset, CompanyFullDataset } from "@/lib/api/companies-full-dataset";
import type { MarketSummarySnapshot } from "@/lib/api/market-summary-snapshot";
import { DEFAULT_EXCHANGE_CODE, getExchange } from "@/lib/markets/african-exchanges";
import {
  annualSeriesFromPrices,
  filterSeriesByHorizon,
  horizonChangePercent,
  type MarketHorizon,
} from "@/lib/markets/market-horizon";
import type { ChartClosePoint } from "@/lib/charts/indicators";
import MarketSparkline from "@/components/marche/MarketSparkline";
import HorizonSelect from "@/components/marche/HorizonSelect";
import ColumnFilterRow from "@/components/ui/ColumnFilterRow";
import ExpandChevron from "@/components/ui/ExpandChevron";
import {
  applyColumnSort,
  type ColumnFilterDef,
  type ColumnSortState,
} from "@/lib/ui/column-filters";
import marketStyles from "@/components/marche/MarketChrome.module.css";
import styles from "@/components/marche/MarketBoard.module.css";
import { C } from "@/lib/theme/colors";
import ChangeValue from "@/components/ui/ChangeValue";
import SignalBadge from "@/components/ui/SignalBadge";
import { preserveScrollDuring } from "@/lib/ui/scroll-restoration";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import { trackFeature } from "@/components/analytics/track-client";
import EducationTermLink from "@/components/education/EducationTermLink";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  displayPillarNote,
  displayRiskSummary,
  translateExchangeName,
  translateExchangeRegion,
} from "@/components/marche/market-copy";
import { educationSlugForAnalysisLabel, educationSlugForRiskPillar } from "@/lib/education/analysis-terms";
import type { TFunc } from "@/lib/i18n/create-i18n";
import type { FormatApi } from "@/lib/i18n/format";
import { frameCompanyForPortfolioType, type PortfolioTypeId } from "@/lib/portfolio-types";
import { usePortfolioType } from "@/lib/portfolio-types/use-portfolio-type";
import PortfolioTypeSelector from "@/components/portfolio-types/PortfolioTypeSelector";
import PortfolioTypePerspective from "@/components/portfolio-types/PortfolioTypePerspective";

export interface MarketBoardClientProps {
  initialData: CompaniesFullDataset;
  initialMarketSummary?: MarketSummarySnapshot | null;
  /** Clôtures datées réelles (source de vérité pour les aperçus). */
  initialSparkSeries?: Record<string, ChartClosePoint[]>;
  /** Variation journalière officielle (BRVM) par ticker. */
  initialDayChanges?: Record<string, number | null>;
  preferredPortfolioType?: PortfolioTypeId | null;
}

const COL_COUNT = 11;
const PAGE_SIZE = 20;
const NUMERIC_DATE: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

type MarketRow = CompanyFullDataset;

function formatCap(mktcap: number, format: FormatApi, t: TFunc): string {
  if (!(mktcap > 0)) return "N/D";
  return t("market.cap", { amount: format.number(mktcap) });
}

function AnalysisLabel({ french, text }: { french: string; text: string }) {
  const slug = educationSlugForAnalysisLabel(french);
  if (!slug) return <>{text}</>;
  return <EducationTermLink slug={slug}>{text}</EducationTermLink>;
}

export default function MarketBoardClient({
  initialData,
  initialMarketSummary = null,
  initialSparkSeries = {},
  initialDayChanges = {},
  preferredPortfolioType = null,
}: MarketBoardClientProps) {
  const { t, format, labels } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const pageKey = `ouestbourse:marche:${pathname}`;

  const [dataset, setDataset] = useState(initialData);
  const [marketSummary, setMarketSummary] = useState(initialMarketSummary);
  const [sparkSeriesByTicker, setSparkSeriesByTicker] = useState(initialSparkSeries);
  const [dayChangesByTicker, setDayChangesByTicker] = useState(initialDayChanges);
  const [query, setQuery] = usePersistedState(`${pageKey}:query`, "");
  const [sectorFilter, setSectorFilter] = usePersistedState(`${pageKey}:sector`, "Tous");
  const [sortBy, setSortBy] = usePersistedState<"score" | "perf5" | "yield" | "price" | "mktcap">(
    `${pageKey}:sort`,
    "score"
  );
  const [horizon, setHorizon] = usePersistedState<MarketHorizon>(`${pageKey}:horizon`, "1A");
  const {
    type: portfolioType,
    setType: setPortfolioType,
    profileDefault,
    isOverride,
    resetToProfile,
  } = usePortfolioType(preferredPortfolioType);
  const [expanded, setExpanded] = usePersistedState<string | null>(`${pageKey}:expanded`, null);
  const [colSort, setColSort] = useState<ColumnSortState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [lastUpdate, setLastUpdate] = useState(() => format.date(initialData.generatedAt, NUMERIC_DATE));

  const exchange = getExchange(DEFAULT_EXCHANGE_CODE);
  const companies = dataset.companies;
  const years = dataset.years;

  const metricsByTicker = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calcMetrics>>();
    for (const co of companies) {
      const closes = sparkSeriesByTicker[co.ticker];
      map.set(
        co.ticker,
        calcMetrics({
          years,
          prices: pricesSyncedToLatestClose(co.prices, closes),
          dividends: co.dividends,
          per: co.per,
          mktcap: co.mktcap,
          sector: co.sector,
          closes: closes && closes.length > 0 ? closes : undefined,
        })
      );
    }
    return map;
  }, [companies, years, sparkSeriesByTicker]);

  const sparkByTicker = useMemo(() => {
    const map = new Map<string, { values: number[]; changePct: number | null }>();
    for (const co of companies) {
      const dated = sparkSeriesByTicker[co.ticker];
      const base =
        dated && dated.length > 0 ? dated : annualSeriesFromPrices(co.prices, years);
      const series = filterSeriesByHorizon(base, horizon);
      map.set(co.ticker, {
        values: series.map((p) => p.value),
        changePct: horizonChangePercent(series),
      });
    }
    return map;
  }, [companies, years, horizon, sparkSeriesByTicker]);

  const dayChangeByTicker = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const co of companies) {
      const stored = dayChangesByTicker[co.ticker];
      map.set(co.ticker, stored === undefined ? null : stored);
    }
    return map;
  }, [companies, dayChangesByTicker]);

  const sectors = useMemo(
    () => ["Tous", ...Array.from(new Set(companies.map((c) => c.sector))).sort()],
    [companies]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = companies.filter((c) => {
      if (sectorFilter !== "Tous" && c.sector !== sectorFilter) return false;
      if (!q) return true;
      return c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) => {
      const ma = metricsByTicker.get(a.ticker)!;
      const mb = metricsByTicker.get(b.ticker)!;
      if (sortBy === "score") return mb.score - ma.score;
      if (sortBy === "perf5") {
        const va = ma.perf5Percent === "N/D" ? -999 : parseFloat(ma.perf5Percent);
        const vb = mb.perf5Percent === "N/D" ? -999 : parseFloat(mb.perf5Percent);
        return vb - va;
      }
      if (sortBy === "yield") {
        return parseFloat(String(mb.dividendYieldPercent)) - parseFloat(String(ma.dividendYieldPercent));
      }
      if (sortBy === "mktcap") return (b.mktcap || 0) - (a.mktcap || 0);
      return (mb.currentPrice || 0) - (ma.currentPrice || 0);
    });
    return list;
  }, [companies, query, sectorFilter, sortBy, metricsByTicker]);

  const marketColDefs = useMemo<ColumnFilterDef<MarketRow>[]>(
    () => [
      { key: "ticker", label: t("market.columns.ticker"), getValue: (co) => co.ticker, sortKind: "text" },
      { key: "name", label: t("market.columns.company"), getValue: (co) => co.name, sortKind: "text" },
      {
        key: "sector",
        label: t("market.columns.activity"),
        getValue: (co) => co.sector || "N/D",
        sortKind: "text",
      },
      {
        key: "dayChg",
        label: t("market.columns.dayChange"),
        sortKind: "number",
        getValue: (co) => {
          const d = dayChangeByTicker.get(co.ticker);
          return d == null ? "N/D" : String(d);
        },
      },
      {
        key: "apercu",
        label: t("market.columns.preview"),
        sortKind: "number",
        getValue: (co) => {
          const chg = sparkByTicker.get(co.ticker)?.changePct;
          return chg == null ? "N/D" : String(chg);
        },
      },
      {
        key: "price",
        label: t("market.columns.price"),
        sortKind: "number",
        getValue: (co) => {
          const p = metricsByTicker.get(co.ticker)?.currentPrice ?? 0;
          return p > 0 ? String(p) : "N/D";
        },
      },
      {
        key: "mktcap",
        label: t("market.columns.mktCap"),
        sortKind: "number",
        getValue: (co) => (!(co.mktcap > 0) ? "N/D" : String(co.mktcap)),
      },
      {
        key: "yield",
        label: t("market.columns.divYieldShort"),
        sortKind: "number",
        getValue: (co) => String(metricsByTicker.get(co.ticker)?.dividendYieldPercent ?? ""),
      },
      {
        key: "score",
        label: t("market.columns.score"),
        sortKind: "number",
        getValue: (co) => String(metricsByTicker.get(co.ticker)?.score ?? ""),
      },
      {
        key: "signal",
        label: t("market.columns.signal"),
        sortKind: "text",
        getValue: (co) => metricsByTicker.get(co.ticker)?.signal.label ?? "",
      },
      {
        key: "confidence",
        label: t("market.columns.confidence"),
        sortKind: "text",
        getValue: (co) => metricsByTicker.get(co.ticker)?.confidence ?? "",
      },
    ],
    [metricsByTicker, sparkByTicker, dayChangeByTicker, t]
  );

  const displayRows = useMemo(
    () => applyColumnSort(rows, marketColDefs, colSort),
    [rows, marketColDefs, colSort]
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, sectorFilter, sortBy, colSort]);

  const pagedRows = useMemo(
    () => displayRows.slice(0, visibleCount),
    [displayRows, visibleCount]
  );

  const totalMktCap = useMemo(() => companies.reduce((a, b) => a + (b.mktcap || 0), 0), [companies]);
  const indexPills = useMemo(() => {
    if (!marketSummary) return [];
    return [...marketSummary.headlineIndices, ...marketSummary.otherIndices].slice(0, 6);
  }, [marketSummary]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await preserveScrollDuring(async () => {
        const res = await fetch("/api/market/refresh-quotes", { method: "POST", cache: "no-store" });
        const json = await res.json();
        if (json.ok && json.data?.dataset) {
          setDataset(json.data.dataset as CompaniesFullDataset);
          setLastUpdate(format.date(json.data.dataset.generatedAt, NUMERIC_DATE));
        }
        if (json.ok && json.data?.sparkSeries) {
          setSparkSeriesByTicker(json.data.sparkSeries as Record<string, ChartClosePoint[]>);
        }
        if (json.ok && json.data?.dayChanges) {
          setDayChangesByTicker(json.data.dayChanges as Record<string, number | null>);
        }
        const sumRes = await fetch("/api/market/summary", { cache: "no-store" });
        const sumJson = await sumRes.json();
        if (sumJson.ok) {
          setMarketSummary({
            headlineIndices: sumJson.data.headlineIndices ?? [],
            otherIndices: (sumJson.data.otherIndices ?? []).slice(0, 8),
            asOf: sumJson.data.asOf ?? new Date().toISOString(),
          });
        }
      });
    } finally {
      setRefreshing(false);
    }
  }, [format]);

  /** Recharge cours + séries depuis la base (sans re-scraper BRVM) pour recalculer le score. */
  const reloadFromDb = useCallback(async () => {
    await preserveScrollDuring(async () => {
      try {
        const [fullRes, sparkRes] = await Promise.all([
          fetch("/api/companies/full", { cache: "no-store" }),
          fetch("/api/market/spark-series", { cache: "no-store" }),
        ]);
        const fullJson = await fullRes.json();
        const sparkJson = await sparkRes.json();
        if (fullJson.ok && fullJson.data) {
          setDataset(fullJson.data as CompaniesFullDataset);
          setLastUpdate(format.date(fullJson.data.generatedAt, NUMERIC_DATE));
        }
        if (sparkJson.ok && sparkJson.data?.sparkSeries) {
          setSparkSeriesByTicker(sparkJson.data.sparkSeries as Record<string, ChartClosePoint[]>);
        }
        if (sparkJson.ok && sparkJson.data?.dayChanges) {
          setDayChangesByTicker(sparkJson.data.dayChanges as Record<string, number | null>);
        }
      } catch {
        // best-effort : le prochain cycle ou Actualiser suffira
      }
    });
  }, [format]);

  useEffect(() => {
    const SOFT_MS = 3 * 60_000;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void reloadFromDb();
    }, SOFT_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void reloadFromDb();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reloadFromDb]);

  function toggleRow(ticker: string) {
    setExpanded((cur) => (cur === ticker ? null : ticker));
    trackFeature("marche", "expand_row");
  }

  function handleHorizon(next: MarketHorizon) {
    setHorizon(next);
    trackFeature("marche", `horizon:${next}`);
  }

  const buySignals = companies.filter((c) => (metricsByTicker.get(c.ticker)?.score ?? 0) >= 65).length;
  const avgYield =
    companies.length === 0
      ? "N/D"
      : `${(
          companies.reduce(
            (a, c) => a + parseFloat(String(metricsByTicker.get(c.ticker)!.dividendYieldPercent)),
            0
          ) / companies.length
        ).toFixed(2)}%`;

  return (
    <div className={styles.page}>
      <MarketChrome
        lastUpdate={lastUpdate}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        companiesCount={companies.length}
        totalMktCap={totalMktCap}
        buySignals={buySignals}
        avgYield={avgYield}
        indexPills={indexPills}
        currency={exchange.currency}
        exchangeCode={exchange.code}
        exchangeName={exchange.name}
        region={exchange.region}
      />

      <section className={styles.board} data-align-left>
        <div className={styles.boardHead}>
          <div>
            <h2 className={styles.boardTitle}>
              {t("market.board.positions", { count: displayRows.length })}
              {displayRows.length > PAGE_SIZE
                ? ` ${t("market.board.shown", { count: pagedRows.length })}`
                : ""}
            </h2>
            <p className={styles.boardSub}>{t("market.board.subtitle")}</p>
          </div>
          <div className={styles.filters}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("market.board.searchPlaceholder")}
              aria-label={t("market.board.searchAria")}
              className={styles.search}
            />
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              aria-label={t("market.board.sectorAria")}
              className={styles.select}
            >
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s === "Tous" ? t("market.all") : labels.sector(s)}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label={t("market.board.sortAria")}
              className={styles.select}
            >
              <option value="score">{t("market.board.sortScore")}</option>
              <option value="mktcap">{t("market.board.sortCap")}</option>
              <option value="yield">{t("market.board.sortYield")}</option>
              <option value="price">{t("market.board.sortPrice")}</option>
              <option value="perf5">{t("market.board.sortPerf5")}</option>
            </select>
          </div>
        </div>
        <PortfolioTypeSelector
          value={portfolioType}
          onChange={setPortfolioType}
          profileDefault={profileDefault}
          isOverride={isOverride}
          onResetToProfile={resetToProfile}
          compact
          idPrefix="marche"
        />

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <ColumnFilterRow
                columns={marketColDefs.map((d) =>
                  d.key === "apercu"
                    ? {
                        ...d,
                        header: (
                          <span className={styles.apercuHead}>
                            <span>{t("market.columns.preview")}</span>
                            <label className={styles.horizonInline}>
                              <span className={styles.srOnly}>{t("market.board.horizonLabel")}</span>
                              <HorizonSelect value={horizon} onChange={handleHorizon} />
                            </label>
                          </span>
                        ),
                      }
                    : d
                )}
                sort={colSort}
                onSortChange={setColSort}
              />
            </thead>
            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className={styles.empty}>
                    {companies.length === 0 ? (
                      <span className={styles.skeletonHint}>{t("market.board.loading")}</span>
                    ) : (
                      t("market.board.empty")
                    )}
                  </td>
                </tr>
              ) : (
                pagedRows.map((co) => {
                  const m = metricsByTicker.get(co.ticker)!;
                  const spark = sparkByTicker.get(co.ticker)!;
                  const open = expanded === co.ticker;
                  const chg = spark.changePct;
                  const dayChg = dayChangeByTicker.get(co.ticker) ?? null;
                  return (
                    <Fragment key={co.ticker}>
                      <tr
                        className={open ? styles.rowOpen : undefined}
                        onClick={() => toggleRow(co.ticker)}
                        tabIndex={0}
                        aria-expanded={open}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleRow(co.ticker);
                          }
                        }}
                      >
                        <td className={styles.tickerCell}>
                          <ExpandChevron
                            expanded={open}
                            label={
                              open
                                ? t("market.board.hideDetail", { ticker: co.ticker })
                                : t("market.board.showDetail", { ticker: co.ticker })
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleRow(co.ticker);
                            }}
                          />
                          <span className={styles.ticker} style={{ color: co.color }}>
                            {co.ticker}
                          </span>{" "}
                          <span aria-hidden="true">{co.countryFlag}</span>
                        </td>
                        <td>
                          <div className={styles.name}>{co.name}</div>
                        </td>
                        <td className={styles.sectorCell} title={t("market.board.activityTitle")}>
                          {co.sector?.trim() ? labels.sector(co.sector) : "N/D"}
                        </td>
                        <td className={styles.dayChg}>
                          <ChangeValue value={dayChg} title={t("market.board.dayChangeTitle")} />
                        </td>
                        <td>
                          <div className={styles.sparkCell}>
                            <MarketSparkline values={spark.values} width={140} height={36} />
                            <span className={styles.sparkChg} title={t("market.board.horizonChangeTitle")}>
                              {chg == null ? (
                                <span className="ob-nd">N/D</span>
                              ) : (
                                <ChangeValue value={chg} />
                              )}
                            </span>
                          </div>
                        </td>
                        <td className={styles.num}>
                          {m.currentPrice > 0
                            ? `${format.number(m.currentPrice)} ${exchange.currency}`
                            : "N/D"}
                        </td>
                        <td className={styles.num} style={{ color: C.gold }}>
                          {formatCap(co.mktcap, format, t)}
                        </td>
                        <td className={styles.num} style={{ color: C.teal }}>
                          {m.dividendYieldPercent}%
                        </td>
                        <td>
                          <span
                            className={styles.score}
                            style={{ color: m.signal.color, background: `${m.signal.color}22` }}
                          >
                            {m.score}
                          </span>
                        </td>
                        <td>
                          <SignalBadge
                            label={m.signal.label}
                            title={labels.signalSummary({
                              label: m.signal.label,
                              score: m.score,
                              confidence: m.confidence,
                              signalSummary: m.signalSummary,
                              signalReasons: m.signalReasons,
                            })}
                          />
                        </td>
                        <td className={styles.meta}>{labels.confidence(m.confidence)}</td>
                      </tr>
                      {open && (
                        <tr className={styles.detailRow}>
                          <td colSpan={COL_COUNT}>
                            <ExpandedPanel
                              company={co}
                              metrics={m}
                              currency={exchange.currency}
                              portfolioType={portfolioType}
                              onPrefetch={(href) => router.prefetch(href)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {visibleCount < displayRows.length ? (
          <div className={styles.moreWrap}>
            <button
              type="button"
              className={styles.moreBtn}
              onClick={() => setVisibleCount((n) => Math.min(n + PAGE_SIZE, displayRows.length))}
            >
              {t("market.board.showMore", { count: displayRows.length - visibleCount })}
            </button>
          </div>
        ) : null}
      </section>

      <ScoreExplainer />
    </div>
  );
}

function ExpandedPanel({
  company,
  metrics: m,
  currency,
  portfolioType,
  onPrefetch,
}: {
  company: CompanyFullDataset;
  metrics: ReturnType<typeof calcMetrics>;
  currency: string;
  portfolioType: PortfolioTypeId;
  onPrefetch?: (href: string) => void;
}) {
  const { t, format, labels, locale } = useI18n();
  const perf10 = m.perf10Percent === "N/D" ? null : parseFloat(m.perf10Percent);
  const vol = m.volatilityPercent === "N/D" ? null : parseFloat(m.volatilityPercent);

  const cards: Array<{ key: string; label: string; text: string; value: string; color?: string }> = [
    {
      key: "price",
      label: "Cours actuel",
      text: t("market.cards.price"),
      value: m.currentPrice > 0 ? `${format.number(m.currentPrice)} ${currency}` : "N/D",
    },
    {
      key: "mktcap",
      label: "Cap. boursière",
      text: t("market.cards.mktCap"),
      value: formatCap(company.mktcap, format, t),
      color: C.gold,
    },
    {
      key: "perf5",
      label: "Perf. 5 ans",
      text: t("market.cards.perf5"),
      value: m.perf5Percent === "N/D" ? "N/D" : `${parseFloat(m.perf5Percent) >= 0 ? "+" : ""}${m.perf5Percent}%`,
      color: m.perf5Percent === "N/D" ? C.textDim : parseFloat(m.perf5Percent) >= 0 ? C.green : C.red,
    },
    {
      key: "perf10",
      label: "Perf. 10 ans",
      text: t("market.cards.perf10"),
      value: perf10 == null ? "N/D" : `${perf10 >= 0 ? "+" : ""}${m.perf10Percent}%`,
      color: perf10 == null ? C.textDim : perf10 >= 0 ? C.green : C.red,
    },
    {
      key: "yield",
      label: "Rendement div.",
      text: t("market.cards.divYield"),
      value: `${m.dividendYieldPercent}%`,
      color: C.teal,
    },
    {
      key: "per",
      label: "PER",
      text: t("market.cards.per"),
      value: company.per > 0 ? company.per.toFixed(2) : "N/D",
      color: C.blue,
    },
    {
      key: "vol",
      label: "Volatilité",
      text: t("market.cards.volatility"),
      value: vol == null ? "N/D" : `${m.volatilityPercent}%`,
    },
    {
      key: "risk",
      label: "Risque (volatilité)",
      text: t("market.cards.riskVol"),
      value: labels.riskLevel(m.riskLevel),
    },
    {
      key: "riskMgmt",
      label: "Gestion du risque",
      text: t("market.cards.riskMgmt"),
      value: `${labels.riskTier(m.riskAnalysis.riskTier)} · ${m.riskAnalysis.riskScore}/100`,
      color:
        m.riskAnalysis.riskScore < 40 ? C.green : m.riskAnalysis.riskScore > 65 ? C.red : C.gold,
    },
    {
      key: "horizons",
      label: "Horizons C/M/L",
      text: t("market.cards.horizons"),
      value: `${m.horizonScores.court} / ${m.horizonScores.moyen} / ${m.horizonScores.long}`,
    },
    {
      key: "confidence",
      label: "Confiance",
      text: t("market.cards.confidence"),
      value: labels.confidence(m.confidence),
    },
    {
      key: "score",
      label: "Score / Signal",
      text: t("market.cards.scoreSignal"),
      value: `${m.score}/100 · ${labels.signal(m.signal.label)}`,
      color: m.signal.color,
    },
  ];

  return (
    <div className={styles.detail} onClick={(e) => e.stopPropagation()}>
      <PortfolioTypePerspective
        perspective={frameCompanyForPortfolioType({
          type: portfolioType,
          ticker: company.ticker,
          name: company.name,
          metrics: m,
        })}
        compact
      />
      <p className={styles.detailSummary}>
        {labels.signalSummary({
          label: m.signal.label,
          score: m.score,
          confidence: m.confidence,
          signalSummary: m.signalSummary,
          signalReasons: m.signalReasons,
        })}
      </p>
      <p className={styles.detailSummary} style={{ color: C.textDim, fontSize: "0.78rem" }}>
        {displayRiskSummary(m.riskAnalysis, locale, labels)}
      </p>
      <div className={styles.detailGrid}>
        {cards.map((c) => {
          return (
            <div key={c.key} className={styles.detailCard}>
              <div className={styles.detailLabel}>
                <AnalysisLabel french={c.label} text={c.text} />
              </div>
              <div className={styles.detailValue} style={c.color ? { color: c.color } : undefined} title={c.value}>
                {c.value}
              </div>
            </div>
          );
        })}
      </div>
      {m.riskAnalysis.pillars.length > 0 && (
        <ul className={styles.reasonList}>
          {m.riskAnalysis.pillars.map((p) => {
            const slug = educationSlugForRiskPillar(p.key);
            const pillarLabel = labels.riskPillar(p.key, p.label);
            return (
              <li key={p.key}>
                <span aria-hidden="true">●</span>{" "}
                {slug ? <EducationTermLink slug={slug}>{pillarLabel}</EducationTermLink> : pillarLabel} :{" "}
                {p.score == null ? "N/D" : `${p.score}/100`} — {displayPillarNote(p.note, locale, labels)}
              </li>
            );
          })}
        </ul>
      )}
      {m.signalReasons?.length > 0 && (
        <ul className={styles.reasonList}>
          {m.signalReasons.map((r, i) => (
            <li key={`${r.kind}-${i}`}>
              <span aria-hidden="true">{r.kind === "positif" ? "▲" : r.kind === "negatif" ? "▼" : "●"}</span>{" "}
              {labels.reason(r)}
            </li>
          ))}
        </ul>
      )}
      <div className={styles.detailLinks}>
        <Link
          href={`/actions/${company.ticker}`}
          className={styles.primaryBtn}
          data-analytics-feature="company_sheet"
          data-analytics-action="from_marche"
          onMouseEnter={() => onPrefetch?.(`/actions/${company.ticker}`)}
          onFocus={() => onPrefetch?.(`/actions/${company.ticker}`)}
        >
          {t("market.board.companyDetails")}
        </Link>
        <Link
          href={`/graphes?ticker=${company.ticker}`}
          className={styles.secondaryBtn}
          data-analytics-feature="graphes"
          data-analytics-action="from_marche"
          onMouseEnter={() => onPrefetch?.(`/graphes?ticker=${company.ticker}`)}
          onFocus={() => onPrefetch?.(`/graphes?ticker=${company.ticker}`)}
        >
          {t("market.board.chartAnalysis")}
        </Link>
      </div>
    </div>
  );
}

function ScoreExplainer() {
  const { t, labels } = useI18n();
  const levels = {
    low: labels.confidence("Faible"),
    mid: labels.confidence("Moyenne"),
    high: labels.confidence("Élevée"),
  };
  return (
    <section className={styles.scoreBox} aria-labelledby="score-how">
      <h3 id="score-how" className={styles.scoreBoxTitle}>
        {t("market.score.title")}
      </h3>
      <p className={styles.scoreBoxLead}>{t("market.score.lead")}</p>
      <ol className={styles.scoreList}>
        <li>
          <strong>
            <EducationTermLink slug="score-technique">{t("market.score.tech")}</EducationTermLink>{" "}
            {t("market.score.weight40")}
          </strong>{" "}
          {t("market.score.techBody")}
        </li>
        <li>
          <strong>
            <EducationTermLink slug="score-fondamental">{t("market.score.fundamental")}</EducationTermLink>{" "}
            {t("market.score.weight40")}
          </strong>{" "}
          {t("market.score.fundamentalBody")}
        </li>
        <li>
          <strong>
            <EducationTermLink slug="gestion-du-risque">{t("market.score.risk")}</EducationTermLink>{" "}
            {t("market.score.weight20")}
          </strong>{" "}
          {t("market.score.riskBody")}
        </li>
        <li>
          <strong>
            <EducationTermLink slug="confiance-du-signal">{t("market.score.confidence")}</EducationTermLink>
          </strong>{" "}
          {t("market.score.confidenceBody")}
        </li>
      </ol>
      <p className={styles.scoreBoxNote}>
        {t("market.score.noteLead")} <strong>{t("market.score.noteWord")}</strong>{" "}
        {t("market.score.noteRest", levels)}
      </p>
    </section>
  );
}

function MarketChrome(props: {
  lastUpdate: string;
  refreshing: boolean;
  onRefresh: () => void;
  companiesCount: number;
  totalMktCap: number;
  buySignals: number;
  avgYield: string;
  indexPills: MarketSummarySnapshot["headlineIndices"];
  currency: string;
  exchangeCode: string;
  exchangeName: string;
  region: string;
}) {
  const { t, format } = useI18n();
  const region = translateExchangeRegion(props.exchangeCode, props.region, t);
  const kpis = [
    { key: "listed", l: t("market.kpi.listed"), v: String(props.companiesCount), c: C.blue },
    {
      key: "cap",
      l: t("market.kpi.totalCap"),
      v:
        props.totalMktCap > 0
          ? t("market.capCurrency", { amount: format.number(props.totalMktCap), currency: props.currency })
          : "N/D",
      c: C.gold,
    },
    { key: "yield", l: t("market.kpi.avgYield"), v: props.avgYield, c: C.green },
    { key: "buy", l: t("market.kpi.buySignals"), v: String(props.buySignals), c: C.green },
  ];
  return (
    <div className={marketStyles.shell}>
      <div className={marketStyles.topBar}>
        <div className={marketStyles.topRow}>
          <div>
            <div className={marketStyles.label}>{t("market.title")}</div>
            <h1 className={marketStyles.pageTitle}>{t("market.overview")}</h1>
            <p className={marketStyles.marketIdentity}>
              {translateExchangeName(props.exchangeCode, props.exchangeName, t)}
            </p>
            <p className={marketStyles.marketMeta}>
              {t("market.exchange.meta", { region, currency: props.currency })}
            </p>
          </div>
          <div className={marketStyles.actions}>
            <div style={{ fontSize: "0.72rem", color: C.textDim }}>
              <span className="ob-live-dot ob-pulse" aria-hidden="true" />
              {t("market.lastUpdate")} <span style={{ color: C.gold }}>{props.lastUpdate}</span>
            </div>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={props.onRefresh}
              disabled={props.refreshing}
              aria-label={props.refreshing ? t("market.refreshingAria") : t("market.refreshAria")}
            >
              {props.refreshing ? t("market.refreshing") : t("market.refresh")}
            </button>
          </div>
        </div>
      </div>

      <div className={marketStyles.kpiStrip}>
        {kpis.map((k) => (
          <div key={k.key} className={marketStyles.kpiCard}>
            <div className={marketStyles.kpiLabel}>{k.l}</div>
            <div className={`${marketStyles.kpiValue} ob-num`} style={{ color: k.c }}>
              {k.v === "N/D" ? <span className="ob-nd">N/D</span> : k.v}
            </div>
          </div>
        ))}
      </div>
      <div className={marketStyles.indicesStrip} aria-label={t("market.indicesAria")}>
        {props.indexPills.length === 0 ? (
          <Link href="/indices" className={marketStyles.indexPill}>
            <div className={marketStyles.indexName}>{t("market.indices.title")}</div>
            <div className={marketStyles.indexValue} style={{ color: C.textDim }}>
              N/D
            </div>
          </Link>
        ) : (
          props.indexPills.map((idx) => (
            <Link key={idx.code} href={`/indices/${idx.code}`} className={marketStyles.indexPill}>
              <div className={marketStyles.indexName}>{idx.name}</div>
              <div className={`${marketStyles.indexValue} ob-num`}>
                {format.number(idx.value, { maximumFractionDigits: 2 })}
              </div>
              <div className={marketStyles.indexChg}>
                <ChangeValue value={idx.changePercent} />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
