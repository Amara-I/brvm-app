import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { getI18n } from "@/lib/i18n/get-i18n";
import {
  EDUCATION_THEMES,
  getCategoryForTheme,
  getThemeBySlug,
  termsByTheme,
} from "@/lib/education/catalog";
import { localizeCategory, localizeLevelLabel, localizeTerm, localizeTheme } from "@/lib/education/localize";
import {
  COMMON_PORTFOLIO_RULES,
  PORTFOLIO_TYPE_COMPARISON_HEADERS,
  PORTFOLIO_TYPE_COMPARISON_ROWS,
  PORTFOLIO_TYPE_THEME_SLUG,
} from "@/lib/portfolio-types";
import styles from "@/components/education/Education.module.css";

export function generateStaticParams() {
  return EDUCATION_THEMES.map((theme) => ({ theme: theme.slug }));
}

export function generateMetadata({ params }: { params: { theme: string } }) {
  const { t, locale } = getI18n();
  const theme = getThemeBySlug(params.theme);
  const localized = theme ? localizeTheme(theme, locale) : undefined;
  return {
    title: localized
      ? t("education.metaTitleWith", { title: localized.title })
      : t("education.metaTitle"),
    description: localized?.blurb,
  };
}

export default function EducationThemePage({ params }: { params: { theme: string } }) {
  const { t, locale } = getI18n();
  const rawTheme = getThemeBySlug(params.theme);
  if (!rawTheme) notFound();
  const theme = localizeTheme(rawTheme, locale);
  const terms = termsByTheme(theme.slug).map((term) => localizeTerm(term, locale));
  const rawCategory = getCategoryForTheme(theme.slug);
  const category = rawCategory ? localizeCategory(rawCategory, locale) : undefined;
  return (
    <AppHeader>
      <div className={styles.page}>
        <nav className={styles.crumb} aria-label={t("education.crumbLabel")}>
          <Link href="/">{t("education.home")}</Link>
          {" · "}
          <Link href="/education">{t("education.title")}</Link>
          {category && (
            <>
              {" · "}
              <Link href={`/education#${category.slug}`}>{category.title}</Link>
            </>
          )}
          {" · "}
          {theme.title}
        </nav>
        <h1 className={styles.h1}>{theme.title}</h1>
        <p className={styles.lead}>{theme.blurb}</p>
        <p className={styles.disclaimer}>
          {t(terms.length > 1 ? "education.themeDisclaimerMany" : "education.themeDisclaimerOne", {
            count: terms.length,
            category: category ? t("education.categoryInline", { title: category.title }) : "",
          })}
        </p>
        {theme.slug === "taille-position" && (
          <p style={{ margin: "0 0 18px" }}>
            <Link href="/outils/taille-position?example=sogb" className={styles.cta}>
              {t("education.openPositionCalc")}
            </Link>
          </p>
        )}
        {theme.slug === PORTFOLIO_TYPE_THEME_SLUG && (
          <div className={styles.hubCompare}>
            <p className={styles.sectionLabel}>{t("education.comparisonTable")}</p>
            <figure className={styles.tableWrap}>
              <div className={styles.tableScroll}>
                <table className={styles.articleTable}>
                  <thead>
                    <tr>
                      {PORTFOLIO_TYPE_COMPARISON_HEADERS.map((h) => (
                        <th key={h} scope="col">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PORTFOLIO_TYPE_COMPARISON_ROWS.map((row) => (
                      <tr key={row[0]}>
                        {row.map((cell, i) => (
                          <td key={`${row[0]}-${i}`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </figure>
            <p className={styles.sectionLabel} style={{ marginTop: 18 }}>
              {t("education.commonRules")}
            </p>
            <ul className={styles.articleList}>
              {COMMON_PORTFOLIO_RULES.map((rule) => (
                <li key={rule.slice(0, 40)}>{rule}</li>
              ))}
            </ul>
          </div>
        )}
        <ul className={styles.termList}>
          {terms.map((term) => (
            <li key={term.slug}>
              <Link href={`/education/${theme.slug}/${term.slug}`} className={styles.termRow}>
                <span className={styles.badge}>{localizeLevelLabel(term.level, locale)}</span>
                {term.source === "plateforme" && <span className={styles.badge}>{t("education.badgePlatform")}</span>}
                <p className={styles.termTitle}>{term.title}</p>
                <p className={styles.termDef}>{term.definition}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
