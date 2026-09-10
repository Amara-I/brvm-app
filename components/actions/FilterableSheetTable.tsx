"use client";

import { useMemo, useState, type ReactNode } from "react";
import { C } from "@/lib/theme/colors";
import ColumnFilterRow from "@/components/ui/ColumnFilterRow";
import {
  applyColumnSort,
  type ColumnFilterDef,
  type ColumnSortState,
} from "@/lib/ui/column-filters";
import styles from "./CompanySheet.module.css";

export type SheetTableColumn = {
  key: string;
  label: string;
  getValue: (row: Record<string, string>) => string;
  render?: (row: Record<string, string>) => ReactNode;
  sortKind?: "auto" | "text" | "number";
};

export default function FilterableSheetTable({
  columns,
  rows,
}: {
  columns: SheetTableColumn[];
  rows: Array<Record<string, string>>;
}) {
  const defs = useMemo<ColumnFilterDef<Record<string, string>>[]>(
    () =>
      columns.map((c) => ({
        key: c.key,
        label: c.label,
        getValue: c.getValue,
        sortKind: c.sortKind,
      })),
    [columns]
  );
  const [colSort, setColSort] = useState<ColumnSortState | null>(null);
  const filtered = useMemo(() => applyColumnSort(rows, defs, colSort), [rows, defs, colSort]);

  return (
    <table className={styles.table}>
      <thead>
        <ColumnFilterRow columns={defs} sort={colSort} onSortChange={setColSort} />
      </thead>
      <tbody>
        {filtered.length === 0 ? (
          <tr>
            <td colSpan={columns.length} style={{ color: C.textDim }}>
              Aucune ligne.
            </td>
          </tr>
        ) : (
          filtered.map((row, i) => (
            <tr key={row.id ?? `${row.label ?? "row"}-${i}`}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : c.getValue(row)}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
