"use client";

// Dividendes NGX : même coque que le calendrier des dividendes BRVM (components/dividendes), montants en naira.
// Données issues de lib/markets/ngx-dividends.ts (aucun calcul de montant ici).

import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import ColumnFilterRow from "@/components/ui/ColumnFilterRow";
import { translateDataSourceLabel } from "@/components/marche/market-copy";
import { applyColumnSort, type ColumnFilterDef, type ColumnSortState } from "@/lib/ui/column-filters";
import type { NgxDividendRow, NgxDividendsData } from "@/lib/markets/ngx-dividends";
import styles from "@/components/dividendes/DividendCalendar.module.css";
import local from "./NgxDividends.module.css";

const ALL_YEARS = "all";

function fmtDate(iso: string | null, date: (d: Date, o: Intl.DateTimeFormatOptions) => string): string {
  if (!iso) return "N/D";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "N/D";
  return date(new Date(Date.UTC(y, m - 1, d)), { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export default function NgxDividendsTable({
  data,
  sectorLabels,
}: {
  data: NgxDividendsData;
  /** slug → libellé traduit du secteur. */
  sectorLabels: Record<string, string>;
}) {
  const { t, format } = useI18n();
  const [year, setYear] = useState<string>(data.years[0] != null ? String(data.years[0]) : ALL_YEARS);
  const [sector, setSector] = useState("");
  const [query, setQuery] = useState("");
  const [colSort, setColSort] = useState<ColumnSortState | null>(null);

  const na = "N/D";
  const ngn = (v: number | null) => (v == null ? na : format.money(v, "NGN"));
  const pct = (v: number | null) => (v == null ? na : format.percent(v, 2));
  const date = (d: Date, o: Intl.DateTimeFormatOptions) => format.date(d, o);

  const colDefs = useMemo<ColumnFilterDef<NgxDividendRow>[]>(
    () => [
      { key: "ticker", label: t("ngx.dividends.columns.ticker"), sortKind: "text", getValue: (r) => r.ticker },
      { key: "name", label: t("ngx.dividends.columns.company"), sortKind: "text", getValue: (r) => r.name },
      { key: "sector", label: t("ngx.dividends.columns.sector"), sortKind: "text", getValue: (r) => sectorLabels[r.sectorSlug] ?? r.sectorName },
      { key: "year", label: t("ngx.dividends.columns.year"), sortKind: "number", getValue: (r) => String(r.year) },
      { key: "amount", label: t("ngx.dividends.columns.amount"), sortKind: "number", getValue: (r) => String(r.amount) },
      { key: "close", label: t("ngx.dividends.columns.price"), sortKind: "number", getValue: (r) => (r.close == null ? na : String(r.close)) },
      { key: "yield", label: t("ngx.dividends.columns.yield"), sortKind: "number", getValue: (r) => (r.yieldPercent == null ? na : String(r.yieldPercent)) },
      { key: "exDate", label: t("ngx.dividends.columns.exDate"), sortKind: "text", getValue: (r) => r.exDate ?? na },
      { key: "paymentDate", label: t("ngx.dividends.columns.payment"), sortKind: "text", getValue: (r) => r.paymentDate ?? na },
      { key: "source", label: t("ngx.dividends.columns.source"), sortKind: "text", getValue: (r) => r.source },
    ],
    [t, sectorLabels],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data.rows.filter((r) => {
      if (year !== ALL_YEARS && String(r.year) !== year) return false;
      if (sector && r.sectorSlug !== sector) return false;
      if (!q) return true;
      return r.ticker.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
    });
    if (colSort) return applyColumnSort(list, colDefs, colSort);
    // Tri par défaut : exercice récent d'abord, puis rendement décroissant (N/D en dernier), puis ticker.
    return [...list].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.yieldPercent == null && b.yieldPercent == null) return a.ticker.localeCompare(b.ticker, "fr");
      if (a.yieldPercent == null) return 1;
      if (b.yieldPercent == null) return -1;
      return b.yieldPercent - a.yieldPercent || a.ticker.localeCompare(b.ticker, "fr");
    });
  }, [data.rows, year, sector, query, colSort, colDefs]);

  const dated = filtered.filter((r) => r.exDate || r.paymentDate).length;

  return (
    <div className={styles.wrap} data-testid="ngx-dividends">
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <label className={styles.filterLabel}>
            {t("ngx.dividends.fiscalYear")}
            <select className={styles.control} value={year} onChange={(e) => setYear(e.target.value)}>
              <option value={ALL_YEARS}>{t("ngx.dividends.allYears")}</option>
              {data.years.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filterLabel}>
            {t("ngx.dividends.sector")}
            <select className={styles.control} value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="">{t("ngx.dividends.allSectors")}</option>
              {data.sectors.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {sectorLabels[s.slug] ?? s.name}
                </option>
              ))}
            </select>
          </label>
          <label className={`${styles.filterLabel} ${styles.filterGrow}`}>
            {t("ngx.dividends.search")}
            <input
              className={styles.control}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("ngx.dividends.searchPlaceholder")}
            />
          </label>
        </div>
      </div>

      <p className={styles.count}>
        {t(filtered.length > 1 ? "ngx.dividends.resultsMany" : "ngx.dividends.resultsOne", { count: filtered.length })}
        <span className={styles.countDim}>
          {" "}
          {t("ngx.dividends.countMeta", { dated, undated: filtered.length - dated })}
        </span>
      </p>

      <section className={styles.panel}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <ColumnFilterRow columns={colDefs} sort={colSort} onSortChange={setColSort} />
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={colDefs.length} className={styles.empty}>
                    {t("ngx.dividends.emptyRow")}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/marches/ngx/actions/${r.ticker}`} className={styles.tickerLink}>
                        {r.ticker}
                      </Link>
                    </td>
                    <td>
                      <span className={styles.coName}>{r.name}</span>
                    </td>
                    <td>{sectorLabels[r.sectorSlug] ?? r.sectorName}</td>
                    <td className={styles.mono}>{r.year}</td>
                    <td className={styles.amount}>{ngn(r.amount)}</td>
                    <td className={local.dim}>{ngn(r.close)}</td>
                    <td className={r.yieldPercent == null ? local.dim : local.yield}>{pct(r.yieldPercent)}</td>
                    <td className={styles.mono}>{fmtDate(r.exDate, date)}</td>
                    <td className={styles.mono}>{fmtDate(r.paymentDate, date)}</td>
                    <td className={styles.source}>{translateDataSourceLabel(r.source, t)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
