"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import HeaderNav from "@/components/nav/HeaderNav";
import HeaderSearch from "@/components/nav/HeaderSearch";
import ThemeToggle from "@/components/theme/ThemeToggle";
import NotificationBell from "@/components/notifications/NotificationBell";
import AccountMenu from "@/components/auth/AccountMenu";
import VerifyEmailBanner from "@/components/auth/VerifyEmailBanner";
import type { HeaderNavUser } from "@/components/nav/HeaderNav";
import type { SectorGroup } from "@/lib/calc/market-summary-stats";
import type { HeaderSearchItem } from "@/components/nav/HeaderSearch";
import { BRAND_NAME, BRAND_LOGO_SRC, BRAND_LOGO_WIDTH, BRAND_LOGO_HEIGHT } from "@/lib/theme/brand";
import styles from "@/components/AppHeader.module.css";

type Props = {
  children: React.ReactNode;
  sectorGroups: SectorGroup[];
  totalCompanies: number;
  searchCompanies: HeaderSearchItem[];
  user: HeaderNavUser | null;
};

export default function SidebarLayout({
  children,
  sectorGroups,
  totalCompanies,
  searchCompanies,
  user,
}: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const hideVerifyBanner =
    pathname === "/connexion" ||
    pathname === "/inscription" ||
    pathname === "/mot-de-passe-oublie" ||
    pathname === "/reinitialiser-mot-de-passe" ||
    pathname === "/verifier-email" ||
    pathname === "/deconnexion" ||
    pathname === "/profil";

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const navProps = {
    layout: "sidebar" as const,
    sectorGroups,
    totalCompanies,
    searchCompanies,
    user,
    onNavigate: () => setMobileOpen(false),
  };

  return (
    <div className={styles.shell}>
      {mobileOpen ? (
        <button
          type="button"
          className={styles.sidebarBackdrop}
          aria-label="Fermer le menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className={styles.logoWrap}>
        <Link
          href="/"
          className={styles.logoLink}
          aria-label={`${BRAND_NAME} — accueil`}
          onClick={() => setMobileOpen(false)}
        >
          <Image
            src={BRAND_LOGO_SRC}
            alt={BRAND_NAME}
            width={BRAND_LOGO_WIDTH}
            height={BRAND_LOGO_HEIGHT}
            className={styles.logoImage}
            priority
          />
        </Link>
      </div>

      <header className={styles.topBar}>
        <button
          type="button"
          className={styles.hamburger}
          aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
        <Link href="/" className={styles.mobileLogo} aria-label={`${BRAND_NAME} — accueil`}>
          <Image
            src={BRAND_LOGO_SRC}
            alt={BRAND_NAME}
            width={BRAND_LOGO_WIDTH}
            height={BRAND_LOGO_HEIGHT}
            className={styles.logoImageTopbar}
          />
        </Link>

        <div className={styles.topActions}>
          <HeaderSearch companies={searchCompanies} />
          <NotificationBell isAuthenticated={Boolean(user)} />
          <ThemeToggle />
          {user ? (
            <AccountMenu user={user} />
          ) : (
            <>
              <Link href="/connexion" className={styles.authLink}>
                Connexion
              </Link>
              <Link href="/inscription" className={`${styles.authLink} ${styles.authLinkPrimary}`}>
                Créer un compte
              </Link>
            </>
          )}
        </div>
      </header>

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`} data-app-sidebar>
        <div className={styles.navArea}>
          <HeaderNav {...navProps} />
        </div>
      </aside>

      <div className={styles.main}>
        <div className={styles.mainInner}>
          <div className={styles.pageColumn}>
            {user && user.emailVerified === false && !hideVerifyBanner ? <VerifyEmailBanner /> : null}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
