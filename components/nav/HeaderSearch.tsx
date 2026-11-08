"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconSearch } from "@/components/icons/HeaderIcons";
import { trackFeature } from "@/components/analytics/track-client";
import styles from "./HeaderSearch.module.css";
import { useI18n } from "@/components/i18n/I18nProvider";
import { loadSiteSearchCatalogClient } from "@/lib/search/client-catalog";
import { stockDocument, type StockSearchSource } from "@/lib/search/documents";
import { applySearchKey, isSearchShortcut, searchSite } from "@/lib/search/match";
import type { SiteSearchDocument, SiteSearchGroup, SiteSearchHit } from "@/lib/search/types";
import SearchKindIcon from "./SearchKindIcon";

export type HeaderSearchItem = StockSearchSource;

function localized(locale: string, primary?: string, english?: string): string {
  if (locale === "en" && english) return english;
  return primary ?? "";
}

export default function HeaderSearch({
  companies,
  variant = "default",
}: {
  companies: HeaderSearchItem[];
  variant?: "default" | "landing";
}) {
  const router = useRouter();
  const { t, labels, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [catalog, setCatalog] = useState<SiteSearchDocument[] | null>(null);
  const [catalogState, setCatalogState] = useState<"idle" | "ready" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());

  function warmCatalog() {
    void loadSiteSearchCatalogClient().then((documents) => {
      if (documents && documents.length > 0) {
        setCatalog(documents);
        setCatalogState("ready");
        return;
      }
      setCatalogState((state) => (state === "ready" ? state : "error"));
    });
  }

  useEffect(() => {
    const run = () => warmCatalog();
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(run, 600);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (open) {
      warmCatalog();
      inputRef.current?.focus();
    }
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
      const target = e.target as HTMLElement | null;
      if (
        !isSearchShortcut({
          key: e.key,
          metaKey: e.metaKey,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          targetTag: target?.tagName,
          editable: target?.isContentEditable,
        })
      ) {
        return;
      }
      e.preventDefault();
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const landing = variant === "landing";
  const documents = useMemo(() => {
    if (catalog && catalog.length > 0) return catalog;
    return companies.map((company) => stockDocument(company));
  }, [catalog, companies]);

  const groups = useMemo(() => searchSite(documents, q), [documents, q]);
  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const resultKey = `${q}\n${flat.map((hit) => hit.id).join("\n")}`;

  useEffect(() => {
    setActive(0);
  }, [resultKey]);

  useEffect(() => {
    const current = flat[active];
    if (!current) return;
    optionRefs.current.get(current.id)?.scrollIntoView({ block: "nearest" });
  }, [active, flat]);

  function go(hit: SiteSearchHit) {
    setOpen(false);
    setQ("");
    trackFeature("search", `select_${hit.kind}`);
    router.push(hit.href);
  }

  function groupLabel(group: SiteSearchGroup): string {
    if (group.kind === "stock") return t("chrome.search.groups.stocks", { exchange: group.exchange ?? "" });
    if (group.kind === "index") return t("chrome.search.groups.indices", { exchange: group.exchange ?? "" });
    if (group.kind === "education") return t("chrome.search.groups.education");
    return t("chrome.search.groups.pages");
  }

  function subtitleOf(hit: SiteSearchHit): string {
    if (hit.kind === "stock") return hit.subtitle ? labels.sector(hit.subtitle) : "";
    return localized(locale, hit.subtitle, hit.subtitleEn);
  }

  let cursor = 0;

  return (
    <div ref={rootRef} className={`${styles.root} ${landing ? styles.rootLanding : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={warmCatalog}
        onFocus={warmCatalog}
        aria-label={t("chrome.search.company")}
        aria-expanded={open}
        aria-controls={open ? "site-search-results" : undefined}
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
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            role="combobox"
            aria-expanded
            aria-controls="site-search-results"
            aria-autocomplete="list"
            aria-activedescendant={flat[active] ? `site-search-opt-${active}` : undefined}
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={t("chrome.search.placeholder")}
            aria-label={t("chrome.search.company")}
            className={styles.input}
            onKeyDown={(event) => {
              const action = applySearchKey({ key: event.key, index: active, count: flat.length });
              if (action.type === "move") {
                event.preventDefault();
                setActive(action.index);
              } else if (action.type === "select") {
                event.preventDefault();
                const hit = flat[action.index];
                if (hit) go(hit);
              } else if (action.type === "close") {
                event.preventDefault();
                setOpen(false);
              }
            }}
          />
          <div id="site-search-results" role="listbox" aria-label={t("chrome.search.dialog")} className={styles.list}>
            {flat.length === 0 ? (
              <p className={styles.empty}>
                {catalogState === "idle" && companies.length === 0 && !q.trim()
                  ? t("chrome.search.loading")
                  : t("chrome.search.empty")}
              </p>
            ) : (
              groups.map((group) => (
                <section key={group.id} className={styles.group} aria-label={groupLabel(group)}>
                  <div className={styles.groupTitle}>
                    <span className={styles.kindIcon}>
                      <SearchKindIcon kind={group.kind} />
                    </span>
                    {groupLabel(group)}
                  </div>
                  <ul className={styles.groupList}>
                    {group.items.map((hit) => {
                      const index = cursor;
                      cursor += 1;
                      const selected = index === active;
                      const title = localized(locale, hit.title, hit.titleEn);
                      const subtitle = subtitleOf(hit);
                      return (
                        <li key={hit.id}>
                          <button
                            type="button"
                            id={`site-search-opt-${index}`}
                            role="option"
                            aria-selected={selected}
                            ref={(node) => {
                              if (node) optionRefs.current.set(hit.id, node);
                              else optionRefs.current.delete(hit.id);
                            }}
                            onClick={() => go(hit)}
                            onMouseEnter={() => {
                              setActive(index);
                              router.prefetch(hit.href);
                            }}
                            onFocus={() => router.prefetch(hit.href)}
                            className={`${styles.item} ${selected ? styles.itemActive : ""}`}
                          >
                            <span className={styles.itemMain}>
                              {hit.code ? <span className={styles.ticker}>{hit.code}</span> : null}
                              <span>{hit.code ? ` · ${title}` : title}</span>
                            </span>
                            {subtitle ? <span className={styles.sector}>{subtitle}</span> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
