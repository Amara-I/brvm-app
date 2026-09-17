"use client";

// Méga-menu "Sociétés cotées" : clic sur le libellé ouvre/ferme le panneau.
// "Voir tout" (et les liens internes) mènent à la page complète.

import Link from "next/link";
import type { SectorGroup } from "@/lib/calc/market-summary-stats";
import { C } from "@/lib/theme/colors";
import MegaMenuTrigger from "./MegaMenuTrigger";
import styles from "./MegaMenu.module.css";
import { useMegaMenu } from "./useMegaMenu";

const cssVars = {
  "--mm-border": C.border,
  "--mm-panelAlt": C.panel,
  "--mm-green": C.green,
  "--mm-textDim": C.textDim,
  "--mm-text": C.text,
  "--mm-bg": C.bg,
  "--mm-gold": C.gold,
} as React.CSSProperties;

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
  const { open, close, toggle, wrapperRef, triggerRef, panelId } = useMegaMenu();
  const isSidebar = variant === "sidebar";
  const wrapperClass = isSidebar ? `${styles.wrapper} ${styles.wrapperSidebar}` : styles.wrapper;
  const triggerClass = isSidebar ? `${styles.trigger} ${styles.triggerSidebar}` : styles.trigger;
  const panelClass = isSidebar ? `${styles.panel} ${styles.panelSidebar}` : styles.panel;

  function closeMenu() {
    close();
    onNavigate?.();
  }

  return (
    <div className={wrapperClass} ref={wrapperRef} style={cssVars}>
      <MegaMenuTrigger
        label="Sociétés cotées"
        open={open}
        panelId={panelId}
        triggerRef={triggerRef}
        onToggle={toggle}
        className={triggerClass}
        analyticsFeature="societes_cotees"
      />

      {open && (
        <div id={panelId} role="region" aria-label="Sociétés cotées" className={panelClass}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>
              La cote — {totalCount} émetteur{totalCount > 1 ? "s" : ""}
            </span>
            <Link
              href="/societes-cotees"
              className={styles.headerAll}
              onClick={closeMenu}
              data-analytics-feature="societes_cotees"
              data-analytics-action="mega_menu_all"
            >
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
                    onClick={closeMenu}
                    data-analytics-feature="company_sheet"
                    data-analytics-action="mega_menu"
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
