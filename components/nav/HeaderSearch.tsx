"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconSearch } from "@/components/icons/HeaderIcons";
import { trackFeature } from "@/components/analytics/track-client";
import styles from "./HeaderSearch.module.css";

export interface HeaderSearchItem {
  ticker: string;
  name: string;
  sector: string;
}

export default function HeaderSearch({ companies }: { companies: HeaderSearchItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      e.preventDefault();
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return companies.slice(0, 8);
    return companies
      .filter(
        (c) =>
          c.ticker.toLowerCase().includes(needle) ||
          c.name.toLowerCase().includes(needle) ||
          c.sector.toLowerCase().includes(needle)
      )
      .slice(0, 10);
  }, [companies, q]);

  function go(ticker: string) {
    setOpen(false);
    setQ("");
    trackFeature("search", "select_company");
    router.push(`/actions/${ticker}`);
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Rechercher une société"
        aria-expanded={open}
        title="Rechercher (raccourci / )"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
      >
        <IconSearch size={15} />
        <span className={styles.triggerLabel}>Rechercher un ticker…</span>
        <kbd className={styles.kbd}>/</kbd>
      </button>

      {open && (
        <div role="dialog" aria-label="Recherche sociétés" className={styles.panel}>
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ticker, nom ou secteur…"
            aria-label="Rechercher une société"
            className={styles.input}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) go(results[0].ticker);
            }}
          />
          <ul className={styles.list}>
            {results.length === 0 ? (
              <li className={styles.empty}>Aucun résultat — N/D</li>
            ) : (
              results.map((c) => (
                <li key={c.ticker}>
                  <button type="button" onClick={() => go(c.ticker)} className={styles.item}>
                    <span className={styles.ticker}>{c.ticker}</span>
                    <span> · {c.name}</span>
                    <div className={styles.sector}>{c.sector}</div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
