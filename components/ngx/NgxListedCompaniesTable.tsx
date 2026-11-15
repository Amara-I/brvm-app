"use client";

// Annuaire NGX : même coque que les dividendes / le screener (recherche, filtre secteur, tri des colonnes).
// Les données viennent de lib/markets/ngx-listed-companies.ts (aucun calcul de cours ici).

import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import ChangeValue from "@/components/ui/ChangeValue";
import ColumnFilterRow from "@/components/ui/ColumnFilterRow";
import CompanyMark from "@/components/ui/CompanyMark";
import { applyColumnSort, type ColumnFilterDef, type ColumnSortState } from "@/lib/ui/column-filters";
import { filterNgxListedRows, type NgxListedCompanyRow, type NgxListedSectorCount } from "@/lib/markets/ngx-listed-companies-core";
import { keepNumbersTogether } from "@/lib/text/no-break";
import styles from "@/components/dividendes/DividendCalendar.module.css";
import local from "./NgxListedCompanies.module.css";

export type NgxListedCompaniesTableRow = NgxListedCompanyRow & { sectorLabel: string };

export default function NgxListedCompaniesTable({
  rows,
  sectors,
  sectorLabels,
}: {
  rows: NgxListedCompaniesTableRow[];
  sectors: NgxListedSectorCount[];
  sectorLabels: Record<string, string>;
}) {
  const { t, format } = useI18n();
  const [sector, setSector] = useState("");
  const [query, setQuery] = useState("");
  const [colSort, setColSort] = useState<ColumnSortState | null>(null);

  const na = t("common.nd");
  const price = (v: number | null) => (v == null ? na : keepNumbersTogether(format.money(v, "NGN")));
  const cap = (v: number | null) =>
    v == null || !(v > 0)
      ? na
      : keepNumbersTogether(t("market.capCurrency", { amount: format.number(v), currency: "₦" }));

  const colDefs = useMemo<ColumnFilterDef<NgxListedCompaniesTableRow>[]>(
    () => [
      { key: "ticker", label: t("ngx.listed.columns.ticker"), sortKind: "text", getValue: (r) => r.ticker },
      { key: "name", label: t("ngx.listed.columns.company"), sortKind: "text", getValue: (r) => r.name },
      { key: "sector", label: t("ngx.listed.columns.sector"), sortKind: "text", getValue: (r) => r.sectorLabel },
      { key: "price", label: t("ngx.listed.columns.price"), sortKind: "number", getValue: (r) => (r.close == null ? na : String(r.close)) },
      {
        key: "change",
        label: t("ngx.listed.columns.change"),
        sortKind: "number",
        getValue: (r) => (r.changePercent == null ? na : String(r.changePercent)),
      },
      {
        key: "mktCap",
        label: t("ngx.listed.columns.mktCap"),
        sortKind: "number",
        getValue: (r) => (r.marketCapBn == null || !(r.marketCapBn > 0) ? na : String(r.marketCapBn)),
      },
    ],
    [t, na],
  );

  const filtered = useMemo(() => {
    const list = filterNgxListedRows(rows, query, sector) as NgxListedCompaniesTableRow[];
    if (colSort) return applyColumnSort(list, colDefs, colSort);
    return [...list].sort((a, b) => a.ticker.localeCompare(b.ticker, "fr"));
  }, [rows, query, sector, colSort, colDefs]);

  return (
    <div className={styles.wrap} data-testid="ngx-listed-companies">
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <label className={styles.filterLabel}>
            {t("ngx.listed.sector")}
            <select className={styles.control} value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="">{t("ngx.listed.allSectors")}</option>
              {sectors.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {sectorLabels[s.slug] ?? s.name} ({s.count})
                </option>
              ))}
            </select>
          </label>
          <label className={`${styles.filterLabel} ${styles.filterGrow}`}>
            {t("ngx.listed.search")}
            <input
              className={styles.control}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("ngx.listed.searchPlaceholder")}
              aria-label={t("ngx.listed.search")}
            />
          </label>
        </div>
      </div>

      <p className={styles.count}>
        {t(filtered.length > 1 ? "ngx.listed.resultsMany" : "ngx.listed.resultsOne", { count: filtered.length })}
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
                    {t("ngx.listed.emptyRow")}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const href = `/marches/ngx/actions/${encodeURIComponent(r.ticker)}`;
                  return (
                    <tr key={r.ticker}>
                      <td>
                        <Link href={href} className={`${styles.tickerLink} ${local.rowLink}`}>
                          <span className="ob-ticker-with-mark">
                            <CompanyMark ticker={r.ticker} name={r.name} size={24} market="NGX" />
                            <span className={local.ticker}>{r.ticker}</span>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <Link href={href} className={local.rowLink}>
                          <span className={local.coName}>{r.name}</span>
                        </Link>
                      </td>
                      <td>{r.sectorLabel}</td>
                      <td className={local.num}>{price(r.close)}</td>
                      <td className={local.num}>
                        <ChangeValue value={r.changePercent} />
                      </td>
                      <td className={local.num}>{cap(r.marketCapBn)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
