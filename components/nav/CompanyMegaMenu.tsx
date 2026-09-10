"use client";

// Méga-menu "Sociétés cotées" : survol → vue par secteur ; clic → /societes-cotees.

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { SectorGroup } from "@/lib/calc/market-summary-stats";
import { C } from "@/lib/theme/colors";
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

export default function CompanyMegaMenu({
  groups,
  totalCount,
  variant = "inline",
  onNavigate,
}: {
  groups: SectorGroup[];
  totalCount: number;
  variant?: "inline" | "sidebar";
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();

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

  useEffect(() => {
    return () => clearCloseTimer();
  }, []);

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
      ref={wrapperRef}
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
          Sociétés cotées
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} aria-hidden="true">
            ▸
          </span>
        </button>
      ) : (
        <Link
          href="/societes-cotees"
          className={triggerClass}
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={panelId}
          onFocus={openMenu}
          onClick={() => setOpen(false)}
        >
          Sociétés cotées
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
              La cote — {totalCount} émetteur{totalCount > 1 ? "s" : ""}
            </span>
            <Link href="/societes-cotees" className={styles.headerAll} onClick={closeMenu}>
              Voir tout →
            </Link>
          </div>
          <div className={styles.panelGrid}>
            {groups.map((g) => (
              <div key={g.sector} className={styles.sectorCol}>
                <div className={styles.sectorHeading}>
                  {g.sector.toUpperCase()}{" "}
                  <span className={styles.sectorCount}>({g.companies.length})</span>
                </div>
                {g.companies.map((co) => (
                  <Link
                    key={co.ticker}
                    href={`/actions/${co.ticker}`}
                    className={styles.companyRow}
                    role="menuitem"
                    onClick={closeMenu}
                  >
                    <span className={styles.logoMark} aria-hidden="true">
                      {co.ticker.slice(0, 2)}
                    </span>
                    <span className={styles.companyMain}>
                      <span className={styles.companyTicker}>{co.ticker}</span>
                      <span className={styles.companyName}>{co.name}</span>
                    </span>
                    <span className={styles.companyPrice}>
                      {co.lastPrice !== null && co.lastPrice > 0
                        ? `${co.lastPrice.toLocaleString("fr-FR")} FCFA`
                        : "N/D"}
                    </span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
          <div className={styles.panelFooter}>
            <Link href="/societes-cotees" className={styles.footerLink} onClick={closeMenu}>
              Voir toutes les sociétés cotées →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
