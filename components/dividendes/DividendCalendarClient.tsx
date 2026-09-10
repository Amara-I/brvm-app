"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ColumnFilterRow from "@/components/ui/ColumnFilterRow";
import {
  applyColumnSort,
  type ColumnFilterDef,
  type ColumnSortState,
} from "@/lib/ui/column-filters";
import type { DividendCalendarDataset, DividendCalendarEvent } from "@/lib/api/dividend-calendar";
import styles from "./DividendCalendar.module.css";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function buildColDefs(): ColumnFilterDef<DividendCalendarEvent>[] {
  return [
    { key: "ticker", label: "Ticker", sortKind: "text", getValue: (ev) => ev.ticker },
    { key: "name", label: "Société", sortKind: "text", getValue: (ev) => ev.name },
    { key: "sector", label: "Secteur", sortKind: "text", getValue: (ev) => ev.sector },
    {
      key: "amount",
      label: "Montant / action",
      sortKind: "number",
      getValue: (ev) => String(ev.amount),
    },
    {
      key: "exDate",
      label: "Détachement",
      sortKind: "text",
      getValue: (ev) => ev.exDate ?? "N/D",
    },
    {
      key: "paymentDate",
      label: "Paiement",
      sortKind: "text",
      getValue: (ev) => ev.paymentDate ?? "N/D",
    },
    { key: "source", label: "Source", sortKind: "text", getValue: (ev) => ev.source },
  ];
}

function fmtAmount(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

function fmtDateShort(iso: string | null): string {
  if (!iso) return "N/D";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "N/D";
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "N/D";
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function monthLabel(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildMonthCells(year: number, monthIndex: number): Array<{ day: number | null; iso: string | null }> {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const startPad = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: Array<{ day: number | null; iso: string | null }> = [];
  for (let i = 0; i < startPad; i++) cells.push({ day: null, iso: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, iso });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, iso: null });
  return cells;
}

function EventsTable({ rows }: { rows: DividendCalendarEvent[] }) {
  const colDefs = useMemo(() => buildColDefs(), []);
  const [colSort, setColSort] = useState<ColumnSortState | null>(null);
  const sorted = useMemo(
    () => applyColumnSort(rows, colDefs, colSort),
    [rows, colDefs, colSort]
  );

  if (rows.length === 0) {
    return <p className={styles.empty}>Aucun dividende pour cette sélection.</p>;
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <ColumnFilterRow columns={colDefs} sort={colSort} onSortChange={setColSort} />
        </thead>
        <tbody>
          {sorted.map((ev) => (
            <tr key={ev.id}>
              <td>
                <Link href={`/actions/${ev.ticker}`} className={styles.tickerLink}>
                  {ev.ticker}
                </Link>
              </td>
              <td>
                <span className={styles.coName}>
                  {ev.countryFlag ? `${ev.countryFlag} ` : ""}
                  {ev.name}
                </span>
              </td>
              <td>{ev.sector}</td>
              <td className={styles.amount}>{fmtAmount(ev.amount)}</td>
              <td>{fmtDateShort(ev.exDate)}</td>
              <td>{fmtDateShort(ev.paymentDate)}</td>
              <td className={styles.source}>{ev.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DividendCalendarClient({ data: initialData }: { data: DividendCalendarDataset }) {
  const [data, setData] = useState(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const reloadFromApi = useCallback(async () => {
    const res = await fetch("/api/market/dividends", { cache: "no-store" });
    const json = await res.json();
    if (json.ok && json.data) setData(json.data as DividendCalendarDataset);
  }, []);

  useEffect(() => {
    void reloadFromApi();
  }, [reloadFromApi]);

  async function handleRefresh() {
    setRefreshing(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/market/refresh-dividends", { method: "POST", cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data?.calendar) {
        setData(json.data.calendar as DividendCalendarDataset);
        const ing = json.data.ingestion;
        if (ing?.skipped && ing.skipReason) setStatusMsg(ing.skipReason);
        else if (ing?.errors?.length) setStatusMsg(ing.errors[0]);
        else if (ing?.brvm?.ok) {
          setStatusMsg(
            `Calendrier actualisé — ${ing.brvm.rows} ligne(s) BRVM · ${json.data.calendar.datedCount} date(s) connue(s).`
          );
        }
      } else {
        setStatusMsg(json.error?.message ?? "Actualisation impossible.");
      }
    } catch {
      setStatusMsg("Erreur réseau lors de l'actualisation.");
    } finally {
      setRefreshing(false);
    }
  }

  const now = new Date();
  const todayIso = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  const calendarYears =
    data.calendarYears?.length > 0 ? data.calendarYears : data.years;
  const defaultYear =
    calendarYears.find((y) => y === now.getFullYear()) ?? calendarYears[0] ?? now.getFullYear();

  // Décembre : ancrage des dividendes sans date précise (exercice)
  const initialMonth = data.datedCount > 0 ? now.getMonth() : 11;

  const [viewYear, setViewYear] = useState(defaultYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [sector, setSector] = useState("Tous");
  const [query, setQuery] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [mode, setMode] = useState<"liste" | "mois" | "avenir">("liste");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.events.filter((ev) => {
      if (sector !== "Tous" && ev.sector !== sector) return false;
      if (q && !ev.ticker.toLowerCase().includes(q) && !ev.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [data.events, sector, query]);

  const byDay = useMemo(() => {
    const map = new Map<string, DividendCalendarEvent[]>();
    for (const ev of filtered) {
      if (!ev.displayDate.startsWith(`${viewYear}-`)) continue;
      const list = map.get(ev.displayDate) ?? [];
      list.push(ev);
      map.set(ev.displayDate, list);
    }
    return map;
  }, [filtered, viewYear]);

  const monthCells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewYear, viewMonth]);

  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
  const monthRows = useMemo(
    () =>
      filtered
        .filter((ev) => ev.displayDate.startsWith(monthPrefix))
        .sort((a, b) => a.displayDate.localeCompare(b.displayDate) || a.ticker.localeCompare(b.ticker, "fr")),
    [filtered, monthPrefix]
  );

  const dayRows = selectedDay ? byDay.get(selectedDay) ?? [] : [];

  const listForYear = useMemo(() => {
    return filtered
      .filter((ev) => ev.year === viewYear)
      .sort((a, b) => a.ticker.localeCompare(b.ticker, "fr"));
  }, [filtered, viewYear]);

  const upcomingRows = useMemo(() => {
    return filtered
      .filter((ev) => ev.precision !== "exercice" && ev.displayDate >= todayIso)
      .sort((a, b) => a.displayDate.localeCompare(b.displayDate) || a.ticker.localeCompare(b.ticker, "fr"));
  }, [filtered, todayIso]);

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    setViewYear(d.getUTCFullYear());
    setViewMonth(d.getUTCMonth());
    setSelectedDay(null);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarTop}>
          <div className={styles.tabs} role="tablist" aria-label="Mode d'affichage">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "liste"}
            className={mode === "liste" ? styles.tabActive : styles.tab}
            onClick={() => setMode("liste")}
          >
            Liste par exercice
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "avenir"}
            className={mode === "avenir" ? styles.tabActive : styles.tab}
            onClick={() => setMode("avenir")}
          >
            À venir{data.upcomingCount > 0 ? ` (${data.upcomingCount})` : ""}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "mois"}
            className={mode === "mois" ? styles.tabActive : styles.tab}
            onClick={() => setMode("mois")}
          >
            Vue mensuelle
          </button>
          </div>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            title="Actualiser depuis BRVM.org et Sikafinance"
          >
            {refreshing ? "⟳ Actualisation..." : "⟳ Actualiser le calendrier"}
          </button>
        </div>

        <div className={styles.filters}>
          {mode !== "avenir" ? (
            <label className={styles.filterLabel}>
              {mode === "mois" ? "Année calendaire" : "Exercice"}
              <select
                className={styles.control}
                value={viewYear}
                onChange={(e) => {
                  setViewYear(Number(e.target.value));
                  setSelectedDay(null);
                }}
              >
                {(mode === "mois" ? calendarYears : data.years.length > 0 ? data.years : [viewYear]).map(
                  (y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  )
                )}
              </select>
            </label>
          ) : null}
          <label className={styles.filterLabel}>
            Secteur
            <select className={styles.control} value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="Tous">Tous</option>
              {data.sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className={`${styles.filterLabel} ${styles.filterGrow}`}>
            Recherche
            <input
              className={styles.control}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ticker ou nom"
            />
          </label>
        </div>
      </div>

      {statusMsg ? <p className={styles.statusMsg}>{statusMsg}</p> : null}

      <p className={styles.count}>
        {mode === "liste"
          ? `${listForYear.length} ligne${listForYear.length > 1 ? "s" : ""} — exercice ${viewYear}`
          : mode === "avenir"
            ? `${upcomingRows.length} dividende${upcomingRows.length > 1 ? "s" : ""} à venir`
          : `${monthRows.length} dividende${monthRows.length > 1 ? "s" : ""} — ${monthLabel(viewYear, viewMonth)}`}
        <span className={styles.countDim}>
          {" "}
          · {data.datedCount} date(s) connue(s) · {data.exerciceOnlyCount} sans date (N/D)
        </span>
      </p>

      {mode === "liste" ? (
        <section className={styles.panel} aria-label={`Dividendes exercice ${viewYear}`}>
          <EventsTable rows={listForYear} />
        </section>
      ) : mode === "avenir" ? (
        <section className={styles.panel} aria-label="Dividendes à venir">
          <EventsTable rows={upcomingRows} />
        </section>
      ) : (
        <div className={styles.monthLayout}>
          <section className={styles.panel} aria-label="Calendrier mensuel">
            <div className={styles.monthBar}>
              <button type="button" className={styles.monthBtn} onClick={() => shiftMonth(-1)} aria-label="Mois précédent">
                Préc.
              </button>
              <h2 className={styles.monthHeading}>{monthLabel(viewYear, viewMonth)}</h2>
              <button type="button" className={styles.monthBtn} onClick={() => shiftMonth(1)} aria-label="Mois suivant">
                Suiv.
              </button>
            </div>

            <div className={styles.calHead}>
              {WEEKDAYS.map((d) => (
                <div key={d} className={styles.calHeadCell}>
                  {d}
                </div>
              ))}
            </div>
            <div className={styles.calGrid}>
              {monthCells.map((cell, idx) => {
                if (!cell.iso || cell.day == null) {
                  return <div key={`e-${idx}`} className={styles.calPad} />;
                }
                const events = byDay.get(cell.iso) ?? [];
                const active = selectedDay === cell.iso;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    className={`${styles.calCell} ${active ? styles.calCellOn : ""}`}
                    onClick={() => setSelectedDay(cell.iso)}
                  >
                    <span className={styles.calNum}>{cell.day}</span>
                    {events.length > 0 ? (
                      <span className={styles.calTickers}>
                        {events
                          .slice(0, 3)
                          .map((e) => e.ticker)
                          .join(" · ")}
                        {events.length > 3 ? ` +${events.length - 3}` : ""}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className={styles.panel} aria-label="Détail du jour ou du mois">
            <h3 className={styles.detailTitle}>
              {selectedDay ? fmtDateLong(selectedDay) : `Tous les dividendes — ${monthLabel(viewYear, viewMonth)}`}
            </h3>
            <EventsTable rows={selectedDay ? dayRows : monthRows} />
            {selectedDay ? (
              <button type="button" className={styles.clearDay} onClick={() => setSelectedDay(null)}>
                Afficher tout le mois
              </button>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
