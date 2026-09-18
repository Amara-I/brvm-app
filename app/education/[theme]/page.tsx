import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { C } from "@/lib/theme/colors";
import {
  EDUCATION_LEVEL_LABELS,
  EDUCATION_THEMES,
  getCategoryForTheme,
  getThemeBySlug,
  termsByTheme,
} from "@/lib/education/catalog";
import {
  COMMON_PORTFOLIO_RULES,
  PORTFOLIO_TYPE_COMPARISON_HEADERS,
  PORTFOLIO_TYPE_COMPARISON_ROWS,
  PORTFOLIO_TYPE_THEME_SLUG,
} from "@/lib/portfolio-types";
import styles from "@/components/education/Education.module.css";

export function generateStaticParams() {
  return EDUCATION_THEMES.map((t) => ({ theme: t.slug }));
}

export function generateMetadata({ params }: { params: { theme: string } }) {
  const theme = getThemeBySlug(params.theme);
  return {
    title: theme ? `${theme.title} — Éducation · OuestBourse` : "Éducation — OuestBourse",
    description: theme?.blurb,
  };
}

export default function EducationThemePage({ params }: { params: { theme: string } }) {
  const theme = getThemeBySlug(params.theme);
  if (!theme) notFound();
  const terms = termsByTheme(theme.slug);
  const category = getCategoryForTheme(theme.slug);

  return (
    <AppHeader>
      <div className={styles.page}>
        <nav className={styles.crumb} aria-label="Fil d'Ariane">
          <Link href="/">Accueil</Link>
          {" · "}
          <Link href="/education">Éducation</Link>
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
          Contenu pédagogique — pas un conseil d&apos;investissement. {terms.length} fiche
          {terms.length > 1 ? "s" : ""} dans ce thème
          {category ? ` · catégorie ${category.title}` : ""}.
        </p>
        {theme.slug === "taille-position" && (
          <p style={{ margin: "0 0 18px" }}>
            <Link href="/outils/taille-position?example=sogb" className={styles.cta}>
              Ouvrir la calculette de taille de position
            </Link>
          </p>
        )}
        {theme.slug === PORTFOLIO_TYPE_THEME_SLUG && (
          <div className={styles.hubCompare}>
            <p className={styles.sectionLabel}>Tableau comparatif</p>
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
              Règles communes
            </p>
            <ul className={styles.articleList}>
              {COMMON_PORTFOLIO_RULES.map((rule) => (
                <li key={rule.slice(0, 40)}>{rule}</li>
              ))}
            </ul>
          </div>
        )}
        <ul className={styles.termList}>
          {terms.map((t) => (
            <li key={t.slug}>
              <Link href={`/education/${theme.slug}/${t.slug}`} className={styles.termRow}>
                <span className={styles.badge}>{EDUCATION_LEVEL_LABELS[t.level]}</span>
                {t.source === "plateforme" && <span className={styles.badge}>OuestBourse</span>}
                <p className={styles.termTitle}>{t.title}</p>
                <p className={styles.termDef}>{t.definition}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
