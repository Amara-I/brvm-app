"use client";

// Screener NGX : notes sur 100 par politique d'investissement. Même coque visuelle que le screener BRVM
// (components/screener), données issues de lib/markets/ngx-screener.ts (aucun calcul ici).

import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import ChangeValue from "@/components/ui/ChangeValue";
import ColumnFilterRow from "@/components/ui/ColumnFilterRow";
import { PORTFOLIO_TYPE_IDS, type PortfolioTypeId } from "@/lib/portfolio-types/constants";
import { scoreBand, type NgxScoreBand } from "@/lib/ngx/score";
import { applyColumnSort, type ColumnFilterDef, type ColumnSortState } from "@/lib/ui/column-filters";
import { usePersistedState } from "@/lib/ui/use-persisted-state";
import type { NgxScreenerRow } from "@/lib/markets/ngx-screener";
import styles from "@/components/screener/Screener.module.css";
import local from "./NgxScreener.module.css";

export type NgxScreenerTableRow = NgxScreenerRow & { sectorLabel: string };

type ChipKey = "OVERALL" | PortfolioTypeId;
type DataFilter = "fundamentals" | "all" | "chartOnly";

const BAND_CLASS: Record<NgxScoreBand, string> = {
  HIGH: local.pillHigh,
  GOOD: local.pillGood,
  MIXED: local.pillMixed,
  LOW: local.pillLow,
};

function ScorePill({ value }: { value: number | null }) {
  if (value == null) return <span className="ob-nd">N/D</span>;
  const band = scoreBand(value);
  return <span className={`${local.pill} ${band ? BAND_CLASS[band] : ""}`}>{Math.round(value)}</span>;
}

function chipScore(row: NgxScreenerRow, key: ChipKey): number | null {
  return key === "OVERALL" ? row.overall : row.policies[key];
}

export default function NgxScreenerTable({
  rows,
  policyLabels,
}: {
  rows: NgxScreenerTableRow[];
  policyLabels: Record<PortfolioTypeId, string>;
}) {
  const { t, format } = useI18n();
  const pageKey = "ouestbourse:ngx-screener";
  const [active, setActive] = usePersistedState<ChipKey>(`${pageKey}:active`, "OVERALL");
  const [data, setData] = usePersistedState<DataFilter>(`${pageKey}:data`, "fundamentals");
  const [sector, setSector] = usePersistedState(`${pageKey}:sector`, "");
  const [query, setQuery] = usePersistedState(`${pageKey}:query`, "");
  const [colSort, setColSort] = useState<ColumnSortState | null>(null);

  const chips: Array<{ key: ChipKey; label: string }> = [
    { key: "OVERALL", label: t("ngx.screener.chips.overall") },
    ...PORTFOLIO_TYPE_IDS.map((id) => ({ key: id as ChipKey, label: policyLabels[id] })),
  ];

  const scoreCell = (v: number | null) => (v == null ? "N/D" : String(v));

  const colDefs = useMemo<ColumnFilterDef<NgxScreenerTableRow>[]>(
    () => [
      { key: "company", label: t("ngx.screener.columns.company"), sortKind: "text", getValue: (r) => `${r.ticker} ${r.name}` },
      { key: "sector", label: t("ngx.screener.columns.sector"), sortKind: "text", getValue: (r) => r.sectorLabel },
      { key: "score", label: t("ngx.screener.columns.score"), sortKind: "number", getValue: (r) => scoreCell(r.overall) },
      ...PORTFOLIO_TYPE_IDS.map(
        (id): ColumnFilterDef<NgxScreenerTableRow> => ({
          key: `policy-${id}`,
          label: policyLabels[id],
          sortKind: "number",
          getValue: (r) => scoreCell(r.policies[id]),
        }),
      ),
      {
        key: "perf1y",
        label: t("ngx.screener.columns.perf1y"),
        sortKind: "number",
        getValue: (r) => (r.return1yPercent == null ? "N/D" : String(r.return1yPercent)),
      },
      { key: "per", label: t("ngx.screener.columns.per"), sortKind: "number", getValue: (r) => (r.per == null ? "N/D" : String(r.per)) },
      {
        key: "yield",
        label: t("ngx.screener.columns.yield"),
        sortKind: "number",
        getValue: (r) => (r.yieldPercent == null ? "N/D" : String(r.yieldPercent)),
      },
      { key: "confidence", label: t("ngx.screener.columns.confidence"), sortKind: "text", getValue: (r) => r.confidence },
    ],
    [t, policyLabels],
  );

  const sectors = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.sectorSlug, r.sectorLabel);
    return Array.from(map, ([slug, label]) => ({ slug, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (data === "fundamentals" && !r.hasFundamentals) return false;
      if (data === "chartOnly" && r.mode !== "CHART_ONLY") return false;
      if (sector && r.sectorSlug !== sector) return false;
      if (!q) return true;
      return r.ticker.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
    });
    if (colSort) return applyColumnSort(list, colDefs, colSort);
    // Tri par défaut : la note choisie, les N/D en dernier, puis la capitalisation.
    return [...list].sort((a, b) => {
      const sa = chipScore(a, active);
      const sb = chipScore(b, active);
      if (sa == null && sb == null) return (b.marketCapBn ?? 0) - (a.marketCapBn ?? 0);
      if (sa == null) return 1;
      if (sb == null) return -1;
      return sb - sa || (b.marketCapBn ?? 0) - (a.marketCapBn ?? 0);
    });
  }, [rows, data, sector, query, colSort, colDefs, active]);

  const dataOptions: Array<{ key: DataFilter; label: string }> = [
    { key: "fundamentals", label: t("ngx.screener.data.fundamentals") },
    { key: "all", label: t("ngx.screener.data.all") },
    { key: "chartOnly", label: t("ngx.screener.data.chartOnly") },
  ];

  return (
    <div className={styles.shell} data-align-left data-testid="ngx-screener">
      <div className={styles.toolbar}>
        <div className={styles.chips}>
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                setActive(c.key);
                setColSort(null);
              }}
              aria-pressed={active === c.key}
              className={active === c.key ? styles.chipActive : styles.chip}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className={styles.filters}>
          <label className={styles.filterLabel}>
            {t("ngx.screener.data.label")}
            <select value={data} onChange={(e) => setData(e.target.value as DataFilter)} className={styles.select}>
              {dataOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filterLabel}>
            {t("ngx.screener.sector")}
            <select value={sector} onChange={(e) => setSector(e.target.value)} className={styles.select}>
              <option value="">{t("ngx.screener.allSectors")}</option>
              {sectors.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filterLabel}>
            {t("ngx.screener.search")}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("ngx.screener.searchPlaceholder")}
              className={styles.search}
            />
          </label>
        </div>
        <div className={styles.resultCount}>
          {t(filtered.length > 1 ? "ngx.screener.resultsMany" : "ngx.screener.resultsOne", { count: filtered.length })}
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
                <td colSpan={colDefs.length} className={styles.empty}>
                  {t("ngx.screener.emptyRow")}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.ticker} data-mode={r.mode}>
                  <td>
                    <Link href={`/marches/ngx/actions/${r.ticker}`} className={styles.tickerLink}>
                      <strong>{r.ticker}</strong>
                      <span className={styles.nameDim}> — {r.name}</span>
                    </Link>
                  </td>
                  <td className={styles.dim}>{r.sectorLabel}</td>
                  <td>
                    <span className={local.scoreCell}>
                      <ScorePill value={r.overall} />
                      {r.mode === "CHART_ONLY" ? (
                        <span className={local.tag} title={t("ngx.screener.tags.chartOnlyTitle")}>
                          {t("ngx.screener.tags.chartOnly")}
                        </span>
                      ) : r.mode === "PARTIAL" ? (
                        <span className={local.tag} title={t("ngx.screener.tags.partialTitle")}>
                          {t("ngx.screener.tags.partial")}
                        </span>
                      ) : null}
                      {r.staleAccountsYear != null ? (
                        <span className={local.tag} title={t("ngx.screener.tags.staleTitle", { year: r.staleAccountsYear })}>
                          {t("ngx.screener.tags.stale", { year: r.staleAccountsYear })}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  {PORTFOLIO_TYPE_IDS.map((id) => (
                    <td key={id}>
                      <ScorePill value={r.policies[id]} />
                    </td>
                  ))}
                  <td>
                    {r.return1yPercent != null ? <ChangeValue value={r.return1yPercent} digits={1} /> : <span className="ob-nd">N/D</span>}
                  </td>
                  <td className="ob-num">{r.per != null ? format.decimal(r.per, 1) : <span className="ob-nd">N/D</span>}</td>
                  <td className="ob-num">
                    {r.yieldPercent != null ? format.percent(r.yieldPercent, 1) : <span className="ob-nd">N/D</span>}
                  </td>
                  <td className={styles.dim}>{r.overall != null ? t(`ngx.sheet.score.confidence.${r.confidence}`) : <span className="ob-nd">N/D</span>}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
