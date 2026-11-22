"use client";

// Carte « Cours » de l'onglet Vue d'ensemble de la fiche NGX : exactement le graphe de la fiche
// BRVM (components/actions/CompanySheetClient.tsx → OverviewPriceChart) — courbe verte avec
// dégradé, bandeau O/H/B/C, variation de la fenêtre, boutons 1M · 1A · 5A · Max, lien vers les
// graphes détaillés (onglet Analyse Graphique). Prix en naira (₦).
// La série est celle déjà chargée pour la fiche (aucune lecture supplémentaire en base).

import { useMemo } from "react";
import OverviewPriceChart from "@/components/actions/OverviewPriceChart";
import styles from "@/components/actions/CompanySheet.module.css";
import { trackFeature } from "@/components/analytics/track-client";
import { useI18n } from "@/components/i18n/I18nProvider";
import LockedTeaser from "@/components/entitlements/LockedTeaser";
import { lastPointAsOf } from "@/lib/charts/chart-window";
import { downsampleLttb } from "@/lib/charts/downsample";
import { rangeFilter, type ChartClosePoint, type ChartRange } from "@/lib/charts/indicators";
import { flatPriceBounds } from "@/lib/charts/sparse-series";
import { computeWindowChange, formatWindowChangePercent } from "@/lib/charts/window-change";
import { usePersistedState } from "@/lib/ui/use-persisted-state";

export const NGX_SHEET_TAB_EVENT = "ouestbourse:ngx-sheet-tab";

const RANGES: Array<{ key: ChartRange; labelKey: "company.ranges.1M" | "company.ranges.1A" | "company.ranges.5A" | "company.ranges.MAX" }> = [
  { key: "1M", labelKey: "company.ranges.1M" },
  { key: "1A", labelKey: "company.ranges.1A" },
  { key: "5A", labelKey: "company.ranges.5A" },
  { key: "MAX", labelKey: "company.ranges.MAX" },
];

export default function NgxOverviewPriceCard({
  ticker,
  series,
  sessionDate,
  gatedVisitor = false,
}: {
  ticker: string;
  series: ChartClosePoint[];
  sessionDate: string | null;
  gatedVisitor?: boolean;
}) {
  const { t, format, locale } = useI18n();
  const nd = "N/D";
  const [range, setRange] = usePersistedState<ChartRange>(`ouestbourse:ngx-sheet:${ticker}:range`, "1A");

  const rangedSeries = useMemo(() => rangeFilter(series, range, lastPointAsOf(series)), [series, range]);
  const rangeChange = useMemo(() => computeWindowChange(rangedSeries), [rangedSeries]);
  const chartSeries = useMemo(() => downsampleLttb(rangedSeries, 360), [rangedSeries]);
  const chartYDomain = useMemo(() => {
    const bounds = flatPriceBounds(chartSeries.map((p) => p.value));
    return bounds ? ([bounds.min, bounds.max] as [number, number]) : (["auto", "auto"] as ["auto", "auto"]);
  }, [chartSeries]);
  const shortChart = chartSeries.length > 0 && chartSeries.length <= 12;

  const last = rangedSeries[rangedSeries.length - 1] ?? series[series.length - 1];
  const prev = rangedSeries.length >= 2 ? rangedSeries[rangedSeries.length - 2] : null;
  const fmtNum = (v: number) => format.number(v);
  const ohlc = useMemo(() => {
    if (!last || !prev) {
      return { o: nd, h: nd, l: nd, c: last && last.value > 0 ? format.number(last.value) : nd, vol: nd, var: nd };
    }
    const open = prev.value;
    const close = last.value;
    const v = open > 0 ? ((close - open) / open) * 100 : 0;
    return {
      o: format.number(open),
      h: format.number(Math.max(open, close)),
      l: format.number(Math.min(open, close)),
      c: format.number(close),
      vol: last.volume && last.volume > 0 ? format.number(last.volume) : nd,
      var: `${v >= 0 ? "+" : "-"}${format.decimal(Math.abs(v), 2)}%`,
    };
  }, [last, prev, format]);
  const up = !last || !prev ? true : last.value >= prev.value;

  const rangeWord = t(RANGES.find((r) => r.key === range)?.labelKey ?? "company.ranges.1A");
  const rangeChangeLabel = t("company.chart.rangeChange", { range: rangeWord });
  const sessionLabel = sessionDate
    ? format.date(new Date(`${sessionDate}T12:00:00Z`), { day: "numeric", month: "long", year: "numeric" })
    : nd;

  return (
    <section className={styles.card} data-testid="ngx-overview-price-card">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="ngx-overview-chart">
          {t("company.chart.price")}
        </h2>
        <div className={styles.rangeTools}>
          <div
            className={styles.rangeChgBlock}
            aria-live="polite"
            title={
              rangeChange
                ? `${rangeChangeLabel} · ${rangeChange.abs > 0 ? "+" : ""}${fmtNum(rangeChange.abs)} ₦`
                : t("company.chart.rangeChangeNd")
            }
          >
            <span className={styles.rangeChgLabel}>{rangeChangeLabel}</span>
            <span
              className={
                rangeChange == null ? styles.rangeChgNd : rangeChange.percent >= 0 ? styles.rangeChgUp : styles.rangeChgDown
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
              gatedVisitor && (r.key === "5A" || r.key === "MAX") ? (
                <LockedTeaser key={r.key} compact label={t(r.labelKey)} />
              ) : (
              <button
                key={r.key}
                type="button"
                className={range === r.key ? styles.rangeActive : styles.rangeBtn}
                onClick={() => {
                  setRange(r.key);
                  trackFeature("company_sheet", `ngx-range:${r.key}`);
                }}
              >
                {t(r.labelKey)}
              </button>
              )
            ))}
          </div>
        </div>
      </div>
      <p className={styles.sessionNote}>
        {t("company.chart.session", { date: sessionLabel })}
        {" · "}
        <button
          type="button"
          className={styles.textLink}
          onClick={() => window.dispatchEvent(new CustomEvent(NGX_SHEET_TAB_EVENT, { detail: "charts" }))}
        >
          {t("company.chart.openCharts")}
        </button>
      </p>
      <OverviewPriceChart
        chartSeries={chartSeries}
        rangedSeries={rangedSeries}
        shortChart={shortChart}
        yDomain={chartYDomain}
        splitGuides={[]}
        defaultOhlc={ohlc}
        defaultUp={up}
        nd={nd}
        emptyLabel={t("company.chart.insufficient")}
        currency="₦"
      />
    </section>
  );
}
