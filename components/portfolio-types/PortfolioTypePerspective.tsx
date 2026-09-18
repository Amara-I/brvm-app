"use client";

import Link from "next/link";
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
  const d = perspective.def;
  return (
    <section className={compact ? `${styles.card} ${styles.compact}` : styles.card} aria-labelledby="pt-perspective-title">
      <div className={styles.head}>
        <div>
          <p className={styles.kicker}>
            {d.label} · {d.horizon} · risque {d.risk}
          </p>
          <h2 id="pt-perspective-title" className={styles.title}>
            {perspective.headline}
          </h2>
        </div>
        <Link href={perspective.educationHref} className={styles.edu}>
          Lire le guide
        </Link>
      </div>
      <p className={styles.summary}>{perspective.summary}</p>

      <div className={styles.metrics}>
        {perspective.metrics.map((m) => (
          <div key={m.key} className={styles.metric}>
            <span className={styles.metricLabel}>{m.label}</span>
            <span className={TONE[m.tone] ?? styles.toneNeutral}>{m.value}</span>
            <span className={styles.metricHint}>{m.hint}</span>
          </div>
        ))}
      </div>

      {perspective.pocketHint ? <p className={styles.pocket}>{perspective.pocketHint}</p> : null}

      {!compact ? (
        <>
          <div className={styles.cols}>
            <div>
              <h3 className={styles.sub}>Critères à vérifier</h3>
              <ol className={styles.list}>
                {perspective.checklist.map((item) => (
                  <li key={item.slice(0, 40)}>{item}</li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className={styles.sub}>Points de vigilance</h3>
              <ul className={styles.list}>
                {perspective.warnings.map((item) => (
                  <li key={item.slice(0, 40)}>{item}</li>
                ))}
              </ul>
              <h3 className={styles.sub}>Filtres / pistes</h3>
              <ul className={styles.list}>
                {perspective.filterHints.map((item) => (
                  <li key={item.slice(0, 40)}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className={styles.ctas}>
            {perspective.ctas.map((c) => (
              <Link key={c.href + c.label} href={c.href} className={styles.cta}>
                {c.label}
              </Link>
            ))}
          </div>
        </>
      ) : (
        <ul className={styles.compactHints}>
          {perspective.filterHints.slice(0, 3).map((item) => (
            <li key={item.slice(0, 40)}>{item}</li>
          ))}
        </ul>
      )}

      <p className={styles.disclaimer}>{perspective.disclaimer}</p>
    </section>
  );
}
