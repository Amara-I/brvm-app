"use client";

import Link from "next/link";
import HeaderSearch from "@/components/nav/HeaderSearch";
import type { HeaderSearchItem } from "@/components/nav/HeaderSearch";
import ThemeToggle from "@/components/theme/ThemeToggle";
import SignOutButton from "@/components/auth/SignOutButton";
import type { HeaderNavUser } from "@/components/nav/HeaderNav";
import styles from "./Landing.module.css";

export default function LandingTopBar({
  searchCompanies,
  user,
}: {
  searchCompanies: HeaderSearchItem[];
  user: HeaderNavUser | null;
}) {
  return (
    <header className={styles.topBar}>
      <div className={styles.rail}>
        <div className={styles.topBarInner}>
          <Link href="/" className={styles.topBrand} aria-label="OuestBourse — accueil">
            <span className={styles.topBrandDot} aria-hidden="true" />
            <span className={styles.topBrandFull}>Plateforme d&apos;analyse africaine</span>
            <span className={styles.topBrandShort}>Analyse africaine</span>
          </Link>

          <div className={styles.topSearch}>
            <HeaderSearch companies={searchCompanies} variant="landing" />
          </div>

          <div className={styles.topActions}>
            <div className={styles.topTheme}>
              <ThemeToggle />
            </div>
            {user ? (
              <>
                <p className={styles.topGreeting}>
                  Bonjour, <span>{user.name ?? user.email ?? "N/D"}</span>
                </p>
                <SignOutButton className={styles.topAuth} />
              </>
            ) : (
              <>
                <Link href="/connexion" className={styles.topAuth}>
                  Connexion
                </Link>
                <Link href="/inscription" className={`${styles.topAuth} ${styles.topAuthPrimary}`}>
                  Créer un compte
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
