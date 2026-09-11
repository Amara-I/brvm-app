"use client";

// Screener premium — filtres thématiques + tri par colonne.

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "rentabilite", label: "Rentabilité" },
  { key: "dividendes", label: "Dividendes" },
  { key: "croissance", label: "Croissance" },
  { key: "valorisation", label: "Valorisation" },
  { key: "solidite", label: "Solidité" },
];

function num(v: string | number): number {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isNaN(n) ? -Infinity : n;
}

const COL_DEFS: ColumnFilterDef<CompanyWithMetrics>[] = [
  {
    key: "company",
    label: "Société",
    sortKind: "text",
    getValue: ({ co }) => `${co.ticker} ${co.name}`,
  },
  { key: "sector", label: "Secteur", sortKind: "text", getValue: ({ co }) => co.sector },
  { key: "country", label: "Pays", sortKind: "text", getValue: ({ co }) => co.country },
  { key: "score", label: "Score", sortKind: "number", getValue: ({ metrics }) => String(metrics.score) },
  {
    key: "perf5",
    label: "Perf. 5 ans",
    sortKind: "number",
    getValue: ({ metrics }) => String(metrics.perf5Percent),
  },
  {
    key: "yield",
    label: "Rend. div.",
    sortKind: "number",
    getValue: ({ metrics }) => String(metrics.dividendYieldPercent),
  },
  {
    key: "per",
    label: "PER",
    sortKind: "number",
    getValue: ({ co }) => (co.per > 0 ? co.per.toFixed(1) : "N/D"),
  },
  { key: "signal", label: "Signal", sortKind: "text", getValue: ({ metrics }) => metrics.signal.label },
  {
    key: "risk",
    label: "Risque",
    sortKind: "number",
    getValue: ({ metrics }) => String(metrics.riskAnalysis.riskScore),
  },
  { key: "confidence", label: "Confiance", sortKind: "text", getValue: ({ metrics }) => metrics.confidence },
];

export default function ScreenerTable({ companies }: { companies: CompanyWithMetrics[] }) {
  const pathname = usePathname();
  const pageKey = `ouestbourse:screener:${pathname}`;
  const [active, setActive] = usePersistedState<FilterKey>(`${pageKey}:active`, "rentabilite");
  const [sector, setSector] = usePersistedState(`${pageKey}:sector`, "Tous");
  const [country, setCountry] = usePersistedState(`${pageKey}:country`, "Tous");
  const [query, setQuery] = usePersistedState(`${pageKey}:query`, "");
  const [colSort, setColSort] = useState<ColumnSortState | null>(null);

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
    return applyColumnSort(list, COL_DEFS, colSort);
  }, [companies, active, sector, country, query, colSort]);

  return (
    <div className={styles.shell} data-align-left>
      <div className={styles.toolbar}>
        <div className={styles.chips}>
          {FILTERS.map((f) => (
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
            Secteur
            <select value={sector} onChange={(e) => setSector(e.target.value)} className={styles.select}>
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filterLabel}>
            Pays
            <select value={country} onChange={(e) => setCountry(e.target.value)} className={styles.select}>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filterLabel}>
            Recherche
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ticker ou nom…"
              className={styles.search}
            />
          </label>
        </div>
        <div className={styles.resultCount}>
          {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <ColumnFilterRow columns={COL_DEFS} sort={colSort} onSortChange={setColSort} />
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className={styles.empty}>
                  Aucun titre ne correspond à ces filtres.
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
                  <td className={styles.dim}>{co.sector}</td>
                  <td className={styles.dim}>{co.country}</td>
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
                    <SignalBadge label={metrics.signal.label} title={metrics.signalSummary} />
                  </td>
                  <td
                    title={metrics.riskAnalysis.summary}
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
                    {metrics.riskAnalysis.riskTier}
                  </td>
                  <td className={styles.dim}>{metrics.confidence}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
