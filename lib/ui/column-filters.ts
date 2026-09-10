// Tri + filtrage optionnel pour tableaux multi-colonnes.

export type ColumnSortDir = "asc" | "desc" | "alpha-asc" | "alpha-desc";

export interface ColumnSortState {
  key: string;
  dir: ColumnSortDir;
}

export interface ColumnFilterDef<T> {
  key: string;
  label: string;
  /** Valeur affichée / triée / filtrée. */
  getValue: (row: T) => string;
  /** Colonne sans contrôle (ex. aperçu graphique). */
  skip?: boolean;
  /** Forcer un type de tri : auto détecte le numérique si possible. */
  sortKind?: "auto" | "text" | "number";
}

export function emptyColumnFilters(defs: Array<{ key: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of defs) out[d.key] = "";
  return out;
}

export function applyColumnFilters<T>(
  rows: T[],
  defs: Array<ColumnFilterDef<T>>,
  filters: Record<string, string>
): T[] {
  const active = defs.filter((d) => !d.skip && (filters[d.key] ?? "").trim() !== "");
  if (active.length === 0) return rows;
  return rows.filter((row) =>
    active.every((d) => {
      const q = (filters[d.key] ?? "").trim().toLowerCase();
      return d.getValue(row).toLowerCase().includes(q);
    })
  );
}

/** Extrait un nombre depuis "32 000 FCFA", "+13,5 %", "N/D", etc. */
export function parseSortNumber(raw: string): number | null {
  const cleaned = raw
    .replace(/\s/g, "")
    .replace(/%/g, "")
    .replace(/FCFA/gi, "")
    .replace(/Mds?/gi, "")
    .replace(/\+/g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function compareValues(
  aRaw: string,
  bRaw: string,
  dir: ColumnSortDir,
  kind: "auto" | "text" | "number"
): number {
  const forceAlpha = dir === "alpha-asc" || dir === "alpha-desc";
  const descending = dir === "desc" || dir === "alpha-desc";
  const useNumeric = !forceAlpha && kind !== "text";

  if (useNumeric) {
    const an = parseSortNumber(aRaw);
    const bn = parseSortNumber(bRaw);
    if (an != null && bn != null) {
      const cmp = an - bn;
      return descending ? -cmp : cmp;
    }
    if (kind === "number") {
      // N/D en bas
      if (an == null && bn == null) return 0;
      if (an == null) return 1;
      if (bn == null) return -1;
    }
  }

  const cmp = aRaw.localeCompare(bRaw, "fr", { sensitivity: "base", numeric: true });
  return descending ? -cmp : cmp;
}

export function applyColumnSort<T>(
  rows: T[],
  defs: Array<ColumnFilterDef<T>>,
  sort: ColumnSortState | null
): T[] {
  if (!sort) return rows;
  const def = defs.find((d) => d.key === sort.key);
  if (!def || def.skip) return rows;
  const kind = def.sortKind ?? "auto";
  return [...rows].sort((a, b) => compareValues(def.getValue(a), def.getValue(b), sort.dir, kind));
}

export function applyColumnFiltersAndSort<T>(
  rows: T[],
  defs: Array<ColumnFilterDef<T>>,
  filters: Record<string, string>,
  sort: ColumnSortState | null
): T[] {
  return applyColumnSort(applyColumnFilters(rows, defs, filters), defs, sort);
}
