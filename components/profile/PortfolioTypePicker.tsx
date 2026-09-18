"use client";

import Link from "next/link";
import {
  PORTFOLIO_TYPE_EDUCATION_HREF,
  PORTFOLIO_TYPE_LIST,
  type PortfolioTypeId,
} from "@/lib/portfolio/types";
import styles from "./PortfolioTypePicker.module.css";

export default function PortfolioTypePicker({
  value,
  onChange,
  name = "portfolioType",
  promptWhenEmpty = true,
}: {
  value: PortfolioTypeId | null;
  onChange: (next: PortfolioTypeId) => void;
  name?: string;
  promptWhenEmpty?: boolean;
}) {
  return (
    <div>
      {promptWhenEmpty && !value ? (
        <p className={styles.prompt} role="status">
          Vous n’avez pas encore choisi de type. Ce choix oriente les rappels pédagogiques
          (Analyses, Simulations) — il ne calcule aucun score.
        </p>
      ) : null}
      <div className={styles.grid} role="radiogroup" aria-label="Type de portefeuille">
        {PORTFOLIO_TYPE_LIST.map((t) => {
          const selected = value === t.id;
          return (
            <label key={t.id} className={selected ? `${styles.card} ${styles.cardOn}` : styles.card}>
              <input
                type="radio"
                name={name}
                value={t.id}
                checked={selected}
                onChange={() => onChange(t.id)}
                className={styles.radio}
              />
              <span className={styles.label}>{t.label}</span>
              <span className={styles.meta}>
                {t.horizon} · risque {t.risk}
              </span>
              <span className={styles.blurb}>{t.shortBlurb}</span>
              <Link
                href={t.educationHref}
                className={styles.edu}
                onClick={(e) => e.stopPropagation()}
              >
                Lire la fiche Éducation
              </Link>
            </label>
          );
        })}
      </div>
      <p className={styles.foot}>
        <Link href={PORTFOLIO_TYPE_EDUCATION_HREF}>Tous les types de portefeuille</Link>
        {" · "}
        cadre BRVM, règles communes et tableau comparatif
      </p>
    </div>
  );
}
