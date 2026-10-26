"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizedTypeDef } from "@/lib/i18n/portfolio-type-copy";
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
  const { t, locale } = useI18n();
  const hubHref = `/education/${PORTFOLIO_TYPE_THEME_SLUG}`;
  const list = PORTFOLIO_TYPE_LIST.map((item) => localizedTypeDef(item, locale));
  const current = list.find((item) => item.id === value);
  const profile = profileDefault ? list.find((item) => item.id === profileDefault) : undefined;
  return (
    <div className={compact ? `${styles.wrap} ${styles.wrapCompact}` : styles.wrap}>
      <div className={styles.head}>
        <p className={styles.label} id={`${idPrefix}-label`}>
          {t("portfolio.types.label")}
        </p>
        <Link href={hubHref} className={styles.eduLink}>
          {t("portfolio.types.education")}
        </Link>
      </div>
      <div className={styles.chips} role="radiogroup" aria-labelledby={`${idPrefix}-label`}>
        {list.map((d) => {
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
        {current?.tagline}
        {profileDefault ? (
          <>
            {" "}
            · {t("portfolio.types.profile", { label: profile?.label ?? "N/D" })}
            {isOverride && onResetToProfile ? (
              <>
                {" "}
                <button type="button" className={styles.reset} onClick={onResetToProfile}>
                  {t("portfolio.types.reset")}
                </button>
              </>
            ) : null}
          </>
        ) : null}
      </p>
    </div>
  );
}
