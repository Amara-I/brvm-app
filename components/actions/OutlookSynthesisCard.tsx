"use client";

// Perspectives d'avenir (fiche BRVM) : synthèse sourcée lue dans profile_meta.brvmOutlook.
// Chaque élément affiche sa date, sa source cliquable et son niveau de fiabilité ; aucun chiffre n'est calculé ici.

import { useI18n } from "@/components/i18n/I18nProvider";
import { outlookSummary, outlookText, type OutlookItem, type OutlookSynthesis } from "@/lib/outlook/synthesis";
import styles from "./OutlookSynthesisCard.module.css";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export default function OutlookSynthesisCard({ synthesis }: { synthesis: OutlookSynthesis | null }) {
  const { t, format, locale } = useI18n();
  const lang: "fr" | "en" = locale === "en" ? "en" : "fr";
  const day = (iso: string) => format.date(new Date(`${iso}T12:00:00.000Z`), { day: "numeric", month: "short", year: "numeric" });

  const head = (
    <div className={styles.head}>
      <h2 className={styles.title}>{t("company.outlook.title")}</h2>
      {synthesis?.updatedAt ? (
        <span className={styles.meta}>{t("company.outlook.updatedOn", { date: day(synthesis.updatedAt.slice(0, 10)) })}</span>
      ) : null}
    </div>
  );

  if (!synthesis) {
    return (
      <section className={styles.card} id="perspectives" aria-labelledby="outlook-empty-title">
        {head}
        <p className={styles.empty} id="outlook-empty-title">{t("company.outlook.empty")}</p>
      </section>
    );
  }

  const summary = outlookSummary(synthesis, lang);
  const analysts = synthesis.items.filter((i) => i.type === "analyst");
  const others = synthesis.items.filter((i) => i.type !== "analyst");
  const when = (i: OutlookItem) =>
    i.date ? (ISO_DAY.test(i.date) ? day(i.date) : i.date) : t("company.outlook.noDate");

  const line = (i: OutlookItem, key: string) => (
    <li key={key} className={styles.item}>
      <span className={styles.tags}>
        <span className={styles.badge}>{t(`company.outlook.types.${i.type}`)}</span>
        {i.confidence ? (
          <span
            className={`${styles.badge} ${i.confidence === "high" ? styles.good : i.confidence === "medium" ? styles.mid : styles.low}`}
            title={t("company.outlook.confidenceLabel")}
          >
            {t(`company.outlook.confidence.${i.confidence}`)}
          </span>
        ) : null}
      </span>
      <span className={styles.itemText}>{outlookText(i, lang)}</span>
      <span className={styles.meta}>
        {t("company.outlook.sourceLine", { source: i.sourceName ?? "—", date: when(i) })}
        {i.url ? (
          <>
            {" · "}
            <a className={styles.link} href={i.url} target="_blank" rel="noopener noreferrer">
              {t("company.outlook.open")} ↗
            </a>
          </>
        ) : null}
      </span>
    </li>
  );

  return (
    <section className={styles.card} id="perspectives">
      {head}
      <p className={styles.lead}>{t("company.outlook.lead")}</p>
      {summary.bullets.length > 0 ? (
        <div className={styles.block}>
          <h3 className={styles.blockTitle}>{t("company.outlook.keyPointsTitle")}</h3>
          <ul className={styles.list}>
            {summary.bullets.map((b, idx) => (
              <li key={`b-${idx}`}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {summary.watch.length > 0 ? (
        <div className={`${styles.block} ${styles.watch}`}>
          <h3 className={styles.blockTitle}>{t("company.outlook.watchTitle")}</h3>
          <ul className={styles.list}>
            {summary.watch.map((w, idx) => (
              <li key={`w-${idx}`}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <h3 className={styles.blockTitle}>{t("company.outlook.analystsTitle")}</h3>
      {analysts.length === 0 ? (
        <p className={styles.empty}>{t("company.outlook.analystsEmpty")}</p>
      ) : (
        <ul className={styles.items}>{analysts.map((i, idx) => line(i, `a-${idx}`))}</ul>
      )}
      {others.length > 0 ? (
        <details className={styles.more}>
          <summary>{t("company.outlook.sourcesTitle", { count: others.length })}</summary>
          <ul className={styles.items}>{others.map((i, idx) => line(i, `o-${idx}`))}</ul>
        </details>
      ) : null}
    </section>
  );
}
