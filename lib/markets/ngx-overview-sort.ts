// Tri de la liste « vue d'ensemble » NGX : N/D toujours en dernier, quel que soit le sens.

export type NgxOverviewSortKey = "ticker" | "change" | "change1y" | "score";
export type NgxOverviewSort = { key: NgxOverviewSortKey; dir: "asc" | "desc" } | null;

export interface NgxOverviewSortable {
  ticker: string;
  changePercent: number | null;
  return1yPercent: number | null;
  score: number | null;
}

export function sortNgxOverview<T extends NgxOverviewSortable>(rows: T[], sort: NgxOverviewSort): T[] {
  if (!sort) return rows;
  const factor = sort.dir === "asc" ? 1 : -1;
  const valueOf = (row: T): number | string | null =>
    sort.key === "ticker"
      ? row.ticker
      : sort.key === "change"
        ? row.changePercent
        : sort.key === "change1y"
          ? row.return1yPercent
          : row.score;
  return [...rows].sort((a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    if (va == null && vb == null) return a.ticker.localeCompare(b.ticker);
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "string" || typeof vb === "string") return String(va).localeCompare(String(vb)) * factor;
    return (va - vb) * factor || a.ticker.localeCompare(b.ticker);
  });
}

/** Premier clic : plus grand d'abord (A→Z pour le ticker) ; second : sens inverse ; troisième : ordre d'origine. */
export function nextNgxOverviewSort(current: NgxOverviewSort, key: NgxOverviewSortKey): NgxOverviewSort {
  const first = key === "ticker" ? "asc" : "desc";
  if (!current || current.key !== key) return { key, dir: first };
  return current.dir === first ? { key, dir: first === "asc" ? "desc" : "asc" } : null;
}
