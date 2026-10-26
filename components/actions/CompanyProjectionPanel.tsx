"use client";

// Projection future — porté depuis le dashboard marché vers la fiche société.

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { useI18n } from "@/components/i18n/I18nProvider";
import { C } from "@/lib/theme/colors";
import { projectPrices } from "@/lib/calc/project-prices";
import type { CalcMetricsResult } from "@/lib/calc/calc-metrics";
import type { CompanyFullDataset } from "@/lib/api/companies-full-dataset";
import ColumnFilterRow from "@/components/ui/ColumnFilterRow";
import {
  applyColumnSort,
  type ColumnFilterDef,
  type ColumnSortState,
} from "@/lib/ui/column-filters";
import styles from "./CompanySheet.module.css";

type ProjRow = {
  year: number;
  projected: number;
  optimistic: number;
  pessimistic: number;
  pot: string;
  estDiv: string | number;
};

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ name: string; value: number | string; color?: string }>;
}) {
  const { format } = useI18n();
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: "10px 14px",
        fontSize: 12,
        boxShadow: "0 6px 20px rgba(20,30,25,0.12)",
      }}
    >
      <div style={{ color: C.text, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color || C.text, marginBottom: 2 }}>
          {p.name}: {typeof p.value === "number" ? format.number(p.value) : p.value}
        </div>
      ))}
    </div>
  );
}

export default function CompanyProjectionPanel({
  company,
  years,
  metrics,
}: {
  company: CompanyFullDataset;
  years: number[];
  metrics: CalcMetricsResult;
}) {
  const { t, format, locale } = useI18n();
  const [projYears, setProjYears] = useState(5);
  const [colSort, setColSort] = useState<ColumnSortState | null>(null);
  const baseYear = years[years.length - 1] ?? new Date().getUTCFullYear();
  const nd = t("common.nd");

  const projections = useMemo(() => {
    const historicalPrices = years.map((y) => ({ year: y, price: company.prices[y] ?? 0 }));
    return projectPrices(historicalPrices, { futureYears: projYears, baseYear });
  }, [company, years, projYears, baseYear]);

  const projRows = useMemo<ProjRow[]>(() => {
    return projections.map((p) => {
      const pot =
        metrics.currentPrice > 0
          ? (((p.projected - metrics.currentPrice) / metrics.currentPrice) * 100).toFixed(1)
          : "N/D";
      const estDiv =
        metrics.currentDividend > 0
          ? Math.round(metrics.currentDividend * (1 + 0.05 * (p.year - baseYear)))
          : "N/D";
      return {
        year: p.year,
        projected: p.projected,
        optimistic: p.optimistic,
        pessimistic: p.pessimistic,
        pot,
        estDiv,
      };
    });
  }, [projections, metrics, baseYear]);

  const colDefs = useMemo<ColumnFilterDef<ProjRow>[]>(
    () => [
      { key: "year", label: t("company.projection.year"), sortKind: "number", getValue: (r) => String(r.year) },
      {
        key: "central",
        label: t("company.projection.central"),
        sortKind: "number",
        getValue: (r) => format.number(r.projected),
      },
      {
        key: "opt",
        label: t("company.projection.optCol"),
        sortKind: "number",
        getValue: (r) => format.number(r.optimistic),
      },
      {
        key: "pess",
        label: t("company.projection.pessCol"),
        sortKind: "number",
        getValue: (r) => format.number(r.pessimistic),
      },
      { key: "pot", label: t("company.projection.potential"), sortKind: "number", getValue: (r) => r.pot },
      {
        key: "div",
        label: t("company.projection.estDiv"),
        sortKind: "number",
        getValue: (r) => (typeof r.estDiv === "number" ? format.number(r.estDiv) : String(r.estDiv)),
      },
    ],
    [t, format]
  );

  const filteredRows = useMemo(
    () => applyColumnSort(projRows, colDefs, colSort),
    [projRows, colDefs, colSort]
  );

  const chartData = useMemo(
    () =>
      years
        .filter((y) => (company.prices[y] ?? 0) > 0)
        .map((y) => ({
          year: y,
          cours: company.prices[y],
          type: "historique",
        })),
    [company, years]
  );

  const projChartData = useMemo(
    () =>
      projections.map((p) => ({
        year: p.year,
        projected: p.projected,
        optimistic: p.optimistic,
        pessimistic: p.pessimistic,
        type: "projection",
      })),
    [projections]
  );

  const allChartData = useMemo(() => [...chartData, ...projChartData], [chartData, projChartData]);

  function fmtPotential(pot: string, potNum: number | null): string {
    if (potNum == null) return nd;
    if (locale === "fr") return `${potNum >= 0 ? "+" : ""}${pot}%`;
    return format.percent(potNum, 1, true);
  }

  return (
    <section className={styles.card}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: C.text }}>
          {t("company.projection.title", { name: company.name })}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: "0.65rem", color: C.textDim }}>{t("company.projection.horizon")}</span>
          {[3, 5, 7, 10].map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setProjYears(y)}
              aria-pressed={projYears === y}
              style={{
                background: projYears === y ? C.gold : "transparent",
                color: projYears === y ? "#000" : C.textDim,
                border: `1px solid ${projYears === y ? C.gold : C.border}`,
                borderRadius: 3,
                padding: "3px 10px",
                cursor: "pointer",
                fontSize: "0.68rem",
                fontFamily: "inherit",
              }}
            >
              {t("company.projection.years", { count: y })}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: "0.65rem", color: C.textDim, marginBottom: 8 }}>
          {t("company.projection.caption")}
        </div>
        <div className={styles.chartBox}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={allChartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="year" tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: C.textDim, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={65}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
              />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: "0.7rem", color: C.textDim }} />
              <ReferenceLine
                x={baseYear}
                stroke={C.gold}
                strokeDasharray="4 4"
                label={{ value: t("company.projection.today"), fill: C.gold, fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="cours"
                name={t("company.projection.history")}
                stroke={company.color}
                strokeWidth={2.5}
                dot={{ r: 3, fill: company.color }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="projected"
                name={t("company.projection.centralShort")}
                stroke={C.silver}
                strokeWidth={2}
                strokeDasharray="8 4"
                dot={{ r: 3, fill: C.silver }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="optimistic"
                name={t("company.projection.optimistic")}
                stroke={C.green}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="pessimistic"
                name={t("company.projection.pessimistic")}
                stroke={C.red}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: C.text, marginBottom: 10 }}>
        {t("company.projection.table")}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className={styles.table}>
          <thead>
            <ColumnFilterRow columns={colDefs} sort={colSort} onSortChange={setColSort} />
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: C.textDim }}>
                  {t("company.noRows")}
                </td>
              </tr>
            ) : (
              filteredRows.map((p) => {
                const potNum = p.pot === "N/D" ? null : parseFloat(p.pot);
                return (
                  <tr key={p.year}>
                    <td style={{ color: C.gold, fontWeight: 700 }}>{p.year}</td>
                    <td>{format.number(p.projected)}</td>
                    <td style={{ color: C.green }}>{format.number(p.optimistic)}</td>
                    <td style={{ color: C.red }}>{format.number(p.pessimistic)}</td>
                    <td
                      style={{
                        color: potNum == null ? C.textDim : potNum >= 0 ? C.green : C.red,
                        fontWeight: 700,
                      }}
                    >
                      {fmtPotential(p.pot, potNum)}
                    </td>
                    <td style={{ color: C.teal }}>
                      {typeof p.estDiv === "number" ? format.number(p.estDiv) : p.estDiv}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className={styles.empty} style={{ marginTop: 10, fontStyle: "italic" }}>
        {t("company.projection.disclaimer")}
      </p>
    </section>
  );
}
