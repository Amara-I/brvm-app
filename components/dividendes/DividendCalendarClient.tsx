"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import ColumnFilterRow from "@/components/ui/ColumnFilterRow";
import { translateDataSourceLabel } from "@/components/marche/market-copy";
import {
  applyColumnSort,
  type ColumnFilterDef,
  type ColumnSortState,
} from "@/lib/ui/column-filters";
import type { DividendCalendarDataset, DividendCalendarEvent } from "@/lib/api/dividend-calendar";
import type { TFunc } from "@/lib/i18n/create-i18n";
import type { FormatApi } from "@/lib/i18n/format";
import styles from "./DividendCalendar.module.css";

const COOLDOWN_FR =
  "Actualisation récente — calendrier rechargé depuis la base (prochain tirage BRVM dans quelques minutes).";

function localizeStatus(msg: string, t: TFunc): string {
  if (msg === COOLDOWN_FR) return t("market.dividends.cooldown");
  return msg;
}

function fmtDateShort(iso: string | null, format: FormatApi): string {
  if (!iso) return "N/D";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "N/D";
  return format.date(new Date(Date.UTC(y, m - 1, d)), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtDateLong(iso: string, format: FormatApi): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "N/D";
  return format.date(new Date(Date.UTC(y, m - 1, d)), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function monthLabel(year: number, monthIndex: number, format: FormatApi): string {
  return format.date(new Date(Date.UTC(year, monthIndex, 1)), {
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
  const { t, format, labels } = useI18n();
  const colDefs = useMemo<ColumnFilterDef<DividendCalendarEvent>[]>(
    () => [
      { key: "ticker", label: t("market.columns.ticker"), sortKind: "text", getValue: (ev) => ev.ticker },
      { key: "name", label: t("market.columns.company"), sortKind: "text", getValue: (ev) => ev.name },
      { key: "sector", label: t("market.indices.col.sector"), sortKind: "text", getValue: (ev) => ev.sector },
      {
        key: "amount",
        label: t("market.dividends.col.amount"),
        sortKind: "number",
        getValue: (ev) => String(ev.amount),
      },
      {
        key: "exDate",
        label: t("market.dividends.col.exDate"),
        sortKind: "text",
        getValue: (ev) => ev.exDate ?? "N/D",
      },
      {
        key: "paymentDate",
        label: t("market.dividends.col.payment"),
        sortKind: "text",
        getValue: (ev) => ev.paymentDate ?? "N/D",
      },
      { key: "source", label: t("common.source"), sortKind: "text", getValue: (ev) => ev.source },
    ],
    [t]
  );
  const [colSort, setColSort] = useState<ColumnSortState | null>(null);
  const sorted = useMemo(() => applyColumnSort(rows, colDefs, colSort), [rows, colDefs, colSort]);

  if (rows.length === 0) {
    return <p className={styles.empty}>{t("market.dividends.empty")}</p>;
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
              <td>{labels.sector(ev.sector)}</td>
              <td className={styles.amount}>{format.fcfa(Math.round(ev.amount))}</td>
              <td>{fmtDateShort(ev.exDate, format)}</td>
              <td>{fmtDateShort(ev.paymentDate, format)}</td>
              <td className={styles.source}>{translateDataSourceLabel(ev.source, t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DividendCalendarClient({ data: initialData }: { data: DividendCalendarDataset }) {
  const { t, format, labels } = useI18n();
  const weekdays = [
    t("market.dividends.weekdays.mon"),
    t("market.dividends.weekdays.tue"),
    t("market.dividends.weekdays.wed"),
    t("market.dividends.weekdays.thu"),
    t("market.dividends.weekdays.fri"),
    t("market.dividends.weekdays.sat"),
    t("market.dividends.weekdays.sun"),
  ];
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
        if (ing?.skipped && ing.skipReason) setStatusMsg(localizeStatus(String(ing.skipReason), t));
        else if (ing?.errors?.length) setStatusMsg(String(ing.errors[0]));
        else if (ing?.brvm?.ok) {
          setStatusMsg(
            t("market.dividends.refreshed", {
              rows: ing.brvm.rows,
              dates: json.data.calendar.datedCount,
            })
          );
        }
      } else {
        const raw = json.error?.message as string | undefined;
        setStatusMsg(raw ? localizeStatus(raw, t) : t("market.dividends.refreshFailed"));
      }
    } catch {
      setStatusMsg(t("market.dividends.networkError"));
    } finally {
      setRefreshing(false);
    }
  }

  const now = new Date();
  const todayIso = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  const calendarYears = data.calendarYears?.length > 0 ? data.calendarYears : data.years;
  const defaultYear = calendarYears.find((y) => y === now.getFullYear()) ?? calendarYears[0] ?? now.getFullYear();

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
    return filtered.filter((ev) => ev.year === viewYear).sort((a, b) => a.ticker.localeCompare(b.ticker, "fr"));
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

  const monthName = monthLabel(viewYear, viewMonth, format);

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarTop}>
          <div className={styles.tabs} role="tablist" aria-label={t("market.dividends.modeAria")}>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "liste"}
              className={mode === "liste" ? styles.tabActive : styles.tab}
              onClick={() => setMode("liste")}
            >
              {t("market.dividends.byYear")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "avenir"}
              className={mode === "avenir" ? styles.tabActive : styles.tab}
              onClick={() => setMode("avenir")}
            >
              {t("market.dividends.upcoming")}
              {data.upcomingCount > 0 ? ` (${data.upcomingCount})` : ""}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "mois"}
              className={mode === "mois" ? styles.tabActive : styles.tab}
              onClick={() => setMode("mois")}
            >
              {t("market.dividends.monthly")}
            </button>
          </div>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            title={t("market.dividends.refreshTitle")}
          >
            {refreshing ? t("market.dividends.refreshing") : t("market.dividends.refresh")}
          </button>
        </div>

        <div className={styles.filters}>
          {mode !== "avenir" ? (
            <label className={styles.filterLabel}>
              {mode === "mois" ? t("market.dividends.calendarYear") : t("market.dividends.fiscalYear")}
              <select
                className={styles.control}
                value={viewYear}
                onChange={(e) => {
                  setViewYear(Number(e.target.value));
                  setSelectedDay(null);
                }}
              >
                {(mode === "mois" ? calendarYears : data.years.length > 0 ? data.years : [viewYear]).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className={styles.filterLabel}>
            {t("market.dividends.sector")}
            <select className={styles.control} value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="Tous">{t("market.all")}</option>
              {data.sectors.map((s) => (
                <option key={s} value={s}>
                  {labels.sector(s)}
                </option>
              ))}
            </select>
          </label>
          <label className={`${styles.filterLabel} ${styles.filterGrow}`}>
            {t("market.dividends.search")}
            <input
              className={styles.control}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("market.dividends.searchPlaceholder")}
            />
          </label>
        </div>
      </div>

      {statusMsg ? <p className={styles.statusMsg}>{statusMsg}</p> : null}

      <p className={styles.count}>
        {mode === "liste"
          ? t(listForYear.length > 1 ? "market.dividends.listMany" : "market.dividends.listOne", {
              count: listForYear.length,
              year: viewYear,
            })
          : mode === "avenir"
            ? t(upcomingRows.length > 1 ? "market.dividends.upcomingMany" : "market.dividends.upcomingOne", {
                count: upcomingRows.length,
              })
            : t(monthRows.length > 1 ? "market.dividends.monthMany" : "market.dividends.monthOne", {
                count: monthRows.length,
                month: monthName,
              })}
        <span className={styles.countDim}>
          {" "}
          {t("market.dividends.countMeta", {
            dated: data.datedCount,
            undated: data.exerciceOnlyCount,
          })}
        </span>
      </p>

      {mode === "liste" ? (
        <section className={styles.panel} aria-label={t("market.dividends.yearPanel", { year: viewYear })}>
          <EventsTable rows={listForYear} />
        </section>
      ) : mode === "avenir" ? (
        <section className={styles.panel} aria-label={t("market.dividends.upcomingPanel")}>
          <EventsTable rows={upcomingRows} />
        </section>
      ) : (
        <div className={styles.monthLayout}>
          <section className={styles.panel} aria-label={t("market.dividends.monthPanel")}>
            <div className={styles.monthBar}>
              <button
                type="button"
                className={styles.monthBtn}
                onClick={() => shiftMonth(-1)}
                aria-label={t("market.dividends.prevMonthAria")}
              >
                {t("market.dividends.prevMonth")}
              </button>
              <h2 className={styles.monthHeading}>{monthName}</h2>
              <button
                type="button"
                className={styles.monthBtn}
                onClick={() => shiftMonth(1)}
                aria-label={t("market.dividends.nextMonthAria")}
              >
                {t("market.dividends.nextMonth")}
              </button>
            </div>

            <div className={styles.calHead}>
              {weekdays.map((d) => (
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

          <section className={styles.panel} aria-label={t("market.dividends.detailPanel")}>
            <h3 className={styles.detailTitle}>
              {selectedDay
                ? fmtDateLong(selectedDay, format)
                : t("market.dividends.allMonth", { month: monthName })}
            </h3>
            <EventsTable rows={selectedDay ? dayRows : monthRows} />
            {selectedDay ? (
              <button type="button" className={styles.clearDay} onClick={() => setSelectedDay(null)}>
                {t("market.dividends.showMonth")}
              </button>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
