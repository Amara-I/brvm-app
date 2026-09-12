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
import ChangeValue from "@/components/ui/ChangeValue";
import KpiStat from "@/components/ui/KpiStat";
import type { MarketIndexDetail } from "@/lib/api/market-indices";
import { applyChartSeriesWindow } from "@/lib/charts/chart-window";
import type { ChartRange } from "@/lib/charts/indicators";
import { C } from "@/lib/theme/colors";
import styles from "./Indices.module.css";

const RANGES: Array<{ key: ChartRange; label: string }> = [
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "6M", label: "6M" },
  { key: "YTD", label: "YTD" },
  { key: "1A", label: "1A" },
  { key: "5A", label: "5A" },
  { key: "MAX", label: "Tout" },
];

function formatLevel(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "N/D";
  return value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "N/D";
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "N/D";
  return parsed.toLocaleDateString("fr-FR");
}

function formatPrice(value: number | null): string {
  if (value == null || !(value > 0)) return "N/D";
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

function formatWeight(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "N/D";
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

export default function IndexDetailClient({ detail }: { detail: MarketIndexDetail }) {
  const [range, setRange] = useState<ChartRange>("1A");
  const windowed = useMemo(
    () => applyChartSeriesWindow(detail.series, { range, defaultTo1A: false }),
    [detail.series, range]
  );
  const chartData = windowed.series.map((point) => ({
    ...point,
    label: point.time.slice(0, 7),
  }));
  const { stats, composition } = detail;

  return (
    <>
      <header className={styles.detailHead}>
        <Link href="/indices" className={styles.back}>
          ← Tous les indices BRVM
        </Link>
        <p className="ob-kicker">
          {detail.familyLabel} · {detail.code.replace(/_/g, " ")}
        </p>
        <h1 className="ob-page-title">{detail.name}</h1>
        <div className={styles.levelRow}>
          <span className={styles.level}>{formatLevel(stats.lastValue)}</span>
          <ChangeValue value={stats.sessionChangePercent} pill />
        </div>
        <p className={styles.meta}>
          Séance du {formatDate(stats.lastDate)} · Source : {detail.sourceLabel} ·{" "}
          {stats.historyPoints > 0 ? `${stats.historyPoints} points` : "Historique N/D"}
        </p>
        <p className={styles.note}>{detail.description}</p>
      </header>

      <div className={styles.kpiGrid}>
        <KpiStat label="Variation séance" value={<ChangeValue value={stats.sessionChangePercent} />} />
        <KpiStat label="1 mois" value={<ChangeValue value={stats.change1MPercent} />} />
        <KpiStat label="3 mois" value={<ChangeValue value={stats.change3MPercent} />} />
        <KpiStat label="YTD" value={<ChangeValue value={stats.changeYtdPercent} />} />
        <KpiStat label="1 an" value={<ChangeValue value={stats.change1YPercent} />} />
        <KpiStat
          label="Plus haut 52 sem."
          value={formatLevel(stats.high52w)}
          hint={stats.high52w == null ? "N/D — historique insuffisant" : undefined}
        />
        <KpiStat
          label="Plus bas 52 sem."
          value={formatLevel(stats.low52w)}
          hint={stats.low52w == null ? "N/D — historique insuffisant" : undefined}
        />
        <KpiStat label="Premier point" value={formatDate(stats.firstDate)} />
      </div>

      <section className={styles.card} aria-labelledby="index-chart-title">
        <div className={styles.cardHead}>
          <h2 id="index-chart-title" className={styles.cardTitle}>
            Historique
          </h2>
          <div className={styles.rangeRow} role="group" aria-label="Période">
            {RANGES.map((item) => (
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
                  formatter={(value) => [formatLevel(typeof value === "number" ? value : null), "Niveau"]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Niveau"
                  stroke={C.gold}
                  fill="url(#indexGold)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className={styles.empty}>Historique insuffisant (N/D). Les points s’afficheront après ingestion.</p>
        )}
      </section>

      <section className={styles.card} aria-labelledby="index-compo-title">
        <div className={styles.cardHead}>
          <h2 id="index-compo-title" className={styles.cardTitle}>
            Composition
          </h2>
        </div>
        <p className={styles.note}>{composition.note}</p>
        {composition.constituents.length === 0 ? (
          <p className={styles.empty}>Composantes N/D.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className="ob-table">
              <thead>
                <tr>
                  <th scope="col">Ticker</th>
                  <th scope="col">Société</th>
                  <th scope="col">Secteur</th>
                  <th scope="col">Poids</th>
                  <th scope="col">Cours</th>
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
                    <td>{row.sector || "N/D"}</td>
                    <td className="ob-num">{formatWeight(row.weight)}</td>
                    <td className="ob-num">{formatPrice(row.lastPrice)}</td>
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
