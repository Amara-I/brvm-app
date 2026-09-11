"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { C } from "@/lib/theme/colors";
import type { SectorGroup } from "@/lib/calc/market-summary-stats";
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
  "--hn-panel": C.panel,
  "--hn-panelAlt": C.selectedBg,
  "--hn-border": C.border,
  "--hn-bg": C.bg,
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
      {sidebar ? <p className={styles.navGroupLabel}>Marché</p> : null}
      <NavLink href="/marche" label="Marché" active={isActive("/marche")} onClick={close} sidebar={sidebar} />
      <NavLink href="/screener" label="Screener" active={isActive("/screener")} onClick={close} sidebar={sidebar} />
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
