"use client";

// Annuaire NGX par catégories, comme l'annuaire BRVM : sommaire, sections avec effectif,
// et filtre ?secteur= pour le sous-menu. Les cours viennent de lib/markets/ngx-listed-companies.ts.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import ChangeValue from "@/components/ui/ChangeValue";
import ColumnFilterRow from "@/components/ui/ColumnFilterRow";
import CompanyMark from "@/components/ui/CompanyMark";
import { ngxSectorGroupLabel } from "@/components/ngx/ngx-labels";
import { applyColumnSort, type ColumnFilterDef, type ColumnSortState } from "@/lib/ui/column-filters";
import {
  filterNgxListedRows,
  groupNgxListedRows,
  type NgxListedCompanyRow,
  type NgxListedSectorCount,
} from "@/lib/markets/ngx-listed-companies-core";
import { keepNumbersTogether } from "@/lib/text/no-break";
import styles from "@/components/dividendes/DividendCalendar.module.css";
import local from "./NgxListedCompanies.module.css";

const LISTED_PATH = "/marches/ngx/societes";

export type NgxListedCompaniesTableRow = NgxListedCompanyRow & { sectorLabel: string };

export default function NgxListedCompaniesTable({
  rows,
  sectors,
  initialSector = "",
}: {
  rows: NgxListedCompaniesTableRow[];
  sectors: NgxListedSectorCount[];
  sectorLabels?: Record<string, string>;
  initialSector?: string;
}) {
  const { t, format } = useI18n();
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
    const list = filterNgxListedRows(rows, query, initialSector) as NgxListedCompaniesTableRow[];
    if (colSort) return applyColumnSort(list, colDefs, colSort);
    return [...list].sort((a, b) => a.ticker.localeCompare(b.ticker, "fr"));
  }, [rows, query, initialSector, colSort, colDefs]);

  const sections = useMemo(() => groupNgxListedRows(filtered), [filtered]);
  const filteredByCategory = Boolean(initialSector);

  function capLabel(list: readonly NgxListedCompanyRow[]): string {
    const caps = list
      .map((row) => row.marketCapBn)
      .filter((value): value is number => value != null && Number.isFinite(value) && value > 0);
    if (caps.length === 0) return t("ngx.listed.capReportedNd");
    const total = caps.reduce((sum, value) => sum + value, 0);
    return t("ngx.listed.capReported", {
      amount: keepNumbersTogether(t("market.capCurrency", { amount: format.number(total), currency: "₦" })),
      withCap: format.integer(caps.length),
      total: format.integer(list.length),
    });
  }

  return (
    <div className={styles.wrap} data-testid="ngx-listed-companies">
      <div className={styles.toolbar}>
        <div className={styles.filters}>
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

      <nav className={local.toc} aria-label={t("ngx.listed.tocAria")}>
        <div className={local.tocLabel}>{t("ngx.listed.tocLabel")}</div>
        {filteredByCategory ? (
          <Link href={LISTED_PATH} className={local.tocLink}>
            {t("ngx.listed.allCategories")}
          </Link>
        ) : null}
        {sectors.map((s) => {
          const href = filteredByCategory ? `${LISTED_PATH}?secteur=${encodeURIComponent(s.slug)}` : `#secteur-${s.slug}`;
          const active = initialSector === s.slug;
          return (
            <Link key={s.slug} href={href} className={`${local.tocLink} ${active ? local.tocLinkActive : ""}`}>
              {ngxSectorGroupLabel(s.group, t)} ({s.count})
            </Link>
          );
        })}
      </nav>

      <p className={styles.count}>
        {t(filtered.length > 1 ? "ngx.listed.resultsMany" : "ngx.listed.resultsOne", { count: filtered.length })}
      </p>

      {filteredByCategory ? (
        <Link href={LISTED_PATH} className={local.filterAll}>
          ← {t("ngx.listed.allCategories")}
        </Link>
      ) : null}

      {sections.length === 0 ? (
        <section className={styles.panel}>
          <p className={styles.empty}>{t("ngx.listed.emptyRow")}</p>
        </section>
      ) : (
        sections.map((section) => (
          <section
            key={section.slug}
            id={`secteur-${section.slug}`}
            className={local.section}
            aria-labelledby={`h-${section.slug}`}
          >
            <div className={local.sectionHead}>
              <h2 id={`h-${section.slug}`} className={local.sectionTitle}>
                {ngxSectorGroupLabel(section.group, t)}{" "}
                <span className={local.sectionCount}>({section.rows.length})</span>
              </h2>
              <div className={local.sectionStats}>{capLabel(section.rows)}</div>
            </div>
            <p className={local.sectionBlurb}>{t(`ngx.listed.categoriesBlurb.${section.slug}`)}</p>
            <section className={styles.panel}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <ColumnFilterRow columns={colDefs} sort={colSort} onSortChange={setColSort} />
                  </thead>
                  <tbody>
                    {section.rows.map((r) => {
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
                          <td className={local.num}>{price(r.close)}</td>
                          <td className={local.num}>
                            <ChangeValue value={r.changePercent} />
                          </td>
                          <td className={local.num}>{cap(r.marketCapBn)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        ))
      )}
    </div>
  );
}
