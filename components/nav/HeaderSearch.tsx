"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconSearch } from "@/components/icons/HeaderIcons";
import { trackFeature } from "@/components/analytics/track-client";
import styles from "./HeaderSearch.module.css";
import { useI18n } from "@/components/i18n/I18nProvider";

import { searchListings, companyHref, type ListingSearchItem } from "@/lib/markets/search";
import type { ListingExchange } from "@/lib/markets/listing-scope";
export type HeaderSearchItem = ListingSearchItem;

export default function HeaderSearch({
  companies,
  variant = "default",
}: {
  companies: HeaderSearchItem[];
  variant?: "default" | "landing";
}) {
  const router = useRouter();
  const { t, labels } = useI18n();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [market, setMarket] = useState<ListingExchange | "">("");
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
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      const slash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey;
      const commandK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (!slash && !commandK) return;
      e.preventDefault();
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const landing = variant === "landing";

  const groups = useMemo(() => searchListings(companies, q, market || undefined), [companies, q, market]);
  const results = groups.flatMap((group) => group.items);

  function go(item: HeaderSearchItem) {
    setOpen(false);
    setQ("");
    trackFeature("search", "select_company");
    router.push(companyHref(item));
  }

  return (
    <div ref={rootRef} className={`${styles.root} ${landing ? styles.rootLanding : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("chrome.search.company")}
        aria-expanded={open}
        title={t("chrome.search.shortcut")}
        className={`${styles.trigger} ${landing ? styles.triggerLanding : ""} ${open ? styles.triggerOpen : ""}`}
      >
        <IconSearch size={15} />
        <span className={styles.triggerLabel}>
          {landing ? t("chrome.search.triggerLanding") : t("chrome.search.trigger")}
        </span>
        <kbd className={styles.kbd}>{landing ? "⌘K" : "/"}</kbd>
      </button>

      {open && (
        <div role="dialog" aria-label={t("chrome.search.dialog")} className={styles.panel}>
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("chrome.search.placeholder")}
            aria-label={t("chrome.search.company")}
            className={styles.input}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) go(results[0]);
            }}
          />
          <label className={styles.marketFilter}>
            Marché : <select aria-label="Filtrer par marché" value={market} onChange={(e) => setMarket(e.target.value as ListingExchange | "")}>
              <option value="">BRVM + NGX</option><option value="BRVM">BRVM</option><option value="NGX">NGX</option>
            </select>
          </label>
          <ul className={styles.list}>
            {results.length === 0 ? (
              <li className={styles.empty}>{t("chrome.search.empty")}</li>
            ) : (
              groups.filter((group) => group.items.length > 0).map((group) => (
                <li key={group.exchange}>
                  <strong className={styles.groupTitle}>{group.exchange}</strong>
                  <ul className={styles.groupList}>
                    {group.items.map((c) => (
                      <li key={`${group.exchange}:${c.ticker}`}>
                        <button type="button" onClick={() => go(c)}
                          onMouseEnter={() => router.prefetch(companyHref(c))}
                          onFocus={() => router.prefetch(companyHref(c))} className={styles.item}>
                          <span className={styles.ticker}>{c.ticker}</span><span> · {c.name}</span>
                          <div className={styles.sector}>{labels.sector(c.sector)}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
