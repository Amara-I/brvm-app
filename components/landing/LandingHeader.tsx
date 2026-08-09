"use client";

// Header de la landing page — nav horizontale façon ouestbourse.com, avec un
// menu mobile (hamburger) simple pour rester "facilement adaptable sur
// mobile" (demande explicite de l'utilisateur). Composant client uniquement
// pour ce toggle ; aucune donnée sensible ni appel réseau ici.

import { useState } from "react";
import Link from "next/link";
import styles from "./Landing.module.css";

const NAV_ITEMS = [
  { href: "/marche", label: "Marché" },
  { href: "/screener", label: "Screener" },
  { href: "/portefeuille", label: "Portefeuille" },
  { href: "/graphes", label: "Graphes" },
  { href: "/societes-cotees", label: "Sociétés cotées" },
  { href: "/actualites", label: "Actualités" },
  { href: "/outils", label: "Outils" },
];

export default function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.logo}>
          <span>📊</span>
          <span>
            BRVM<span className={styles.logoAccent}>App</span>
          </span>
        </Link>

        <nav className={styles.desktopNav} aria-label="Navigation principale">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.headerActions}>
          <Link href="/connexion" className={styles.loginLink}>
            Connexion
          </Link>
          <Link href="/inscription" className={styles.signupBtn}>
            Créer un compte
          </Link>
        </div>

        <button
          type="button"
          className={styles.hamburger}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      <div className={`${styles.mobilePanel} ${open ? styles.open : ""}`}>
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className={styles.navLink} onClick={() => setOpen(false)}>
            {item.label}
          </Link>
        ))}
        <Link href="/connexion" className={styles.loginLink} onClick={() => setOpen(false)}>
          Connexion
        </Link>
        <Link href="/inscription" className={styles.signupBtn} onClick={() => setOpen(false)}>
          Créer un compte
        </Link>
      </div>
    </header>
  );
}
