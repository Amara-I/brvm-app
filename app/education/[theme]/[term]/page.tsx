import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import EducationIllustration from "@/components/education/EducationIllustration";
import EducationBackLink from "@/components/education/EducationBackLink";
import SiteFooter from "@/components/layout/SiteFooter";
import {
  EDUCATION_LEVEL_LABELS,
  EDUCATION_TERMS,
  getCategoryForTheme,
  getTermBySlug,
  getThemeBySlug,
} from "@/lib/education/catalog";
import styles from "@/components/education/Education.module.css";

export function generateStaticParams() {
  return EDUCATION_TERMS.map((t) => ({ theme: t.themeSlug, term: t.slug }));
}

export function generateMetadata({ params }: { params: { theme: string; term: string } }) {
  const term = getTermBySlug(params.term);
  return {
    title: term ? `${term.title} — Éducation · OuestBourse` : "Éducation — OuestBourse",
    description: term?.definition,
  };
}

export default function EducationTermPage({
  params,
}: {
  params: { theme: string; term: string };
}) {
  const theme = getThemeBySlug(params.theme);
  const term = getTermBySlug(params.term);
  if (!theme || !term || term.themeSlug !== theme.slug) notFound();
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
          <Link href={`/education/${theme.slug}`}>{theme.title}</Link>
          {" · "}
          {term.title}
        </nav>

        <article className={styles.fiche}>
          <span className={styles.badge}>{EDUCATION_LEVEL_LABELS[term.level]}</span>
          {category && <span className={styles.badge}>{category.title}</span>}
          <span className={styles.badge}>{theme.title}</span>
          {term.source === "plateforme" && <span className={styles.badge}>OuestBourse</span>}
          <h1 className={styles.h1} style={{ marginTop: 8 }}>
            {term.title}
          </h1>

          <p className={styles.sectionLabel}>Définition</p>
          <p className={styles.sectionBody}>{term.definition}</p>

          {term.details && (
            <>
              <p className={styles.sectionLabel}>En détail</p>
              <div className={styles.sectionBody}>
                {term.details.split("\n\n").map((para) => (
                  <p key={para.slice(0, 48)} style={{ margin: "0 0 10px" }}>
                    {para}
                  </p>
                ))}
              </div>
            </>
          )}

          {term.illustration && (
            <>
              <p className={styles.sectionLabel}>Illustration</p>
              <EducationIllustration id={term.illustration} />
            </>
          )}

          <p className={styles.sectionLabel}>Exemple</p>
          <div className={styles.exampleBox}>{term.example}</div>

          {term.synonyms.length > 0 && (
            <>
              <p className={styles.sectionLabel}>Synonymes</p>
              <p className={styles.sectionBody}>{term.synonyms.join(" · ")}</p>
            </>
          )}

          {term.tip && (
            <>
              <p className={styles.sectionLabel}>À retenir</p>
              <p className={styles.tip}>{term.tip}</p>
            </>
          )}

          {term.ctaHref && term.ctaLabel && (
            <p style={{ marginTop: 18 }}>
              <Link href={term.ctaHref} className={styles.cta}>
                {term.ctaLabel}
              </Link>
            </p>
          )}

          {term.sources && term.sources.length > 0 ? (
            <>
              <p className={styles.sectionLabel}>Sources</p>
              <ul className={styles.sourceList}>
                {term.sources.map((s) => (
                  <li key={s.url}>
                    <a
                      className={styles.extLink}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : term.resourceUrl ? (
            <>
              <p className={styles.sectionLabel}>Ressource</p>
              <a
                className={styles.extLink}
                href={term.resourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {term.resourceUrl}
              </a>
            </>
          ) : null}
          {term.relatedSlugs && term.relatedSlugs.length > 0 ? (
            <>
              <p className={styles.sectionLabel}>Pour aller plus loin</p>
              <ul className={styles.relatedList}>
                {term.relatedSlugs.map((rel) => {
                  const other = getTermBySlug(rel);
                  if (!other) return null;
                  return (
                    <li key={rel}>
                      <Link
                        href={`/education/${other.themeSlug}/${other.slug}`}
                        className={styles.relatedChip}
                      >
                        {other.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </article>

        <p className={styles.disclaimer} style={{ marginTop: 18 }}>
          Support pédagogique. Ne remplace ni le prospectus, ni les états financiers, ni le conseil
          d&apos;un professionnel agréé.
        </p>

        <EducationBackLink
          fallbackHref={`/education/${theme.slug}`}
          fallbackLabel={`Retour au thème ${theme.title}`}
        />
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
