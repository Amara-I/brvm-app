"use client";

import Image from "next/image";
import Link from "next/link";
import HeaderSearch from "@/components/nav/HeaderSearch";
import type { HeaderSearchItem } from "@/components/nav/HeaderSearch";
import ThemeToggle from "@/components/theme/ThemeToggle";
import AccountMenu from "@/components/auth/AccountMenu";
import type { HeaderNavUser } from "@/components/nav/HeaderNav";
import {
  BRAND_LOGO_HEIGHT,
  BRAND_LOGO_SRC,
  BRAND_LOGO_WIDTH,
  BRAND_NAME,
} from "@/lib/theme/brand";
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
          <Link href="/" className={styles.topBrand} aria-label={`${BRAND_NAME} — accueil`}>
            <Image
              src={BRAND_LOGO_SRC}
              alt={BRAND_NAME}
              width={BRAND_LOGO_WIDTH}
              height={BRAND_LOGO_HEIGHT}
              className={styles.topBrandLogo}
              priority
            />
          </Link>

          <div className={styles.topSearch}>
            <HeaderSearch companies={searchCompanies} variant="landing" />
          </div>

          <div className={styles.topActions}>
            <div className={styles.topTheme}>
              <ThemeToggle />
            </div>
            {user ? (
              <AccountMenu user={user} variant="landing" />
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
