"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/components/i18n/I18nProvider";
import ChangeValue from "@/components/ui/ChangeValue";
import KpiStat from "@/components/ui/KpiStat";
import { translateCompositionNote, translateIndexDescription, translateIndexFamily } from "@/components/indices/index-copy";
import { translateDataSourceLabel } from "@/components/marche/market-copy";
import type { MarketIndexDetail } from "@/lib/api/market-indices";
import { applyChartSeriesWindow } from "@/lib/charts/chart-window";
import type { ChartRange } from "@/lib/charts/indicators";
import type { FormatApi } from "@/lib/i18n/format";
import { C } from "@/lib/theme/colors";
import styles from "./Indices.module.css";

const NUMERIC_DATE: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
};

function formatLevel(value: number | null | undefined, format: FormatApi): string {
  if (value == null || Number.isNaN(value)) return "N/D";
  return format.decimal(value, 2);
}

function formatSessionDate(iso: string | null | undefined, format: FormatApi): string {
  if (!iso) return "N/D";
  return format.date(`${iso}T00:00:00.000Z`, NUMERIC_DATE);
}

export default function IndexDetailClient({ detail }: { detail: MarketIndexDetail }) {
  const { t, format, labels } = useI18n();
  const [range, setRange] = useState<ChartRange>("1A");
  const ranges: Array<{ key: ChartRange; label: string }> = [
    { key: "1M", label: "1M" },
    { key: "3M", label: "3M" },
    { key: "6M", label: "6M" },
    { key: "YTD", label: t("market.indices.kpi.ytd") },
    { key: "1A", label: t("market.indices.range1A") },
    { key: "5A", label: t("market.indices.range5A") },
    { key: "MAX", label: t("market.indices.rangeAll") },
  ];
  const windowed = useMemo(
    () => applyChartSeriesWindow(detail.series, { range, defaultTo1A: false }),
    [detail.series, range]
  );
  const chartData = useMemo(
    () => windowed.series.map((point) => ({ ...point, label: point.time.slice(0, 7) })),
    [windowed.series]
  );
  const chartIndexByTime = useMemo(() => {
    const m = new Map<string, number>();
    chartData.forEach((p, i) => m.set(p.time, i));
    return m;
  }, [chartData]);
  const { stats, composition } = detail;
  const history =
    stats.historyPoints > 0
      ? t(stats.historyPoints > 1 ? "market.indices.pointsMany" : "market.indices.pointsOne", {
          count: stats.historyPoints,
        })
      : t("market.indices.historyNd");
  const sectorName = (name: string) => labels.sector(name);

  return (
    <>
      <header className={styles.detailHead}>
        <Link href="/indices" className={styles.back}>
          {t("market.indices.back")}
        </Link>
        <p className="ob-kicker">
          {translateIndexFamily(detail.family, t)} · {detail.code.replace(/_/g, " ")}
        </p>
        <h1 className="ob-page-title">{detail.name}</h1>
        <div className={styles.levelRow}>
          <span className={styles.level}>{formatLevel(stats.lastValue, format)}</span>
          <ChangeValue value={stats.sessionChangePercent} pill />
        </div>
        <p className={styles.meta}>
          {t("market.indices.sessionMeta", {
            date: formatSessionDate(stats.lastDate, format),
            source: translateDataSourceLabel(detail.sourceLabel, t),
            history,
          })}
        </p>
        <p className={styles.note}>
          {translateIndexDescription(detail.code, detail.description, t, sectorName)}
        </p>
      </header>

      <div className={styles.kpiGrid}>
        <KpiStat label={t("market.indices.kpi.session")} value={<ChangeValue value={stats.sessionChangePercent} />} />
        <KpiStat label={t("market.indices.kpi.month")} value={<ChangeValue value={stats.change1MPercent} />} />
        <KpiStat label={t("market.indices.kpi.threeMonths")} value={<ChangeValue value={stats.change3MPercent} />} />
        <KpiStat label={t("market.indices.kpi.ytd")} value={<ChangeValue value={stats.changeYtdPercent} />} />
        <KpiStat label={t("market.indices.kpi.year")} value={<ChangeValue value={stats.change1YPercent} />} />
        <KpiStat
          label={t("market.indices.kpi.high52")}
          value={formatLevel(stats.high52w, format)}
          hint={stats.high52w == null ? t("market.indices.historyShort") : undefined}
        />
        <KpiStat
          label={t("market.indices.kpi.low52")}
          value={formatLevel(stats.low52w, format)}
          hint={stats.low52w == null ? t("market.indices.historyShort") : undefined}
        />
        <KpiStat label={t("market.indices.kpi.first")} value={formatSessionDate(stats.firstDate, format)} />
      </div>

      <section className={styles.card} aria-labelledby="index-chart-title">
        <div className={styles.cardHead}>
          <h2 id="index-chart-title" className={styles.cardTitle}>
            {t("market.indices.historyTitle")}
          </h2>
          <div className={styles.rangeRow} role="group" aria-label={t("market.indices.period")}>
            {ranges.map((item) => (
              <button
                key={item.key}
                type="button"
                className={range === item.key ? styles.rangeActive : styles.rangeBtn}
                onClick={() => setRange(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {chartData.length > 1 ? (
          <div className={styles.chartBox}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="indexGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.gold} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={C.gold} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.borderThin} strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke={C.textDim} fontSize={11} minTickGap={40} />
                <YAxis stroke={C.textDim} fontSize={11} domain={["auto", "auto"]} width={64} />
                <Tooltip
                  contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8 }}
                  labelStyle={{ color: C.text }}
                  labelFormatter={(_label, items) => {
                    const time = (items?.[0]?.payload as { time?: string } | undefined)?.time;
                    return time ? formatSessionDate(time.slice(0, 10), format) : String(_label);
                  }}
                  formatter={(value, _name, item) => {
                    const level = formatLevel(typeof value === "number" ? value : null, format);
                    const time = (item?.payload as { time?: string } | undefined)?.time;
                    const i = time ? (chartIndexByTime.get(time) ?? -1) : -1;
                    const prev = i > 0 ? chartData[i - 1]!.value : null;
                    const cur = typeof value === "number" ? value : null;
                    const day =
                      prev != null && prev > 0 && cur != null
                        ? ` (${format.percent(((cur - prev) / prev) * 100, 2, true)})`
                        : "";
                    return [`${level}${day}`, t("market.indices.level")];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={t("market.indices.level")}
                  isAnimationActive={false}
                  stroke={C.gold}
                  fill="url(#indexGold)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className={styles.empty}>{t("market.indices.historyEmpty")}</p>
        )}
      </section>

      <section className={styles.card} aria-labelledby="index-compo-title">
        <div className={styles.cardHead}>
          <h2 id="index-compo-title" className={styles.cardTitle}>
            {t("market.indices.composition")}
          </h2>
        </div>
        <p className={styles.note}>{translateCompositionNote(composition.note, t, sectorName)}</p>
        {composition.constituents.length === 0 ? (
          <p className={styles.empty}>{t("market.indices.constituentsNd")}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className="ob-table">
              <thead>
                <tr>
                  <th scope="col">{t("market.indices.col.ticker")}</th>
                  <th scope="col">{t("market.indices.col.company")}</th>
                  <th scope="col">{t("market.indices.col.sector")}</th>
                  <th scope="col">{t("market.indices.col.weight")}</th>
                  <th scope="col">{t("market.indices.col.price")}</th>
                </tr>
              </thead>
              <tbody>
                {composition.constituents.map((row) => (
                  <tr key={row.ticker}>
                    <td>
                      <Link href={`/actions/${row.ticker}`} className={styles.constLink}>
                        {row.ticker}
                      </Link>
                    </td>
                    <td>{row.name}</td>
                    <td>{row.sector ? labels.sector(row.sector) : "N/D"}</td>
                    <td className="ob-num">
                      {row.weight == null || Number.isNaN(row.weight) ? "N/D" : format.percent(row.weight, 2)}
                    </td>
                    <td className="ob-num">
                      {row.lastPrice == null || !(row.lastPrice > 0) ? "N/D" : format.integer(row.lastPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
