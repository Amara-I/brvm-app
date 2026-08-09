"use client";

// ═══════════════════════════════════════════════════════════════════════════
// Nav horizontale + tiroir mobile du header partagé — étape 11 (rebranding
// ouestBourse). Remplace l'ancien `components/NavLinks.tsx` (étape 10) :
// même rôle (surbrillance du lien actif via usePathname) + méga-menu
// "Sociétés cotées" + tiroir mobile (facilement adaptable sur mobile,
// demande explicite de l'utilisateur).
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { C } from "@/lib/theme/colors";
import type { SectorGroup } from "@/lib/calc/market-summary-stats";
import CompanyMegaMenu from "./CompanyMegaMenu";
import ThemeToggle from "@/components/theme/ThemeToggle";
import styles from "./HeaderNav.module.css";

const NAV_ITEMS = [
  { href: "/marche", label: "Marché" },
  { href: "/screener", label: "Screener" },
  { href: "/portefeuille", label: "Portefeuille" },
  { href: "/graphes", label: "Graphes" },
  { href: "/actualites", label: "Actualités" },
  { href: "/outils", label: "Outils" },
];

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

function NavLink({ href, label, active, onClick }: { href: string; label: string; active: boolean; onClick?: () => void }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`} onClick={onClick}>
      {label}
    </Link>
  );
}

export default function HeaderNav({
  sectorGroups,
  totalCompanies,
  user,
}: {
  sectorGroups: SectorGroup[];
  totalCompanies: number;
  user: HeaderNavUser | null;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <div style={cssVars}>
      <nav aria-label="Navigation principale" className={styles.desktopNav}>
        <NavLink href="/marche" label="Marché" active={isActive("/marche")} />
        <NavLink href="/screener" label="Screener" active={isActive("/screener")} />
        <NavLink href="/portefeuille" label="Portefeuille" active={isActive("/portefeuille")} />
        <NavLink href="/graphes" label="Graphes" active={isActive("/graphes")} />
        <CompanyMegaMenu groups={sectorGroups} totalCount={totalCompanies} />
        <NavLink href="/actualites" label="Actualités" active={isActive("/actualites")} />
        <NavLink href="/outils" label="Outils" active={isActive("/outils")} />
      </nav>

      <button
        type="button"
        className={styles.hamburger}
        aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((v) => !v)}
      >
        {mobileOpen ? "✕" : "☰"}
      </button>

      <div className={`${styles.mobilePanel} ${mobileOpen ? styles.open : ""}`}>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} active={isActive(item.href)} onClick={() => setMobileOpen(false)} />
        ))}
        <Link href="/societes-cotees" className={styles.navLink} onClick={() => setMobileOpen(false)}>
          Sociétés cotées
        </Link>
        {user ? (
          <a href="/api/auth/signout" className={styles.navLink} onClick={() => setMobileOpen(false)}>
            Déconnexion ({user.name ?? user.email ?? "mon compte"})
          </a>
        ) : (
          <>
            <Link href="/connexion" className={styles.navLink} onClick={() => setMobileOpen(false)}>
              Connexion
            </Link>
            <Link href="/inscription" className={styles.navLink} onClick={() => setMobileOpen(false)}>
              Créer un compte
            </Link>
          </>
        )}
        <div className={styles.mobileThemeRow}>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
