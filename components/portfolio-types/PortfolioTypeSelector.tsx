"use client";

import Link from "next/link";
import { PORTFOLIO_TYPE_LIST, PORTFOLIO_TYPE_THEME_SLUG, type PortfolioTypeId } from "@/lib/portfolio-types";
import styles from "./PortfolioTypeSelector.module.css";

export default function PortfolioTypeSelector({
  value,
  onChange,
  profileDefault = null,
  isOverride = false,
  onResetToProfile,
  compact = false,
  idPrefix = "pt",
}: {
  value: PortfolioTypeId;
  onChange: (next: PortfolioTypeId) => void;
  profileDefault?: PortfolioTypeId | null;
  isOverride?: boolean;
  onResetToProfile?: () => void;
  compact?: boolean;
  idPrefix?: string;
}) {
  const hubHref = `/education/${PORTFOLIO_TYPE_THEME_SLUG}`;
  return (
    <div className={compact ? `${styles.wrap} ${styles.wrapCompact}` : styles.wrap}>
      <div className={styles.head}>
        <p className={styles.label} id={`${idPrefix}-label`}>
          Type de portefeuille
        </p>
        <Link href={hubHref} className={styles.eduLink}>
          Éducation — Types de portefeuille
        </Link>
      </div>
      <div className={styles.chips} role="radiogroup" aria-labelledby={`${idPrefix}-label`}>
        {PORTFOLIO_TYPE_LIST.map((d) => {
          const selected = d.id === value;
          return (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={selected ? styles.chipOn : styles.chip}
              onClick={() => onChange(d.id)}
            >
              {d.label}
            </button>
          );
        })}
      </div>
      <p className={styles.meta}>
        {PORTFOLIO_TYPE_LIST.find((d) => d.id === value)?.tagline}
        {profileDefault ? (
          <>
            {" "}
            · Préférence profil : {PORTFOLIO_TYPE_LIST.find((d) => d.id === profileDefault)?.label ?? "N/D"}
            {isOverride && onResetToProfile ? (
              <>
                {" "}
                <button type="button" className={styles.reset} onClick={onResetToProfile}>
                  Revenir au profil
                </button>
              </>
            ) : null}
          </>
        ) : null}
      </p>
    </div>
  );
}
