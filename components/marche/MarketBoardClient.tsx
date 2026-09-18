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
import {
  educationSlugForAnalysisLabel,
  educationSlugForRiskPillar,
} from "@/lib/education/analysis-terms";

export interface MarketBoardClientProps {
  initialData: CompaniesFullDataset;
  initialMarketSummary?: MarketSummarySnapshot | null;
  /** Clôtures datées réelles (source de vérité pour les aperçus). */
  initialSparkSeries?: Record<string, ChartClosePoint[]>;
  /** Variation journalière officielle (BRVM) par ticker. */
  initialDayChanges?: Record<string, number | null>;
}

const COL_COUNT = 11;
const PAGE_SIZE = 20;

type MarketRow = CompanyFullDataset;

function formatMktCap(mktcap: number): string {
  if (!(mktcap > 0)) return "N/D";
  return `${mktcap.toLocaleString("fr-FR")} Mds`;
}

export default function MarketBoardClient({
  initialData,
  initialMarketSummary = null,
  initialSparkSeries = {},
  initialDayChanges = {},
}: MarketBoardClientProps) {
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
  const [expanded, setExpanded] = usePersistedState<string | null>(`${pageKey}:expanded`, null);
  const [colSort, setColSort] = useState<ColumnSortState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [lastUpdate, setLastUpdate] = useState(() =>
    new Date(initialData.generatedAt).toLocaleDateString("fr-FR")
  );

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
      { key: "ticker", label: "Ticker", getValue: (co) => co.ticker, sortKind: "text" },
      { key: "name", label: "Société", getValue: (co) => co.name, sortKind: "text" },
      {
        key: "sector",
        label: "Domaine d'activité",
        getValue: (co) => co.sector || "N/D",
        sortKind: "text",
      },
      {
        key: "dayChg",
        label: "Var. j.",
        sortKind: "number",
        getValue: (co) => {
          const d = dayChangeByTicker.get(co.ticker);
          return d == null ? "N/D" : String(d);
        },
      },
      {
        key: "apercu",
        label: "Aperçu",
        sortKind: "number",
        getValue: (co) => {
          const chg = sparkByTicker.get(co.ticker)?.changePct;
          return chg == null ? "N/D" : String(chg);
        },
      },
      {
        key: "price",
        label: "Cours",
        sortKind: "number",
        getValue: (co) => {
          const p = metricsByTicker.get(co.ticker)?.currentPrice ?? 0;
          return p > 0 ? String(p) : "N/D";
        },
      },
      {
        key: "mktcap",
        label: "Cap. boursière",
        sortKind: "number",
        getValue: (co) => formatMktCap(co.mktcap),
      },
      {
        key: "yield",
        label: "Rend. div.",
        sortKind: "number",
        getValue: (co) => String(metricsByTicker.get(co.ticker)?.dividendYieldPercent ?? ""),
      },
      {
        key: "score",
        label: "Score",
        sortKind: "number",
        getValue: (co) => String(metricsByTicker.get(co.ticker)?.score ?? ""),
      },
      {
        key: "signal",
        label: "Signal",
        sortKind: "text",
        getValue: (co) => metricsByTicker.get(co.ticker)?.signal.label ?? "",
      },
      {
        key: "confidence",
        label: "Confiance",
        sortKind: "text",
        getValue: (co) => metricsByTicker.get(co.ticker)?.confidence ?? "",
      },
    ],
    [metricsByTicker, sparkByTicker, dayChangeByTicker]
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
          setLastUpdate(new Date(json.data.dataset.generatedAt).toLocaleDateString("fr-FR"));
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
  }, []);

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
          setLastUpdate(new Date(fullJson.data.generatedAt).toLocaleDateString("fr-FR"));
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
  }, []);

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
        exchangeName={exchange.name}
        region={exchange.region}
      />

      <section className={styles.board} data-align-left>
        <div className={styles.boardHead}>
          <div>
            <h2 className={styles.boardTitle}>
              Positions · {displayRows.length}
              {displayRows.length > PAGE_SIZE ? ` (affichées ${pagedRows.length})` : ""}
            </h2>
            <p className={styles.boardSub}>
              Données clés et éléments d&apos;analyse — cliquez une ligne pour déplier les indices.
              L&apos;aperçu suit le cours sur l&apos;horizon choisi ; les horizons courts affichent N/D
              si l&apos;historique journalier est insuffisant.
            </p>
          </div>
          <div className={styles.filters}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher (ticker, nom)…"
              aria-label="Rechercher une position"
              className={styles.search}
            />
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              aria-label="Secteur"
              className={styles.select}
            >
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Tri"
              className={styles.select}
            >
              <option value="score">Trier par Score</option>
              <option value="mktcap">Trier par Capitalisation</option>
              <option value="yield">Trier par Dividende</option>
              <option value="price">Trier par Cours</option>
              <option value="perf5">Trier par Perf. 5 ans</option>
            </select>
          </div>
        </div>

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
                            <span>Aperçu</span>
                            <label className={styles.horizonInline}>
                              <span className={styles.srOnly}>Horizon historique</span>
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
                      <span className={styles.skeletonHint}>Chargement des positions…</span>
                    ) : (
                      "Aucune position ne correspond."
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
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleRow(co.ticker);
                          }
                        }}
                      >
                        <td>
                          <span className={styles.expandHint} aria-hidden="true">
                            {open ? "▾" : "▸"}
                          </span>{" "}
                          <span className={styles.ticker} style={{ color: co.color }}>
                            {co.ticker}
                          </span>{" "}
                          <span aria-hidden="true">{co.countryFlag}</span>
                        </td>
                        <td>
                          <div className={styles.name}>{co.name}</div>
                        </td>
                        <td className={styles.sectorCell} title="Domaine d'activité">
                          {co.sector?.trim() ? co.sector : "N/D"}
                        </td>
                        <td className={styles.dayChg}>
                          <ChangeValue
                            value={dayChg}
                            title="Variation journalière (vs séance précédente)"
                          />
                        </td>
                        <td>
                          <div className={styles.sparkCell}>
                            <MarketSparkline values={spark.values} width={140} height={36} />
                            <span className={styles.sparkChg} title="Variation début → fin sur l'horizon">
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
                            ? `${m.currentPrice.toLocaleString("fr-FR")} ${exchange.currency}`
                            : "N/D"}
                        </td>
                        <td className={styles.num} style={{ color: C.gold }}>
                          {formatMktCap(co.mktcap)}
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
                          <SignalBadge label={m.signal.label} title={m.signalSummary} />
                        </td>
                        <td className={styles.meta}>{m.confidence}</td>
                      </tr>
                      {open && (
                        <tr className={styles.detailRow}>
                          <td colSpan={COL_COUNT}>
                            <ExpandedPanel
                              company={co}
                              metrics={m}
                              currency={exchange.currency}
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
              Afficher la suite ({displayRows.length - visibleCount} restantes)
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
  onPrefetch,
}: {
  company: CompanyFullDataset;
  metrics: ReturnType<typeof calcMetrics>;
  currency: string;
  onPrefetch?: (href: string) => void;
}) {
  const perf10 = m.perf10Percent === "N/D" ? null : parseFloat(m.perf10Percent);
  const vol = m.volatilityPercent === "N/D" ? null : parseFloat(m.volatilityPercent);

  const cards: Array<{ label: string; value: string; color?: string }> = [
    {
      label: "Cours actuel",
      value: m.currentPrice > 0 ? `${m.currentPrice.toLocaleString("fr-FR")} ${currency}` : "N/D",
    },
    {
      label: "Cap. boursière",
      value: formatMktCap(company.mktcap),
      color: C.gold,
    },
    {
      label: "Perf. 5 ans",
      value: m.perf5Percent === "N/D" ? "N/D" : `${parseFloat(m.perf5Percent) >= 0 ? "+" : ""}${m.perf5Percent}%`,
      color: m.perf5Percent === "N/D" ? C.textDim : parseFloat(m.perf5Percent) >= 0 ? C.green : C.red,
    },
    {
      label: "Perf. 10 ans",
      value: perf10 == null ? "N/D" : `${perf10 >= 0 ? "+" : ""}${m.perf10Percent}%`,
      color: perf10 == null ? C.textDim : perf10 >= 0 ? C.green : C.red,
    },
    {
      label: "Rendement div.",
      value: `${m.dividendYieldPercent}%`,
      color: C.teal,
    },
    {
      label: "PER",
      value: company.per > 0 ? company.per.toFixed(2) : "N/D",
      color: C.blue,
    },
    {
      label: "Volatilité",
      value: vol == null ? "N/D" : `${m.volatilityPercent}%`,
    },
    {
      label: "Risque (volatilité)",
      value: m.riskLevel,
    },
    {
      label: "Gestion du risque",
      value: `${m.riskAnalysis.riskTier} · ${m.riskAnalysis.riskScore}/100`,
      color:
        m.riskAnalysis.riskScore < 40 ? C.green : m.riskAnalysis.riskScore > 65 ? C.red : C.gold,
    },
    {
      label: "Horizons C/M/L",
      value: `${m.horizonScores.court} / ${m.horizonScores.moyen} / ${m.horizonScores.long}`,
    },
    {
      label: "Confiance",
      value: m.confidence,
    },
    {
      label: "Score / Signal",
      value: `${m.score}/100 · ${m.signal.label}`,
      color: m.signal.color,
    },
  ];

  return (
    <div className={styles.detail} onClick={(e) => e.stopPropagation()}>
      <p className={styles.detailSummary}>{m.signalSummary}</p>
      <p className={styles.detailSummary} style={{ color: C.textDim, fontSize: "0.78rem" }}>
        {m.riskAnalysis.summary}
      </p>
      <div className={styles.detailGrid}>
        {cards.map((c) => {
          const slug = educationSlugForAnalysisLabel(c.label);
          return (
            <div key={c.label} className={styles.detailCard}>
              <div className={styles.detailLabel}>
                {slug ? <EducationTermLink slug={slug}>{c.label}</EducationTermLink> : c.label}
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
            return (
              <li key={p.key}>
                <span aria-hidden="true">●</span>{" "}
                {slug ? <EducationTermLink slug={slug}>{p.label}</EducationTermLink> : p.label} :{" "}
                {p.score == null ? "N/D" : `${p.score}/100`} — {p.note}
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
              {r.text}
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
          Détails société cotée
        </Link>
        <Link
          href={`/graphes?ticker=${company.ticker}`}
          className={styles.secondaryBtn}
          data-analytics-feature="graphes"
          data-analytics-action="from_marche"
          onMouseEnter={() => onPrefetch?.(`/graphes?ticker=${company.ticker}`)}
          onFocus={() => onPrefetch?.(`/graphes?ticker=${company.ticker}`)}
        >
          Analyse graphique
        </Link>
      </div>
    </div>
  );
}

function ScoreExplainer() {
  return (
    <section className={styles.scoreBox} aria-labelledby="score-how">
      <h3 id="score-how" className={styles.scoreBoxTitle}>
        Comment le score est calculé
      </h3>
      <p className={styles.scoreBoxLead}>
        Le score (0–100) combine un volet technique multi-horizons (court / moyen / long), un volet
        fondamental (dividendes, PER) et un garde-fou de risque (marché, liquidité, fondamental,
        opérationnel). Il se recalcule dès qu’un nouveau cours est en base (cron horaire, bouton
        « Actualiser », ou rechargement auto de la page). Il alimente le signal (ACHAT FORT / ACHAT /
        CONSERVER / ALLÉGER / VENDRE).
      </p>
      <ol className={styles.scoreList}>
        <li>
          <strong>
            <EducationTermLink slug="score-technique">Technique multi-horizons</EducationTermLink> (40 %)
          </strong>{" "}
          — court ~1 an, moyen ~5 ans, long ~10 ans + valorisation.
        </li>
        <li>
          <strong>
            <EducationTermLink slug="score-fondamental">Fondamental</EducationTermLink> (40 %)
          </strong>{" "}
          — rendement et régularité des dividendes, PER.
        </li>
        <li>
          <strong>
            <EducationTermLink slug="gestion-du-risque">Risque inversé</EducationTermLink> (20 %)
          </strong>{" "}
          — plus le score de risque est bas, plus la contribution est favorable (VaR / drawdown / cap. /
          secteur quand disponibles).
        </li>
        <li>
          <strong>
            <EducationTermLink slug="confiance-du-signal">Confiance</EducationTermLink>
          </strong>{" "}
          — historique court : les signaux extrêmes sont plafonnés.
        </li>
      </ol>
      <p className={styles.scoreBoxNote}>
        La <strong>confiance</strong> (Faible / Moyenne / Élevée) dépend de la profondeur d&apos;historique
        de cours. Une confiance faible peut plafonner les signaux extrêmes. Analyse informative
        uniquement — ce n&apos;est pas un conseil en investissement.
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
  exchangeName: string;
  region: string;
}) {
  return (
    <div className={marketStyles.shell}>
      <div className={marketStyles.topBar}>
        <div className={marketStyles.topRow}>
          <div>
            <div className={marketStyles.label}>Marché</div>
            <h1 className={marketStyles.pageTitle}>Vue d&apos;ensemble</h1>
            <p className={marketStyles.marketIdentity}>{props.exchangeName}</p>
            <p className={marketStyles.marketMeta}>
              {props.region} · Devise {props.currency}
            </p>
          </div>
          <div className={marketStyles.actions}>
            <div style={{ fontSize: "0.72rem", color: C.textDim }}>
              <span className="ob-live-dot ob-pulse" aria-hidden="true" />
              Dernière MAJ : <span style={{ color: C.gold }}>{props.lastUpdate}</span>
            </div>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={props.onRefresh}
              disabled={props.refreshing}
              aria-label={
                props.refreshing
                  ? "Actualisation des cours BRVM en cours"
                  : "Actualiser les cours BRVM"
              }
            >
              {props.refreshing ? "⟳ Actualisation..." : "⟳ Actualiser les cours"}
            </button>
          </div>
        </div>
      </div>

      <div className={marketStyles.kpiStrip}>
        {[
          { l: "Sociétés cotées", v: String(props.companiesCount), c: C.blue },
          {
            l: "Capitalisation totale",
            v:
              props.totalMktCap > 0
                ? `${props.totalMktCap.toLocaleString("fr-FR")} Mds ${props.currency}`
                : "N/D",
            c: C.gold,
          },
          { l: "Rend. moyen marché", v: props.avgYield, c: C.green },
          { l: "Signaux ACHAT", v: String(props.buySignals), c: C.green },
        ].map((k) => (
          <div key={k.l} className={marketStyles.kpiCard}>
            <div className={marketStyles.kpiLabel}>{k.l}</div>
            <div className={`${marketStyles.kpiValue} ob-num`} style={{ color: k.c }}>
              {k.v === "N/D" ? <span className="ob-nd">N/D</span> : k.v}
            </div>
          </div>
        ))}
      </div>
      <div className={marketStyles.indicesStrip} aria-label="Indices">
        {props.indexPills.length === 0 ? (
          <Link href="/indices" className={marketStyles.indexPill}>
            <div className={marketStyles.indexName}>Indices</div>
            <div className={marketStyles.indexValue} style={{ color: C.textDim }}>
              N/D
            </div>
          </Link>
        ) : (
          props.indexPills.map((idx) => (
            <Link key={idx.code} href={`/indices/${idx.code}`} className={marketStyles.indexPill}>
              <div className={marketStyles.indexName}>{idx.name}</div>
              <div className={`${marketStyles.indexValue} ob-num`}>
                {idx.value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
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
