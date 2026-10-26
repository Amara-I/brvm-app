"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TFunc } from "@/lib/i18n/create-i18n";
import {
  MARKET_HORIZON_OPTIONS,
  type MarketHorizon,
} from "@/lib/markets/market-horizon";
import styles from "./MarketBoard.module.css";

const HORIZON_KEY = {
  "1J": "market.horizon.day",
  "1S": "market.horizon.week",
  "1M": "market.horizon.month",
  "3M": "market.horizon.threeMonths",
  "6M": "market.horizon.sixMonths",
  "1A": "market.horizon.year",
  "3A": "market.horizon.threeYears",
  MAX: "market.horizon.all",
} as const satisfies Record<MarketHorizon, Parameters<TFunc>[0]>;

export default function HorizonSelect({
  value,
  onChange,
}: {
  value: MarketHorizon;
  onChange: (h: MarketHorizon) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const label = t(HORIZON_KEY[value]);

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
        aria-label={t("market.horizon.aria")}
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
                  {t(HORIZON_KEY[o.value])}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
