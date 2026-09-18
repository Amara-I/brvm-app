"use client";

// Comparaison multi-titres — porté depuis le dashboard marché vers la fiche société.

import { useEffect, useMemo, useState } from "react";
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
import { calcMetrics, type CalcMetricsResult } from "@/lib/calc/calc-metrics";
import type { CompanyFullDataset } from "@/lib/api/companies-full-dataset";
import ColumnFilterRow from "@/components/ui/ColumnFilterRow";
import LinkedAnalysisLabel from "@/components/education/LinkedAnalysisLabel";
import {
  applyColumnSort,
  type ColumnFilterDef,
  type ColumnSortState,
} from "@/lib/ui/column-filters";
import styles from "./CompanySheet.module.css";

type MetricRow = {
  l: string;
  values: Record<string, string | number>;
  c: string | null;
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

export default function CompanyComparisonPanel({
  company,
  companies,
  years,
}: {
  company: CompanyFullDataset;
  companies: CompanyFullDataset[];
  years: number[];
}) {
  const defaultPeers = useMemo(() => {
    const sameSector = companies
      .filter((c) => c.ticker !== company.ticker && c.sector === company.sector)
      .slice(0, 2)
      .map((c) => c.ticker);
    const fill = companies
      .filter((c) => c.ticker !== company.ticker && !sameSector.includes(c.ticker))
      .slice(0, Math.max(0, 2 - sameSector.length))
      .map((c) => c.ticker);
    return [company.ticker, ...sameSector, ...fill].slice(0, 3);
  }, [company, companies]);

  const [compSelected, setCompSelected] = useState<string[]>(defaultPeers);
  const [colSort, setColSort] = useState<ColumnSortState | null>(null);

  const metricsByTicker = useMemo(() => {
    const map = new Map<string, CalcMetricsResult>();
    for (const co of companies) {
      map.set(
        co.ticker,
        calcMetrics({
          years,
          prices: co.prices,
          dividends: co.dividends,
          per: co.per,
          mktcap: co.mktcap,
          sector: co.sector,
        })
      );
    }
    return map;
  }, [companies, years]);

  const metricRows = useMemo<MetricRow[]>(() => {
    const defs: Array<{
      l: string;
      fn: (m: CalcMetricsResult, co: CompanyFullDataset) => string | number;
      c: string | null;
    }> = [
      {
        l: "Cours actuel (FCFA)",
        fn: (m) => m.currentPrice.toLocaleString("fr-FR"),
        c: C.text,
      },
      { l: "Score (/100)", fn: (m) => m.score, c: null },
      { l: "Signal", fn: (m) => m.signal.label, c: null },
      {
        l: "Perf. 5 ans (%)",
        fn: (m) =>
          m.perf5Percent === "N/D"
            ? "N/D"
            : `${parseFloat(String(m.perf5Percent)) > 0 ? "+" : ""}${m.perf5Percent}%`,
        c: null,
      },
      {
        l: "Perf. 10 ans (%)",
        fn: (m) =>
          m.perf10Percent !== "N/D"
            ? `${parseFloat(String(m.perf10Percent)) > 0 ? "+" : ""}${m.perf10Percent}%`
            : "N/D",
        c: null,
      },
      {
        l: "Rendement div. (%)",
        fn: (m) => `${m.dividendYieldPercent}%`,
        c: C.teal,
      },
      {
        l: "PER",
        fn: (_m, co) => (co.per > 0 ? co.per : "N/D"),
        c: C.blue,
      },
      { l: "Risque", fn: (m) => `${m.riskAnalysis.riskTier} (${m.riskAnalysis.riskScore})`, c: null },
      { l: "Volatilité (%)", fn: (m) => `${m.volatilityPercent}%`, c: null },
      { l: "Risque (volatilité)", fn: (m) => m.riskLevel, c: null },
      {
        l: "Cap. boursière",
        fn: (_m, co) => (co.mktcap > 0 ? `${co.mktcap} Mds` : "N/D"),
        c: C.gold,
      },
    ];
    return defs.map((row) => {
      const values: Record<string, string | number> = {};
      for (const t of compSelected) {
        const co = companies.find((c) => c.ticker === t);
        const m = co ? metricsByTicker.get(co.ticker) : null;
        values[t] = co && m ? row.fn(m, co) : "—";
      }
      return { l: row.l, values, c: row.c };
    });
  }, [compSelected, companies, metricsByTicker]);

  const colDefs = useMemo<ColumnFilterDef<MetricRow>[]>(() => {
    const defs: ColumnFilterDef<MetricRow>[] = [
      { key: "indicateur", label: "Indicateur", sortKind: "text", getValue: (r) => r.l },
    ];
    for (const t of compSelected) {
      const co = companies.find((c) => c.ticker === t);
      defs.push({
        key: t,
        label: co ? `${co.countryFlag} ${t}` : t,
        sortKind: "auto",
        getValue: (r) => String(r.values[t] ?? ""),
      });
    }
    return defs;
  }, [compSelected, companies]);

  // Réinitialise le tri si la colonne active disparaît (ticker déselectionné).
  useEffect(() => {
    setColSort((prev) => {
      if (!prev) return null;
      if (prev.key === "indicateur" || compSelected.includes(prev.key)) return prev;
      return null;
    });
  }, [compSelected]);

  const filteredMetricRows = useMemo(
    () => applyColumnSort(metricRows, colDefs, colSort),
    [metricRows, colDefs, colSort]
  );

  const compData = useMemo(() => {
    return years.map((y) => {
      const obj: Record<string, number> = { year: y };
      for (const t of compSelected) {
        const co = companies.find((c) => c.ticker === t);
        if (co && (co.prices[y] ?? 0) > 0) {
          const firstValid = years.find((fy) => (co.prices[fy] ?? 0) > 0);
          obj[t] = firstValid ? Math.round((co.prices[y]! / co.prices[firstValid]!) * 100) : 0;
        }
      }
      return obj;
    });
  }, [years, compSelected, companies]);

  function toggleComp(t: string) {
    setCompSelected((prev) => {
      if (prev.includes(t)) return prev.filter((x) => x !== t);
      if (prev.length >= 3) return [...prev.slice(1), t];
      return [...prev, t];
    });
  }

  return (
    <section className={styles.card}>
      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: C.text, marginBottom: 8 }}>
        Sélectionner jusqu&apos;à 3 actions à comparer
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {companies.map((co) => {
          const sel = compSelected.includes(co.ticker);
          return (
            <button
              key={co.ticker}
              type="button"
              onClick={() => toggleComp(co.ticker)}
              aria-pressed={sel}
              aria-label={`${sel ? "Retirer" : "Ajouter"} ${co.name} (${co.ticker}) de la comparaison`}
              style={{
                background: sel ? `${co.color}25` : "transparent",
                color: sel ? co.color : C.textDim,
                border: `1px solid ${sel ? co.color : C.border}`,
                borderRadius: 4,
                padding: "4px 10px",
                cursor: "pointer",
                fontSize: "0.68rem",
                fontWeight: sel ? 700 : 400,
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              <span aria-hidden="true">{co.countryFlag}</span> {co.ticker}
            </button>
          );
        })}
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: "0.65rem", color: C.textDim, marginBottom: 8 }}>
          Performance relative (base 100 à l&apos;introduction)
        </div>
        <div className={styles.chartBox}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={compData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="year" tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: "0.7rem", color: C.textDim }} />
              <ReferenceLine y={100} stroke={C.border} strokeDasharray="4 4" />
              {compSelected.map((t) => {
                const co = companies.find((c) => c.ticker === t);
                return co ? (
                  <Line
                    key={t}
                    type="monotone"
                    dataKey={t}
                    name={`${co.countryFlag} ${t}`}
                    stroke={co.color}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ) : null;
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: C.text, marginBottom: 10 }}>
        Critères de comparaison
      </div>
      <div style={{ overflowX: "auto", marginBottom: 18 }}>
        <table className={styles.table} style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th scope="col">Critère</th>
              {compSelected.map((t) => {
                const co = companies.find((c) => c.ticker === t);
                return (
                  <th key={t} scope="col" style={{ textAlign: "right" }}>
                    {co ? `${co.countryFlag} ${t}` : t}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {(
              [
                {
                  l: "Perf. 5 ans",
                  fn: (m: CalcMetricsResult) =>
                    m.perf5Percent === "N/D"
                      ? "N/D"
                      : `${parseFloat(String(m.perf5Percent)) > 0 ? "+" : ""}${m.perf5Percent} %`,
                },
                {
                  l: "Rend. div.",
                  fn: (m: CalcMetricsResult) =>
                    m.dividendYieldPercent === "N/D" ? "N/D" : `${m.dividendYieldPercent} %`,
                },
                {
                  l: "Risque",
                  fn: (m: CalcMetricsResult) => m.riskAnalysis.riskTier || "N/D",
                },
                {
                  l: "Confiance",
                  fn: (m: CalcMetricsResult) => m.confidence || "N/D",
                },
              ] as const
            ).map((row) => (
              <tr key={row.l}>
                <td style={{ color: C.textDim, fontWeight: 600 }}>
                  <LinkedAnalysisLabel text={row.l} />
                </td>
                {compSelected.map((t) => {
                  const m = metricsByTicker.get(t);
                  const raw = m ? row.fn(m) : "N/D";
                  return (
                    <td key={t} style={{ textAlign: "right" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: `1px solid ${C.border}`,
                          background: C.panel,
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          color: C.text,
                        }}
                      >
                        {raw}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: C.text, marginBottom: 10 }}>Métriques comparées</div>
      <div style={{ overflowX: "auto" }}>
        <table className={styles.table}>
          <thead>
            <ColumnFilterRow columns={colDefs} sort={colSort} onSortChange={setColSort} />
          </thead>
          <tbody>
            {filteredMetricRows.length === 0 ? (
              <tr>
                <td colSpan={1 + compSelected.length} style={{ color: C.textDim }}>
                  Aucune ligne.
                </td>
              </tr>
            ) : (
              filteredMetricRows.map((row) => (
                <tr key={row.l}>
                  <td style={{ color: C.textDim, fontWeight: 600 }}>
                    <LinkedAnalysisLabel text={row.l} />
                  </td>
                  {compSelected.map((t) => (
                    <td
                      key={t}
                      style={{
                        textAlign: "right",
                        color: row.c || C.text,
                        fontWeight: row.l === "Signal" ? 700 : 400,
                      }}
                    >
                      {row.values[t]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
