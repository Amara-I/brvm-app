"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizedPerspective } from "@/lib/i18n/portfolio-type-copy";
import type { AnalysisPerspective } from "@/lib/portfolio-types";
import styles from "./PortfolioTypePerspective.module.css";

const TONE: Record<string, string> = {
  good: styles.toneGood,
  warn: styles.toneWarn,
  bad: styles.toneBad,
  neutral: styles.toneNeutral,
};

export default function PortfolioTypePerspective({
  perspective,
  compact = false,
}: {
  perspective: AnalysisPerspective;
  compact?: boolean;
}) {
  const { t, locale, labels } = useI18n();
  const view = localizedPerspective(perspective, locale, labels);
  const d = view.def;
  return (
    <section className={compact ? `${styles.card} ${styles.compact}` : styles.card} aria-labelledby="pt-perspective-title">
      <div className={styles.head}>
        <div>
          <p className={styles.kicker}>
            {t("portfolio.types.kicker", { label: d.label, horizon: d.horizon, risk: d.risk })}
          </p>
          <h2 id="pt-perspective-title" className={styles.title}>
            {view.headline}
          </h2>
        </div>
        <Link href={view.educationHref} className={styles.edu}>
          {t("portfolio.types.readGuide")}
        </Link>
      </div>
      <p className={styles.summary}>{view.summary}</p>

      <div className={styles.metrics}>
        {view.metrics.map((m) => (
          <div key={m.key} className={styles.metric}>
            <span className={styles.metricLabel}>{m.label}</span>
            <span className={TONE[m.tone] ?? styles.toneNeutral}>{m.value}</span>
            <span className={styles.metricHint}>{m.hint}</span>
          </div>
        ))}
      </div>

      {view.pocketHint ? <p className={styles.pocket}>{view.pocketHint}</p> : null}

      {!compact ? (
        <>
          <div className={styles.cols}>
            <div>
              <h3 className={styles.sub}>{t("portfolio.types.checklist")}</h3>
              <ol className={styles.list}>
                {view.checklist.map((item) => (
                  <li key={item.slice(0, 40)}>{item}</li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className={styles.sub}>{t("portfolio.types.warnings")}</h3>
              <ul className={styles.list}>
                {view.warnings.map((item) => (
                  <li key={item.slice(0, 40)}>{item}</li>
                ))}
              </ul>
              <h3 className={styles.sub}>{t("portfolio.types.filters")}</h3>
              <ul className={styles.list}>
                {view.filterHints.map((item) => (
                  <li key={item.slice(0, 40)}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className={styles.ctas}>
            {view.ctas.map((c) => (
              <Link key={c.href + c.label} href={c.href} className={styles.cta}>
                {c.label}
              </Link>
            ))}
          </div>
        </>
      ) : (
        <ul className={styles.compactHints}>
          {view.filterHints.slice(0, 3).map((item) => (
            <li key={item.slice(0, 40)}>{item}</li>
          ))}
        </ul>
      )}

      <p className={styles.disclaimer}>{view.disclaimer}</p>
    </section>
  );
}
