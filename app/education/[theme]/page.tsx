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
