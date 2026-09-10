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
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString("fr-FR") : p.value}
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
  const [projYears, setProjYears] = useState(5);
  const [colSort, setColSort] = useState<ColumnSortState | null>(null);
  const baseYear = years[years.length - 1] ?? new Date().getUTCFullYear();

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
      { key: "year", label: "Année", sortKind: "number", getValue: (r) => String(r.year) },
      {
        key: "central",
        label: "Scénario central",
        sortKind: "number",
        getValue: (r) => r.projected.toLocaleString("fr-FR"),
      },
      {
        key: "opt",
        label: "Optimiste (+15%)",
        sortKind: "number",
        getValue: (r) => r.optimistic.toLocaleString("fr-FR"),
      },
      {
        key: "pess",
        label: "Pessimiste (-15%)",
        sortKind: "number",
        getValue: (r) => r.pessimistic.toLocaleString("fr-FR"),
      },
      { key: "pot", label: "Potentiel (%)", sortKind: "number", getValue: (r) => r.pot },
      {
        key: "div",
        label: "Div. estimé",
        sortKind: "number",
        getValue: (r) => (typeof r.estDiv === "number" ? r.estDiv.toLocaleString("fr-FR") : String(r.estDiv)),
      },
    ],
    []
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

  return (
    <section className={styles.card}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: C.text }}>
          Projection {company.name} — Régression linéaire sur données historiques
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: "0.65rem", color: C.textDim }}>Horizon :</span>
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
              {y} ans
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: "0.65rem", color: C.textDim, marginBottom: 8 }}>
          Historique + Projection (scénarios optimiste / central / pessimiste)
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
                label={{ value: "Aujourd'hui", fill: C.gold, fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="cours"
                name="Historique"
                stroke={company.color}
                strokeWidth={2.5}
                dot={{ r: 3, fill: company.color }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="projected"
                name="Proj. centrale"
                stroke={C.silver}
                strokeWidth={2}
                strokeDasharray="8 4"
                dot={{ r: 3, fill: C.silver }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="optimistic"
                name="Scénario optimiste"
                stroke={C.green}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="pessimistic"
                name="Scénario pessimiste"
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

      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: C.text, marginBottom: 10 }}>Tableau de projection</div>
      <div style={{ overflowX: "auto" }}>
        <table className={styles.table}>
          <thead>
            <ColumnFilterRow columns={colDefs} sort={colSort} onSortChange={setColSort} />
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: C.textDim }}>
                  Aucune ligne.
                </td>
              </tr>
            ) : (
              filteredRows.map((p) => {
                const potNum = p.pot === "N/D" ? null : parseFloat(p.pot);
                return (
                  <tr key={p.year}>
                    <td style={{ color: C.gold, fontWeight: 700 }}>{p.year}</td>
                    <td>{p.projected.toLocaleString("fr-FR")}</td>
                    <td style={{ color: C.green }}>{p.optimistic.toLocaleString("fr-FR")}</td>
                    <td style={{ color: C.red }}>{p.pessimistic.toLocaleString("fr-FR")}</td>
                    <td
                      style={{
                        color: potNum == null ? C.textDim : potNum >= 0 ? C.green : C.red,
                        fontWeight: 700,
                      }}
                    >
                      {potNum == null ? "N/D" : `${potNum >= 0 ? "+" : ""}${p.pot}%`}
                    </td>
                    <td style={{ color: C.teal }}>
                      {typeof p.estDiv === "number" ? p.estDiv.toLocaleString("fr-FR") : p.estDiv}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className={styles.empty} style={{ marginTop: 10, fontStyle: "italic" }}>
        ⚠️ Projections basées sur la régression linéaire des données historiques. Non garanties. Scénarios ±15% par
        rapport à la tendance centrale.
      </p>
    </section>
  );
}
