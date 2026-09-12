"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { C } from "@/lib/theme/colors";
import type { SectorGroup } from "@/lib/calc/market-summary-stats";
import { comingSoonExchanges, comingSoonMarketHref, isBrvmNavPath } from "@/lib/markets/nav-structure";
import CompanyMegaMenu from "./CompanyMegaMenu";
import EducationMegaMenu from "./EducationMegaMenu";
import type { HeaderSearchItem } from "@/components/nav/HeaderSearch";
import styles from "./HeaderNav.module.css";

export interface HeaderNavUser {
  name: string | null | undefined;
  email: string | null | undefined;
}

const cssVars = {
  "--hn-text": C.text,
  "--hn-green": C.green,
  "--hn-gold": C.gold,
  "--hn-panel": C.panel,
  "--hn-panelAlt": C.selectedBg,
  "--hn-border": C.border,
  "--hn-bg": C.bg,
  "--hn-textDim": C.textDim,
} as React.CSSProperties;

function NavLink({
  href,
  label,
  active,
  onClick,
  sidebar,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
  sidebar?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${styles.navLink} ${sidebar ? styles.navLinkSidebar : ""} ${active ? styles.navLinkActive : ""}`}
      onClick={onClick}
    >
      {label}
    </Link>
  );
}

export default function HeaderNav({
  sectorGroups,
  totalCompanies,
  layout = "sidebar",
  onNavigate,
}: {
  sectorGroups: SectorGroup[];
  totalCompanies: number;
  searchCompanies: HeaderSearchItem[];
  user: HeaderNavUser | null;
  layout?: "sidebar";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);
  const sidebar = layout === "sidebar";
  const close = onNavigate;
  const brvmActive = isBrvmNavPath(pathname);
  const [brvmOpen, setBrvmOpen] = useState(true);
  const brvmPanelId = useId();
  const soonExchanges = comingSoonExchanges();

  useEffect(() => {
    if (brvmActive) setBrvmOpen(true);
  }, [brvmActive]);

  const brvmPages = (
    <>
      <NavLink
        href="/marche"
        label="Vue d'ensemble"
        active={pathname === "/marche"}
        onClick={close}
        sidebar={sidebar}
      />
      <NavLink
        href="/screener"
        label="Screener"
        active={isActive("/screener")}
        onClick={close}
        sidebar={sidebar}
      />
      <NavLink href="/graphes" label="Graphes" active={isActive("/graphes")} onClick={close} sidebar={sidebar} />
      <CompanyMegaMenu
        groups={sectorGroups}
        totalCount={totalCompanies}
        variant={sidebar ? "sidebar" : "inline"}
        onNavigate={close}
      />
      <NavLink
        href="/calendrier-dividendes"
        label="Dividendes"
        active={isActive("/calendrier-dividendes")}
        onClick={close}
        sidebar={sidebar}
      />
    </>
  );

  const links = (
    <>
      {sidebar ? <p className={styles.navGroupLabel}>Investir</p> : null}
      <NavLink
        href="/portefeuille"
        label="Portefeuille"
        active={isActive("/portefeuille")}
        onClick={close}
        sidebar={sidebar}
      />
      <NavLink
        href="/simulation"
        label="Simulation"
        active={isActive("/simulation")}
        onClick={close}
        sidebar={sidebar}
      />

      {sidebar ? <p className={styles.navGroupLabel}>Marchés</p> : null}
      {sidebar ? (
        <div className={styles.marketGroup}>
          <button
            type="button"
            className={`${styles.marketTrigger} ${brvmActive ? styles.marketTriggerActive : ""}`}
            aria-expanded={brvmOpen}
            aria-controls={brvmPanelId}
            onClick={() => setBrvmOpen((open) => !open)}
          >
            <span className={styles.marketTriggerMain}>
              <span className={styles.liveDot} aria-hidden="true" />
              BRVM
            </span>
            <span className={`${styles.chevron} ${brvmOpen ? styles.chevronOpen : ""}`} aria-hidden="true">
              ▾
            </span>
          </button>
          {brvmOpen ? (
            <div id={brvmPanelId} className={styles.navNested} role="group" aria-label="Pages BRVM">
              {brvmPages}
            </div>
          ) : null}
        </div>
      ) : (
        brvmPages
      )}
      {sidebar
        ? soonExchanges.map((exchange) => {
            const href = comingSoonMarketHref(exchange.code);
            const active = isActive(href);
            return (
              <Link
                key={exchange.code}
                href={href}
                className={`${styles.navSoon} ${active ? styles.navSoonActive : ""}`}
                aria-current={active ? "page" : undefined}
                title={`${exchange.shortLabel} — bientôt`}
                onClick={close}
              >
                <span>{exchange.shortLabel}</span>
                <span className={styles.soonBadge}>bientôt</span>
              </Link>
            );
          })
        : null}

      {sidebar ? <p className={styles.navGroupLabel}>Ressources</p> : null}
      <EducationMegaMenu variant={sidebar ? "sidebar" : "inline"} onNavigate={close} />
      <NavLink href="/actualites" label="Actualités" active={isActive("/actualites")} onClick={close} sidebar={sidebar} />
      <NavLink href="/outils" label="Outils" active={isActive("/outils")} onClick={close} sidebar={sidebar} />
    </>
  );

  return (
    <div style={cssVars}>
      <nav aria-label="Navigation principale" className={sidebar ? styles.sidebarNav : styles.desktopNav}>
        {links}
      </nav>
    </div>
  );
}
