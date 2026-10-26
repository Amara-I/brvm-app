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
import { useI18n } from "@/components/i18n/I18nProvider";
import { C } from "@/lib/theme/colors";
import { calcMetrics, type CalcMetricsResult } from "@/lib/calc/calc-metrics";
import type { CompanyFullDataset } from "@/lib/api/companies-full-dataset";
import ColumnFilterRow from "@/components/ui/ColumnFilterRow";
import SheetTermLabel from "@/components/actions/SheetTermLabel";
import {
  applyColumnSort,
  type ColumnFilterDef,
  type ColumnSortState,
} from "@/lib/ui/column-filters";
import styles from "./CompanySheet.module.css";

type MetricRow = {
  id: string;
  french: string;
  label: string;
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

export default function CompanyComparisonPanel({
  company,
  companies,
  years,
}: {
  company: CompanyFullDataset;
  companies: CompanyFullDataset[];
  years: number[];
}) {
  const { t, format, labels, locale } = useI18n();
  const nd = t("common.nd");

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

  function fmtPerf(raw: string, digits: number, spaced: boolean): string {
    if (raw === "N/D") return nd;
    const n = parseFloat(raw);
    if (locale === "fr") {
      const sign = n > 0 ? "+" : "";
      return spaced ? `${sign}${raw} %` : `${sign}${raw}%`;
    }
    return format.percent(n, digits, true);
  }

  function fmtRawPct(raw: string | number): string {
    if (locale === "fr") return `${raw}%`;
    if (raw === "N/D" || raw === "") return nd;
    const n = typeof raw === "number" ? raw : parseFloat(String(raw));
    if (!Number.isFinite(n)) return `${raw}%`;
    return format.percent(n, String(raw).includes(".") ? String(raw).split(".")[1]!.length : 0, false);
  }

  const metricRows = useMemo<MetricRow[]>(() => {
    const defs: Array<{
      id: string;
      french: string;
      label: string;
      fn: (m: CalcMetricsResult, co: CompanyFullDataset) => string | number;
      c: string | null;
    }> = [
      {
        id: "price",
        french: "Cours actuel (FCFA)",
        label: t("company.comparison.price"),
        fn: (m) => format.number(m.currentPrice),
        c: C.text,
      },
      {
        id: "score",
        french: "Score (/100)",
        label: t("company.comparison.score"),
        fn: (m) => m.score,
        c: null,
      },
      {
        id: "signal",
        french: "Signal",
        label: t("company.comparison.signal"),
        fn: (m) => labels.signal(m.signal.label),
        c: null,
      },
      {
        id: "perf5pct",
        french: "Perf. 5 ans (%)",
        label: t("company.comparison.perf5pct"),
        fn: (m) => (m.perf5Percent === "N/D" ? nd : fmtPerf(m.perf5Percent, 1, false)),
        c: null,
      },
      {
        id: "perf10pct",
        french: "Perf. 10 ans (%)",
        label: t("company.comparison.perf10pct"),
        fn: (m) => (m.perf10Percent === "N/D" ? nd : fmtPerf(m.perf10Percent, 1, false)),
        c: null,
      },
      {
        id: "divYieldPct",
        french: "Rendement div. (%)",
        label: t("company.comparison.divYieldPct"),
        fn: (m) => fmtRawPct(m.dividendYieldPercent),
        c: C.teal,
      },
      {
        id: "per",
        french: "PER",
        label: t("company.comparison.per"),
        fn: (_m, co) => (co.per > 0 ? co.per : nd),
        c: C.blue,
      },
      {
        id: "risk",
        french: "Risque",
        label: t("company.comparison.risk"),
        fn: (m) => `${labels.riskTier(m.riskAnalysis.riskTier)} (${m.riskAnalysis.riskScore})`,
        c: null,
      },
      {
        id: "volatility",
        french: "Volatilité (%)",
        label: t("company.comparison.volatility"),
        fn: (m) => fmtRawPct(m.volatilityPercent),
        c: null,
      },
      {
        id: "riskVol",
        french: "Risque (volatilité)",
        label: t("company.comparison.riskVol"),
        fn: (m) => labels.riskLevel(m.riskLevel),
        c: null,
      },
      {
        id: "mktcap",
        french: "Cap. boursière",
        label: t("company.comparison.mktcap"),
        fn: (_m, co) =>
          co.mktcap > 0
            ? locale === "fr"
              ? `${co.mktcap} Mds`
              : t("company.comparison.mktcapValue", { value: format.number(co.mktcap) })
            : nd,
        c: C.gold,
      },
    ];
    return defs.map((row) => {
      const values: Record<string, string | number> = {};
      for (const ticker of compSelected) {
        const co = companies.find((c) => c.ticker === ticker);
        const m = co ? metricsByTicker.get(co.ticker) : null;
        values[ticker] = co && m ? row.fn(m, co) : "—";
      }
      return { id: row.id, french: row.french, label: row.label, values, c: row.c };
    });
    // fmtPerf / fmtRawPct follow locale, format and labels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compSelected, companies, metricsByTicker, t, format, labels, locale, nd]);

  const colDefs = useMemo<ColumnFilterDef<MetricRow>[]>(() => {
    const defs: ColumnFilterDef<MetricRow>[] = [
      {
        key: "indicateur",
        label: t("company.comparison.indicator"),
        sortKind: "text",
        getValue: (r) => r.label,
      },
    ];
    for (const ticker of compSelected) {
      const co = companies.find((c) => c.ticker === ticker);
      defs.push({
        key: ticker,
        label: co ? `${co.countryFlag} ${ticker}` : ticker,
        sortKind: "auto",
        getValue: (r) => String(r.values[ticker] ?? ""),
      });
    }
    return defs;
  }, [compSelected, companies, t]);

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
      for (const ticker of compSelected) {
        const co = companies.find((c) => c.ticker === ticker);
        if (co && (co.prices[y] ?? 0) > 0) {
          const firstValid = years.find((fy) => (co.prices[fy] ?? 0) > 0);
          obj[ticker] = firstValid ? Math.round((co.prices[y]! / co.prices[firstValid]!) * 100) : 0;
        }
      }
      return obj;
    });
  }, [years, compSelected, companies]);

  function toggleComp(ticker: string) {
    setCompSelected((prev) => {
      if (prev.includes(ticker)) return prev.filter((x) => x !== ticker);
      if (prev.length >= 3) return [...prev.slice(1), ticker];
      return [...prev, ticker];
    });
  }

  const criteria = [
    {
      french: "Perf. 5 ans",
      label: t("company.comparison.perf5"),
      fn: (m: CalcMetricsResult) => (m.perf5Percent === "N/D" ? nd : fmtPerf(m.perf5Percent, 1, true)),
    },
    {
      french: "Rend. div.",
      label: t("company.comparison.divYield"),
      fn: (m: CalcMetricsResult) =>
        m.dividendYieldPercent === "N/D"
          ? nd
          : locale === "fr"
            ? `${m.dividendYieldPercent} %`
            : format.percent(parseFloat(String(m.dividendYieldPercent)), 2, false),
    },
    {
      french: "Risque",
      label: t("company.comparison.risk"),
      fn: (m: CalcMetricsResult) => labels.riskTier(m.riskAnalysis.riskTier) || nd,
    },
    {
      french: "Confiance",
      label: t("company.comparison.confidence"),
      fn: (m: CalcMetricsResult) => labels.confidence(m.confidence) || nd,
    },
  ];

  return (
    <section className={styles.card}>
      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: C.text, marginBottom: 8 }}>
        {t("company.comparison.select")}
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
              aria-label={t(sel ? "company.comparison.remove" : "company.comparison.add", {
                name: co.name,
                ticker: co.ticker,
              })}
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
          {t("company.comparison.relative")}
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
              {compSelected.map((ticker) => {
                const co = companies.find((c) => c.ticker === ticker);
                return co ? (
                  <Line
                    key={ticker}
                    type="monotone"
                    dataKey={ticker}
                    name={`${co.countryFlag} ${ticker}`}
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
        {t("company.comparison.criteria")}
      </div>
      <div style={{ overflowX: "auto", marginBottom: 18 }}>
        <table className={styles.table} style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th scope="col">{t("company.comparison.criterion")}</th>
              {compSelected.map((ticker) => {
                const co = companies.find((c) => c.ticker === ticker);
                return (
                  <th key={ticker} scope="col" style={{ textAlign: "right" }}>
                    {co ? `${co.countryFlag} ${ticker}` : ticker}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {criteria.map((row) => (
              <tr key={row.french}>
                <td style={{ color: C.textDim, fontWeight: 600 }}>
                  <SheetTermLabel french={row.french} text={row.label} />
                </td>
                {compSelected.map((ticker) => {
                  const m = metricsByTicker.get(ticker);
                  const raw = m ? row.fn(m) : nd;
                  return (
                    <td key={ticker} style={{ textAlign: "right" }}>
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

      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: C.text, marginBottom: 10 }}>
        {t("company.comparison.compared")}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className={styles.table}>
          <thead>
            <ColumnFilterRow columns={colDefs} sort={colSort} onSortChange={setColSort} />
          </thead>
          <tbody>
            {filteredMetricRows.length === 0 ? (
              <tr>
                <td colSpan={1 + compSelected.length} style={{ color: C.textDim }}>
                  {t("company.noRows")}
                </td>
              </tr>
            ) : (
              filteredMetricRows.map((row) => (
                <tr key={row.id}>
                  <td style={{ color: C.textDim, fontWeight: 600 }}>
                    <SheetTermLabel french={row.french} text={row.label} />
                  </td>
                  {compSelected.map((ticker) => (
                    <td
                      key={ticker}
                      style={{
                        textAlign: "right",
                        color: row.c || C.text,
                        fontWeight: row.id === "signal" ? 700 : 400,
                      }}
                    >
                      {row.values[ticker]}
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
