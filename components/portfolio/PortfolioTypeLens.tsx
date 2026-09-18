"use client";

import Link from "next/link";
import { PORTFOLIO_TYPE_EDUCATION_HREF, PORTFOLIO_TYPE_LIST, PORTFOLIO_TYPE_META, type PortfolioTypeId } from "@/lib/portfolio/types";
import styles from "./PortfolioTypeLens.module.css";

export default function PortfolioTypeLens({
  value,
  onChange,
  savedType = null,
  isAuthenticated = false,
  compact = false,
}: {
  value: PortfolioTypeId | null;
  onChange: (next: PortfolioTypeId | null) => void;
  savedType?: PortfolioTypeId | null;
  isAuthenticated?: boolean;
  compact?: boolean;
}) {
  const meta = value ? PORTFOLIO_TYPE_META[value] : null;

  return (
    <section className={compact ? `${styles.box} ${styles.compact}` : styles.box} aria-label="Type de portefeuille">
      <div className={styles.head}>
        <label className={styles.label} htmlFor="portfolio-type-lens">
          Lecture selon le type
        </label>
        <select
          id="portfolio-type-lens"
          className={styles.select}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? (e.target.value as PortfolioTypeId) : null)}
        >
          <option value="">Non choisi</option>
          {PORTFOLIO_TYPE_LIST.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      {meta ? (
        <>
          <p className={styles.lead}>{meta.analysis.lead}</p>
          <p className={styles.body}>{meta.analysis.body}</p>
          {meta.analysis.warning ? (
            <p className={styles.warn} role="note">
              {meta.analysis.warning}
            </p>
          ) : null}
          <p className={styles.links}>
            <Link href={meta.educationHref}>Fiche {meta.label}</Link>
            {" · "}
            <Link href={PORTFOLIO_TYPE_EDUCATION_HREF}>Les 4 types</Link>
            {isAuthenticated && savedType !== value ? (
              <>
                {" · "}
                <Link href="/profil">Enregistrer sur Mon profil</Link>
              </>
            ) : null}
            {!isAuthenticated ? (
              <>
                {" · "}
                <Link href="/profil">Choisir sur Mon profil</Link>
              </>
            ) : null}
          </p>
        </>
      ) : (
        <p className={styles.body}>
          Choisissez Croissance, Rente, Trading ou Croissance Max pour adapter les rappels
          pédagogiques. Les scores et signaux affichés ne changent pas.
          {" "}
          <Link href={PORTFOLIO_TYPE_EDUCATION_HREF}>Lire le cadre BRVM</Link>
          {isAuthenticated ? (
            <>
              {" · "}
              <Link href="/profil">Choisir sur Mon profil</Link>
            </>
          ) : null}
        </p>
      )}
    </section>
  );
}
