"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ChangeValue from "@/components/ui/ChangeValue";
import { scoreBand, type NgxScoreBand, type NgxScoreMode } from "@/lib/ngx/score";
import { nextNgxOverviewSort, sortNgxOverview, type NgxOverviewSort, type NgxOverviewSortKey as SortKey } from "@/lib/markets/ngx-overview-sort";
import MarketSparkline from "@/components/marche/MarketSparkline";
import styles from "./NgxMarket.module.css";
import local from "./NgxScreener.module.css";

const BAND_CLASS: Record<NgxScoreBand, string> = {
  HIGH: local.pillHigh,
  GOOD: local.pillGood,
  MIXED: local.pillMixed,
  LOW: local.pillLow,
};


export interface NgxShareTableRow {
  ticker: string;
  name: string;
  sectorSlug: string;
  sectorLabel: string;
  boardLabel: string;
  closeLabel: string;
  fcfaLabel: string;
  changePercent: number | null;
  /** Performance sur 1 an (cours ajusté), null = N/D. */
  return1yPercent: number | null;
  /** Aperçu 1 an : clôtures ajustées (≈48 points), [] = N/D. */
  spark: number[];
  /** Note globale /100 (même calcul que le screener et la fiche), null = N/D. */
  score: number | null;
  scoreMode: NgxScoreMode | null;
}

export default function NgxShareTable({
  rows,
  sectors,
  labels,
}: {
  rows: NgxShareTableRow[];
  sectors: { slug: string; label: string; count: number }[];
  labels: {
    all: string;
    searchPlaceholder: string;
    searchAria: string;
    sectorsTitle: string;
    colTicker: string;
    colName: string;
    colSector: string;
    colBoard: string;
    colPrice: string;
    colChange: string;
    colChange1y: string;
    colScore: string;
    colSpark: string;
    colSparkTitle: string;
    colChangeTitle: string;
    colChange1yTitle: string;
    colScoreTitle: string;
    tagChartOnly: string;
    tagChartOnlyTitle: string;
    tagPartial: string;
    tagPartialTitle: string;
    colFcfa: string;
    empty: string;
  };
}) {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [sort, setSort] = useState<NgxOverviewSort>(null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((row) => {
      if (sector && row.sectorSlug !== sector) return false;
      if (!q) return true;
      return row.ticker.toLowerCase().includes(q) || row.name.toLowerCase().includes(q);
    });
    return sortNgxOverview(list, sort);
  }, [query, rows, sector, sort]);

  const toggleSort = (key: SortKey) => setSort((current) => nextNgxOverviewSort(current, key));

  const sortHead = (key: SortKey, label: string, title?: string) => {
    const active = sort?.key === key ? sort.dir : null;
    return (
      <th scope="col" aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"} title={title}>
        <button type="button" className={styles.sortBtn} onClick={() => toggleSort(key)} data-testid={`ngx-sort-${key}`}>
          {label}
          <span aria-hidden="true" className={styles.sortArrow}>
            {active === "asc" ? "▲" : active === "desc" ? "▼" : "↕"}
          </span>
        </button>
      </th>
    );
  };

  return (
    <>
      <h2 className={styles.sectionTitle}>{labels.sectorsTitle}</h2>
      <div className={styles.chips} role="group" aria-label={labels.sectorsTitle}>
        <button type="button" className={sector === "" ? `${styles.chip} ${styles.chipOn}` : styles.chip} onClick={() => setSector("")}>
          {labels.all}
        </button>
        {sectors.map((item) => (
          <button
            key={item.slug}
            type="button"
            className={sector === item.slug ? `${styles.chip} ${styles.chipOn}` : styles.chip}
            onClick={() => setSector(item.slug)}
          >
            {item.label} · {item.count}
          </button>
        ))}
      </div>
      <input
        className={styles.search}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={labels.searchPlaceholder}
        aria-label={labels.searchAria}
      />
      {filtered.length === 0 ? (
        <p className={styles.note}>{labels.empty}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className="ob-table">
            <thead>
              <tr>
                {sortHead("ticker", labels.colTicker)}
                <th scope="col">{labels.colName}</th>
                <th scope="col">{labels.colSector}</th>
                <th scope="col">{labels.colBoard}</th>
                <th scope="col">{labels.colPrice}</th>
                {sortHead("change", labels.colChange, labels.colChangeTitle)}
                {sortHead("change1y", labels.colChange1y, labels.colChange1yTitle)}
                <th scope="col" title={labels.colSparkTitle}>
                  {labels.colSpark}
                </th>
                {sortHead("score", labels.colScore, labels.colScoreTitle)}
                <th scope="col">{labels.colFcfa}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.ticker}>
                  <td>
                    <Link href={`/marches/ngx/actions/${row.ticker}`}>{row.ticker}</Link>
                  </td>
                  <td>{row.name}</td>
                  <td>{row.sectorLabel}</td>
                  <td>{row.boardLabel}</td>
                  <td className={styles.price}>{row.closeLabel}</td>
                  <td>
                    <ChangeValue value={row.changePercent} />
                  </td>
                  <td data-testid={`ngx-1y-${row.ticker}`}>
                    <ChangeValue value={row.return1yPercent} digits={1} />
                  </td>
                  <td data-testid={`ngx-spark-${row.ticker}`}>
                    <div className={styles.sparkCell} title={labels.colSparkTitle}>
                      {row.spark.length >= 2 ? (
                        <MarketSparkline values={row.spark} width={120} height={32} />
                      ) : (
                        <span className="ob-nd">N/D</span>
                      )}
                    </div>
                  </td>
                  <td data-testid={`ngx-score-${row.ticker}`}>
                    {row.score == null ? (
                      <span className="ob-nd">N/D</span>
                    ) : (
                      <span className={local.scoreCell}>
                        <span className={`${local.pill} ${BAND_CLASS[scoreBand(row.score) ?? "MIXED"]}`}>{Math.round(row.score)}</span>
                        {row.scoreMode === "CHART_ONLY" ? (
                          <span className={local.tag} title={labels.tagChartOnlyTitle}>
                            {labels.tagChartOnly}
                          </span>
                        ) : row.scoreMode === "PARTIAL" ? (
                          <span className={local.tag} title={labels.tagPartialTitle}>
                            {labels.tagPartial}
                          </span>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td className={styles.price}>{row.fcfaLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
