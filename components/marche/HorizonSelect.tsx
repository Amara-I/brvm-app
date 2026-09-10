"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  MARKET_HORIZON_OPTIONS,
  type MarketHorizon,
} from "@/lib/markets/market-horizon";
import styles from "./MarketBoard.module.css";

export default function HorizonSelect({
  value,
  onChange,
}: {
  value: MarketHorizon;
  onChange: (h: MarketHorizon) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const label = MARKET_HORIZON_OPTIONS.find((o) => o.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
    <div
      ref={rootRef}
      className={styles.horizonMenu}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={styles.horizonTrigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label="Horizon historique de l'aperçu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {label}
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <ul id={listId} role="listbox" className={styles.horizonList}>
          {MARKET_HORIZON_OPTIONS.map((o) => {
            const selected = o.value === value;
            return (
              <li key={o.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={selected ? styles.horizonOptionOn : styles.horizonOption}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
