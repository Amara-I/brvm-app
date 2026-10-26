"use client";

// Screener premium — filtres thématiques + tri par colonne.

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { displayRiskSummary } from "@/components/marche/market-copy";
import { C } from "@/lib/theme/colors";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import type { CompanyWithMetrics } from "@/lib/calc/market-summary-stats";
import ColumnFilterRow from "@/components/ui/ColumnFilterRow";
import ChangeValue from "@/components/ui/ChangeValue";
import SignalBadge from "@/components/ui/SignalBadge";
import {
  applyColumnSort,
  type ColumnFilterDef,
  type ColumnSortState,
} from "@/lib/ui/column-filters";
import styles from "./Screener.module.css";

type FilterKey = "rentabilite" | "dividendes" | "croissance" | "valorisation" | "solidite";

function num(v: string | number): number {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isNaN(n) ? -Infinity : n;
}

export default function ScreenerTable({ companies }: { companies: CompanyWithMetrics[] }) {
  const { t, labels, locale } = useI18n();
  const pathname = usePathname();
  const pageKey = `ouestbourse:screener:${pathname}`;
  const [active, setActive] = usePersistedState<FilterKey>(`${pageKey}:active`, "rentabilite");
  const [sector, setSector] = usePersistedState(`${pageKey}:sector`, "Tous");
  const [country, setCountry] = usePersistedState(`${pageKey}:country`, "Tous");
  const [query, setQuery] = usePersistedState(`${pageKey}:query`, "");
  const [colSort, setColSort] = useState<ColumnSortState | null>(null);

  const filters: Array<{ key: FilterKey; label: string }> = [
    { key: "rentabilite", label: t("screener.filters.profitability") },
    { key: "dividendes", label: t("screener.filters.dividends") },
    { key: "croissance", label: t("screener.filters.growth") },
    { key: "valorisation", label: t("screener.filters.valuation") },
    { key: "solidite", label: t("screener.filters.quality") },
  ];

  const colDefs = useMemo<ColumnFilterDef<CompanyWithMetrics>[]>(
    () => [
      {
        key: "company",
        label: t("screener.columns.company"),
        sortKind: "text",
        getValue: ({ co }) => `${co.ticker} ${co.name}`,
      },
      { key: "sector", label: t("screener.columns.sector"), sortKind: "text", getValue: ({ co }) => co.sector },
      { key: "country", label: t("screener.columns.country"), sortKind: "text", getValue: ({ co }) => co.country },
      { key: "score", label: t("screener.columns.score"), sortKind: "number", getValue: ({ metrics }) => String(metrics.score) },
      {
        key: "perf5",
        label: t("screener.columns.perf5"),
        sortKind: "number",
        getValue: ({ metrics }) => String(metrics.perf5Percent),
      },
      {
        key: "yield",
        label: t("screener.columns.yield"),
        sortKind: "number",
        getValue: ({ metrics }) => String(metrics.dividendYieldPercent),
      },
      {
        key: "per",
        label: t("screener.columns.per"),
        sortKind: "number",
        getValue: ({ co }) => (co.per > 0 ? co.per.toFixed(1) : "N/D"),
      },
      { key: "signal", label: t("screener.columns.signal"), sortKind: "text", getValue: ({ metrics }) => metrics.signal.label },
      {
        key: "risk",
        label: t("screener.columns.risk"),
        sortKind: "number",
        getValue: ({ metrics }) => String(metrics.riskAnalysis.riskScore),
      },
      {
        key: "confidence",
        label: t("screener.columns.confidence"),
        sortKind: "text",
        getValue: ({ metrics }) => metrics.confidence,
      },
    ],
    [t]
  );

  const sectors = useMemo(
    () => ["Tous", ...Array.from(new Set(companies.map((c) => c.co.sector))).sort((a, b) => a.localeCompare(b, "fr"))],
    [companies]
  );
  const countries = useMemo(
    () => ["Tous", ...Array.from(new Set(companies.map((c) => c.co.country))).sort((a, b) => a.localeCompare(b, "fr"))],
    [companies]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = companies.filter(({ co }) => {
      if (sector !== "Tous" && co.sector !== sector) return false;
      if (country !== "Tous" && co.country !== country) return false;
      if (!q) return true;
      return co.ticker.toLowerCase().includes(q) || co.name.toLowerCase().includes(q);
    });
    if (!colSort) {
      switch (active) {
        case "rentabilite":
          list = [...list].sort((a, b) => b.metrics.score - a.metrics.score);
          break;
        case "dividendes":
          list = [...list].sort((a, b) => num(b.metrics.dividendYieldPercent) - num(a.metrics.dividendYieldPercent));
          break;
        case "croissance":
          list = [...list].sort((a, b) => num(b.metrics.perf5Percent) - num(a.metrics.perf5Percent));
          break;
        case "valorisation":
          list = list.filter((c) => c.co.per > 0).sort((a, b) => a.co.per - b.co.per);
          break;
        case "solidite":
          list = [...list].sort((a, b) => {
            // Moins de risque + meilleure confiance d'abord
            const dRisk = a.metrics.riskAnalysis.riskScore - b.metrics.riskAnalysis.riskScore;
            if (dRisk !== 0) return dRisk;
            const rank = (c: string) => (c === "Élevée" ? 2 : c === "Moyenne" ? 1 : 0);
            const d = rank(b.metrics.confidence) - rank(a.metrics.confidence);
            return d !== 0 ? d : b.metrics.score - a.metrics.score;
          });
          break;
      }
      return list;
    }
    if (active === "valorisation") {
      list = list.filter((c) => c.co.per > 0);
    }
    return applyColumnSort(list, colDefs, colSort);
  }, [companies, active, sector, country, query, colSort, colDefs]);

  return (
    <div className={styles.shell} data-align-left>
      <div className={styles.toolbar}>
        <div className={styles.chips}>
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setActive(f.key);
                setColSort(null);
              }}
              aria-pressed={active === f.key}
              className={active === f.key ? styles.chipActive : styles.chip}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className={styles.filters}>
          <label className={styles.filterLabel}>
            {t("screener.sector")}
            <select value={sector} onChange={(e) => setSector(e.target.value)} className={styles.select}>
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s === "Tous" ? t("screener.all") : labels.sector(s)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filterLabel}>
            {t("screener.country")}
            <select value={country} onChange={(e) => setCountry(e.target.value)} className={styles.select}>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c === "Tous" ? t("screener.all") : labels.country(c)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filterLabel}>
            {t("screener.search")}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("screener.searchPlaceholder")}
              className={styles.search}
            />
          </label>
        </div>
        <div className={styles.resultCount}>
          {t(filtered.length > 1 ? "screener.resultsMany" : "screener.resultsOne", { count: filtered.length })}
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <ColumnFilterRow columns={colDefs} sort={colSort} onSortChange={setColSort} />
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className={styles.empty}>
                  {t("screener.emptyRow")}
                </td>
              </tr>
            ) : (
              filtered.map(({ co, metrics }) => (
                <tr key={co.ticker}>
                  <td>
                    <Link href={`/actions/${co.ticker}`} className={styles.tickerLink}>
                      {co.countryFlag} <strong>{co.ticker}</strong>
                      <span className={styles.nameDim}> — {co.name}</span>
                    </Link>
                  </td>
                  <td className={styles.dim}>{labels.sector(co.sector)}</td>
                  <td className={styles.dim}>{labels.country(co.country)}</td>
                  <td className="ob-num" style={{ color: C.blue, fontWeight: 700 }}>
                    {metrics.score}
                  </td>
                  <td>
                    {metrics.perf5Percent !== "N/D" ? (
                      <ChangeValue value={num(metrics.perf5Percent)} digits={1} />
                    ) : (
                      <span className="ob-nd">N/D</span>
                    )}
                  </td>
                  <td className="ob-num" style={{ color: C.teal }}>
                    {metrics.dividendYieldPercent}%
                  </td>
                  <td className="ob-num">{co.per > 0 ? co.per.toFixed(1) : <span className="ob-nd">N/D</span>}</td>
                  <td>
                    <SignalBadge
                      label={metrics.signal.label}
                      title={labels.signalSummary({
                        label: metrics.signal.label,
                        score: metrics.score,
                        confidence: metrics.confidence,
                        signalSummary: metrics.signalSummary,
                        signalReasons: metrics.signalReasons,
                      })}
                    />
                  </td>
                  <td
                    title={displayRiskSummary(metrics.riskAnalysis, locale, labels)}
                    style={{
                      color:
                        metrics.riskAnalysis.riskScore < 40
                          ? C.green
                          : metrics.riskAnalysis.riskScore > 65
                            ? C.red
                            : C.gold,
                      fontWeight: 600,
                      fontSize: "0.72rem",
                      cursor: "help",
                    }}
                  >
                    {labels.riskTier(metrics.riskAnalysis.riskTier)}
                  </td>
                  <td className={styles.dim}>{labels.confidence(metrics.confidence)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
