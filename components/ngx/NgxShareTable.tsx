"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ChangeValue from "@/components/ui/ChangeValue";
import styles from "./NgxMarket.module.css";

export interface NgxShareTableRow {
  ticker: string;
  name: string;
  sectorSlug: string;
  sectorLabel: string;
  boardLabel: string;
  closeLabel: string;
  fcfaLabel: string;
  changePercent: number | null;
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
    colFcfa: string;
    empty: string;
  };
}) {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (sector && row.sectorSlug !== sector) return false;
      if (!q) return true;
      return row.ticker.toLowerCase().includes(q) || row.name.toLowerCase().includes(q);
    });
  }, [query, rows, sector]);

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
                <th scope="col">{labels.colTicker}</th>
                <th scope="col">{labels.colName}</th>
                <th scope="col">{labels.colSector}</th>
                <th scope="col">{labels.colBoard}</th>
                <th scope="col">{labels.colPrice}</th>
                <th scope="col">{labels.colChange}</th>
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
