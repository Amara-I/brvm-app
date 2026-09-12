"use client";

// Méga-menu Éducation — catégories + thèmes.

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { C } from "@/lib/theme/colors";
import {
  EDUCATION_CATEGORIES,
  EDUCATION_TERMS,
  countTermsByCategory,
  themesByCategory,
} from "@/lib/education/catalog";
import styles from "./MegaMenu.module.css";

const cssVars = {
  "--mm-border": C.border,
  "--mm-panelAlt": C.panel,
  "--mm-green": C.green,
  "--mm-textDim": C.textDim,
  "--mm-text": C.text,
  "--mm-bg": C.bg,
  "--mm-gold": C.gold,
} as React.CSSProperties;

const CLOSE_DELAY_MS = 160;

export default function EducationMegaMenu({
  variant = "inline",
  onNavigate,
}: {
  variant?: "inline" | "sidebar";
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();
  const total = EDUCATION_TERMS.length;

  function clearCloseTimer() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function openMenu() {
    clearCloseTimer();
    setOpen(true);
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }

  useEffect(() => () => clearCloseTimer(), []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const isSidebar = variant === "sidebar";
  const wrapperClass = isSidebar ? `${styles.wrapper} ${styles.wrapperSidebar}` : styles.wrapper;
  const triggerClass = isSidebar ? `${styles.trigger} ${styles.triggerSidebar}` : styles.trigger;
  const panelClass = isSidebar ? `${styles.panel} ${styles.panelSidebar}` : styles.panel;

  function closeMenu() {
    setOpen(false);
    onNavigate?.();
  }

  return (
    <div
      className={wrapperClass}
      style={cssVars}
      onMouseEnter={isSidebar ? undefined : openMenu}
      onMouseLeave={isSidebar ? undefined : scheduleClose}
    >
      {isSidebar ? (
        <button
          type="button"
          className={triggerClass}
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          Éducation
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} aria-hidden="true">
            ▸
          </span>
        </button>
      ) : (
        <Link
          href="/education"
          className={triggerClass}
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={panelId}
          onFocus={openMenu}
          onClick={closeMenu}
          data-analytics-feature="education"
          data-analytics-action="nav"
        >
          Éducation
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} aria-hidden="true">
            ▾
          </span>
        </Link>
      )}

      {open && (
        <div
          id={panelId}
          role="menu"
          className={panelClass}
          onMouseEnter={isSidebar ? undefined : openMenu}
          onMouseLeave={isSidebar ? undefined : scheduleClose}
        >
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>
              Parcours par catégories — {total} fiches
            </span>
            <Link
              href="/education"
              className={styles.headerAll}
              onClick={closeMenu}
              data-analytics-feature="education"
              data-analytics-action="mega_menu_all"
            >
              Voir tout →
            </Link>
          </div>
          <div className={styles.panelGrid}>
            {EDUCATION_CATEGORIES.map((cat) => {
              const themes = themesByCategory(cat.slug);
              return (
                <div key={cat.slug} className={styles.sectorCol}>
                  <Link
                    href={`/education#${cat.slug}`}
                    className={styles.sectorHeading}
                    onClick={closeMenu}
                    style={{ textDecoration: "none", display: "block" }}
                    data-analytics-feature="education"
                    data-analytics-action="mega_menu_category"
                  >
                    {cat.title}{" "}
                    <span className={styles.sectorCount}>({countTermsByCategory(cat.slug)})</span>
                  </Link>
                  {themes.map((theme) => (
                    <Link
                      key={theme.slug}
                      href={`/education/${theme.slug}`}
                      className={styles.companyRow}
                      role="menuitem"
                      onClick={closeMenu}
                      data-analytics-feature="education"
                      data-analytics-action="mega_menu"
                    >
                      <span className={styles.companyName} style={{ margin: 0 }}>
                        {theme.title}
                      </span>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
