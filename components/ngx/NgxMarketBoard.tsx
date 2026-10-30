"use client";

// Tableau « vue d'ensemble » NGX : même présentation et mêmes comportements que le tableau BRVM
// (components/marche/MarketBoardClient.tsx) — mêmes styles, même en-tête à menus de tri (ColumnFilterRow),
// même sélecteur de période sur l'Aperçu (HorizonSelect + filterSeriesByHorizon), même pagination.
// Seules différences : « Cours FCFA » à la place de « Rend. div. », cours et capitalisation en naira,
// secteur NGX, et note / signal / confiance issus de la note NGX (lib/ngx/signal.ts).

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ChangeValue from "@/components/ui/ChangeValue";
import ColumnFilterRow from "@/components/ui/ColumnFilterRow";
import ExpandChevron from "@/components/ui/ExpandChevron";
import SignalBadge from "@/components/ui/SignalBadge";
import HorizonSelect from "@/components/marche/HorizonSelect";
import MarketSparkline from "@/components/marche/MarketSparkline";
import { useI18n } from "@/components/i18n/I18nProvider";
import { trackFeature } from "@/components/analytics/track-client";
import styles from "@/components/marche/MarketBoard.module.css";
import { applyColumnSort, type ColumnFilterDef, type ColumnSortState } from "@/lib/ui/column-filters";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import { filterSeriesByHorizon, horizonChangePercent, type MarketHorizon } from "@/lib/markets/market-horizon";
import { unpackNgxSpark, type NgxSparkPacked } from "@/lib/markets/ngx-spark";
import type { NgxScoreMode } from "@/lib/ngx/score";
import type { NgxOverviewConfidence, NgxSignal } from "@/lib/ngx/signal";
import { C } from "@/lib/theme/colors";

const COL_COUNT = 11;
const PAGE_SIZE = 20;

export interface NgxBoardRow {
  ticker: string;
  name: string;
  sectorSlug: string;
  sectorLabel: string;
  /** Dernier cours en naira, null = N/D. */
  close: number | null;
  /** Variation du jour (%), null = N/D. */
  changePercent: number | null;
  /** Capitalisation en milliards de naira, null = N/D. */
  marketCapBn: number | null;
  /** Cours FCFA indicatif, null = N/D. */
  fcfa: number | null;
  /** Variation sur 1 an (%), null = N/D. */
  return1yPercent: number | null;
  /** Série d'aperçu compactée, null = N/D. */
  spark: NgxSparkPacked | null;
  /** Note globale /100, null = N/D. */
  score: number | null;
  scoreMode: NgxScoreMode | null;
  signal: NgxSignal | null;
  confidence: NgxOverviewConfidence | null;
}

type SortBy = "score" | "mktcap" | "price" | "perf";

export default function NgxMarketBoard({ rows }: { rows: NgxBoardRow[] }) {
  const { t, format, labels } = useI18n();
  const pageKey = "ouestbourse:marche:ngx";
  const [query, setQuery] = usePersistedState(`${pageKey}:query`, "");
  const [sectorFilter, setSectorFilter] = usePersistedState(`${pageKey}:sector`, "");
  const [sortBy, setSortBy] = usePersistedState<SortBy>(`${pageKey}:sort`, "score");
  const [horizon, setHorizon] = usePersistedState<MarketHorizon>(`${pageKey}:horizon`, "1A");
  const [expanded, setExpanded] = usePersistedState<string | null>(`${pageKey}:expanded`, null);
  const [colSort, setColSort] = useState<ColumnSortState | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Séries décompactées une seule fois ; le filtre de période est celui de la BRVM.
  const fullSeries = useMemo(() => new Map(rows.map((r) => [r.ticker, unpackNgxSpark(r.spark)] as const)), [rows]);
  const sparkByTicker = useMemo(() => {
    const map = new Map<string, { values: number[]; changePct: number | null }>();
    for (const row of rows) {
      const series = filterSeriesByHorizon(fullSeries.get(row.ticker) ?? [], horizon);
      map.set(row.ticker, { values: series.map((p) => p.value), changePct: horizonChangePercent(series) });
    }
    return map;
  }, [rows, fullSeries, horizon]);

  const sectors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (!seen.has(r.sectorSlug)) seen.set(r.sectorSlug, r.sectorLabel);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], "fr"));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (sectorFilter && r.sectorSlug !== sectorFilter) return false;
      if (!q) return true;
      return r.ticker.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
    });
    const num = (v: number | null) => (v == null ? -Infinity : v);
    return [...list].sort((a, b) => {
      if (sortBy === "score") return num(b.score) - num(a.score);
      if (sortBy === "mktcap") return num(b.marketCapBn) - num(a.marketCapBn);
      if (sortBy === "perf") return num(sparkByTicker.get(b.ticker)?.changePct ?? null) - num(sparkByTicker.get(a.ticker)?.changePct ?? null);
      return num(b.close) - num(a.close);
    });
  }, [rows, query, sectorFilter, sortBy, sparkByTicker]);

  const colDefs = useMemo<ColumnFilterDef<NgxBoardRow>[]>(() => {
    const numOrND = (v: number | null) => (v == null || !Number.isFinite(v) ? "N/D" : String(v));
    return [
      { key: "ticker", label: t("market.columns.ticker"), getValue: (r) => r.ticker, sortKind: "text" },
      { key: "name", label: t("market.columns.company"), getValue: (r) => r.name, sortKind: "text" },
      { key: "sector", label: t("market.columns.activity"), getValue: (r) => r.sectorLabel || "N/D", sortKind: "text" },
      { key: "dayChg", label: t("market.columns.dayChange"), sortKind: "number", getValue: (r) => numOrND(r.changePercent) },
      {
        key: "apercu",
        label: t("market.columns.preview"),
        sortKind: "number",
        getValue: (r) => numOrND(sparkByTicker.get(r.ticker)?.changePct ?? null),
      },
      { key: "price", label: t("market.columns.price"), sortKind: "number", getValue: (r) => (r.close != null && r.close > 0 ? String(r.close) : "N/D") },
      { key: "mktcap", label: t("market.columns.mktCap"), sortKind: "number", getValue: (r) => (r.marketCapBn != null && r.marketCapBn > 0 ? String(r.marketCapBn) : "N/D") },
      { key: "fcfa", label: t("ngx.market.colFcfa"), sortKind: "number", getValue: (r) => (r.fcfa != null && r.fcfa > 0 ? String(r.fcfa) : "N/D") },
      { key: "score", label: t("market.columns.score"), sortKind: "number", getValue: (r) => numOrND(r.score) },
      { key: "signal", label: t("market.columns.signal"), sortKind: "text", getValue: (r) => r.signal?.label ?? "" },
      { key: "confidence", label: t("market.columns.confidence"), sortKind: "text", getValue: (r) => r.confidence ?? "" },
    ];
  }, [t, sparkByTicker]);

  const displayRows = useMemo(() => applyColumnSort(filtered, colDefs, colSort), [filtered, colDefs, colSort]);
  useEffect(() => setVisibleCount(PAGE_SIZE), [query, sectorFilter, sortBy, colSort]);
  const pagedRows = useMemo(() => displayRows.slice(0, visibleCount), [displayRows, visibleCount]);

  const toggleRow = (ticker: string) => {
    setExpanded((cur) => (cur === ticker ? null : ticker));
    trackFeature("marche", "ngx_expand_row");
  };
  const handleHorizon = (next: MarketHorizon) => {
    setHorizon(next);
    trackFeature("marche", `ngx_horizon:${next}`);
  };

  const naira = (v: number | null) => (v == null ? "N/D" : format.money(v, "NGN"));
  const cap = (v: number | null) => (v == null || !(v > 0) ? "N/D" : t("market.capCurrency", { amount: format.number(v), currency: "₦" }));
  const fcfa = (v: number | null) => (v == null || !(v > 0) ? "N/D" : format.money(v, "XOF"));
  const signalTitle = (r: NgxBoardRow) =>
    r.signal && r.score != null && r.confidence
      ? t("ngx.market.signalTitle", { signal: labels.signal(r.signal.label), score: r.score, confidence: labels.confidence(r.confidence) })
      : undefined;
  const modeText = (mode: NgxScoreMode | null) =>
    mode === "FULL" ? t("ngx.market.modeFull") : mode === "PARTIAL" ? t("ngx.screener.tags.partial") : mode === "CHART_ONLY" ? t("ngx.screener.tags.chartOnly") : "N/D";
  const modeTitle = (mode: NgxScoreMode | null) =>
    mode === "CHART_ONLY" ? t("ngx.screener.tags.chartOnlyTitle") : mode === "PARTIAL" ? t("ngx.screener.tags.partialTitle") : undefined;

  return (
    <section className={styles.board} data-align-left data-testid="ngx-board">
      <div className={styles.boardHead}>
        <div>
          <h2 className={styles.boardTitle}>
            {t("market.board.positions", { count: displayRows.length })}
            {displayRows.length > PAGE_SIZE ? ` ${t("market.board.shown", { count: pagedRows.length })}` : ""}
          </h2>
          <p className={styles.boardSub}>{t("ngx.market.boardSubtitle")}</p>
        </div>
        <div className={styles.filters}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("market.board.searchPlaceholder")}
            aria-label={t("ngx.market.searchAria")}
            className={styles.search}
          />
          <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)} aria-label={t("market.board.sectorAria")} className={styles.select}>
            <option value="">{t("market.all")}</option>
            {sectors.map(([slug, label]) => (
              <option key={slug} value={slug}>
                {label}
              </option>
            ))}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} aria-label={t("market.board.sortAria")} className={styles.select}>
            <option value="score">{t("market.board.sortScore")}</option>
            <option value="mktcap">{t("market.board.sortCap")}</option>
            <option value="price">{t("market.board.sortPrice")}</option>
            <option value="perf">{t("ngx.market.sortPerf")}</option>
          </select>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <ColumnFilterRow
              columns={colDefs.map((d) =>
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
                  : d,
              )}
              sort={colSort}
              onSortChange={setColSort}
            />
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={COL_COUNT} className={styles.empty}>
                  {t("market.board.empty")}
                </td>
              </tr>
            ) : (
              pagedRows.map((r) => {
                const open = expanded === r.ticker;
                const spark = sparkByTicker.get(r.ticker)!;
                return (
                  <Fragment key={r.ticker}>
                    <tr
                      className={open ? styles.rowOpen : undefined}
                      onClick={() => toggleRow(r.ticker)}
                      tabIndex={0}
                      aria-expanded={open}
                      data-testid={`ngx-row-${r.ticker}`}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleRow(r.ticker);
                        }
                      }}
                    >
                      <td className={styles.tickerCell}>
                        <ExpandChevron
                          expanded={open}
                          label={open ? t("market.board.hideDetail", { ticker: r.ticker }) : t("market.board.showDetail", { ticker: r.ticker })}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleRow(r.ticker);
                          }}
                        />
                        <span className={styles.ticker}>{r.ticker}</span> <span aria-hidden="true">🇳🇬</span>
                      </td>
                      <td>
                        <div className={styles.name}>{r.name}</div>
                      </td>
                      <td className={styles.sectorCell} title={t("market.board.activityTitle")}>
                        {r.sectorLabel?.trim() ? r.sectorLabel : "N/D"}
                      </td>
                      <td className={styles.dayChg}>
                        <ChangeValue value={r.changePercent} title={t("market.board.dayChangeTitle")} />
                      </td>
                      <td data-testid={`ngx-spark-${r.ticker}`}>
                        <div className={styles.sparkCell}>
                          <MarketSparkline values={spark.values} width={140} height={36} />
                          <span className={styles.sparkChg} title={t("market.board.horizonChangeTitle")}>
                            {spark.changePct == null ? <span className="ob-nd">N/D</span> : <ChangeValue value={spark.changePct} />}
                          </span>
                        </div>
                      </td>
                      <td className={styles.num}>{naira(r.close)}</td>
                      <td className={styles.num} style={{ color: C.gold }}>
                        {cap(r.marketCapBn)}
                      </td>
                      <td className={styles.num} style={{ color: C.teal }}>
                        {fcfa(r.fcfa)}
                      </td>
                      <td data-testid={`ngx-score-${r.ticker}`}>
                        {r.score == null || !r.signal ? (
                          <span className="ob-nd">N/D</span>
                        ) : (
                          <span
                            className={styles.score}
                            style={{ color: r.signal.color, background: `${r.signal.color}22` }}
                            title={modeTitle(r.scoreMode)}
                          >
                            {Math.round(r.score)}
                          </span>
                        )}
                      </td>
                      <td data-testid={`ngx-signal-${r.ticker}`}>
                        {r.signal ? <SignalBadge label={r.signal.label} title={signalTitle(r)} /> : <span className="ob-nd">N/D</span>}
                      </td>
                      <td className={styles.meta}>{r.confidence ? labels.confidence(r.confidence) : <span className="ob-nd">N/D</span>}</td>
                    </tr>
                    {open && (
                      <tr className={styles.detailRow}>
                        <td colSpan={COL_COUNT}>
                          <div className={styles.detail} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.detailGrid}>
                              {[
                                { key: "price", label: t("market.cards.price"), value: naira(r.close) },
                                { key: "fcfa", label: t("ngx.market.colFcfa"), value: fcfa(r.fcfa) },
                                { key: "cap", label: t("market.cards.mktCap"), value: cap(r.marketCapBn) },
                                {
                                  key: "y1",
                                  label: t("ngx.market.colChange1y"),
                                  value: r.return1yPercent == null ? "N/D" : `${r.return1yPercent >= 0 ? "+" : ""}${format.decimal(r.return1yPercent, 1)} %`,
                                  color: r.return1yPercent == null ? C.textDim : r.return1yPercent >= 0 ? C.green : C.red,
                                },
                                {
                                  key: "score",
                                  label: t("market.cards.scoreSignal"),
                                  value: r.score == null || !r.signal ? "N/D" : `${Math.round(r.score)}/100 · ${labels.signal(r.signal.label)}`,
                                  color: r.signal?.color,
                                },
                                { key: "conf", label: t("market.cards.confidence"), value: r.confidence ? labels.confidence(r.confidence) : "N/D" },
                                { key: "mode", label: t("ngx.market.scoreBasis"), value: modeText(r.scoreMode) },
                              ].map((c) => (
                                <div key={c.key} className={styles.detailCard}>
                                  <div className={styles.detailLabel}>{c.label}</div>
                                  <div className={styles.detailValue} style={"color" in c && c.color ? { color: c.color } : undefined} title={c.value}>
                                    {c.value}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className={styles.detailLinks}>
                              <Link href={`/marches/ngx/actions/${r.ticker}`} className={styles.primaryBtn}>
                                {t("market.board.companyDetails")}
                              </Link>
                              <Link href="/marches/ngx/screener" className={styles.secondaryBtn}>
                                {t("ngx.screener.link")}
                              </Link>
                            </div>
                          </div>
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
          <button type="button" className={styles.moreBtn} onClick={() => setVisibleCount((n) => Math.min(n + PAGE_SIZE, displayRows.length))}>
            {t("market.board.showMore", { count: displayRows.length - visibleCount })}
          </button>
        </div>
      ) : null}
    </section>
  );
}
