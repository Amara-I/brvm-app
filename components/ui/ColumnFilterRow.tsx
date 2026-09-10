"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { ColumnSortDir, ColumnSortState } from "@/lib/ui/column-filters";
import styles from "./ColumnFilterRow.module.css";

export interface SortableHeaderColumn {
  key: string;
  label: string;
  skip?: boolean;
  /** Contenu personnalisé à la place du label (ex. sélecteur d'horizon). */
  header?: ReactNode;
}

const MENU_OPTIONS: Array<{
  dir: ColumnSortDir | null;
  symbol: string;
  title: string;
}> = [
  { dir: "asc", symbol: "↑", title: "Croissant / A → Z" },
  { dir: "desc", symbol: "↓", title: "Décroissant / Z → A" },
  { dir: null, symbol: "✕", title: "Annuler le tri" },
];

function SortMenu({
  columnKey,
  label,
  sort,
  onSortChange,
}: {
  columnKey: string;
  label: string;
  sort: ColumnSortState | null;
  onSortChange: (next: ColumnSortState | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const active = sort?.key === columnKey ? sort.dir : null;
  const triggerSymbol = active === "asc" ? "↑" : active === "desc" ? "↓" : "▾";

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.menuRoot} ref={rootRef}>
      <button
        type="button"
        className={active ? styles.triggerActive : styles.trigger}
        aria-label={`Trier la colonne ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {triggerSymbol}
      </button>
      {open ? (
        <ul id={menuId} role="menu" className={styles.menu} onClick={(e) => e.stopPropagation()}>
          {MENU_OPTIONS.map((o) => {
            const isCancel = o.dir === null;
            const selected = !isCancel && active === o.dir;
            return (
              <li key={o.symbol} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={
                    isCancel
                      ? styles.menuItemCancel
                      : selected
                        ? styles.menuItemActive
                        : styles.menuItem
                  }
                  title={o.title}
                  aria-label={o.title}
                  onClick={() => {
                    if (o.dir == null) onSortChange(null);
                    else onSortChange({ key: columnKey, dir: o.dir });
                    setOpen(false);
                  }}
                >
                  <span aria-hidden="true">{o.symbol}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** Une seule ligne d'en-tête : titre + menu ↑ / ↓ / ✕ (plus de ligne « Tri… »). */
export default function ColumnFilterRow({
  columns,
  sort,
  onSortChange,
}: {
  columns: SortableHeaderColumn[];
  sort: ColumnSortState | null;
  onSortChange: (next: ColumnSortState | null) => void;
  /** @deprecated plus utilisé — l'annulation est dans le menu ✕ */
  onClearSort?: () => void;
}) {
  return (
    <tr className={styles.headerRow}>
      {columns.map((col) => (
        <th key={col.key} scope="col" className={styles.headerCell}>
          <div className={styles.headerInner}>
            <span className={styles.headerLabel}>{col.header ?? col.label}</span>
            {col.skip ? null : (
              <SortMenu
                columnKey={col.key}
                label={col.label}
                sort={sort}
                onSortChange={onSortChange}
              />
            )}
          </div>
        </th>
      ))}
    </tr>
  );
}
