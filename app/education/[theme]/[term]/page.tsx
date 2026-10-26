import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import EducationIllustration from "@/components/education/EducationIllustration";
import EducationBackLink from "@/components/education/EducationBackLink";
import EducationArticleBlocks from "@/components/education/EducationArticleBlocks";
import SiteFooter from "@/components/layout/SiteFooter";
import { getI18n } from "@/lib/i18n/get-i18n";
import {
  EDUCATION_TERMS,
  getCategoryForTheme,
  getTermBySlug,
  getThemeBySlug,
} from "@/lib/education/catalog";
import {
  isEducationTermTranslated,
  localizeCategory,
  localizeLevelLabel,
  localizeTerm,
  localizeTheme,
} from "@/lib/education/localize";
import styles from "@/components/education/Education.module.css";

export function generateStaticParams() {
  return EDUCATION_TERMS.map((term) => ({ theme: term.themeSlug, term: term.slug }));
}

export function generateMetadata({ params }: { params: { theme: string; term: string } }) {
  const { t, locale } = getI18n();
  const term = getTermBySlug(params.term);
  const localized = term ? localizeTerm(term, locale) : undefined;
  return {
    title: localized
      ? t("education.metaTitleWith", { title: localized.title })
      : t("education.metaTitle"),
    description: localized?.definition,
  };
}

export default function EducationTermPage({
  params,
}: {
  params: { theme: string; term: string };
}) {
  const { t, locale } = getI18n();
  const rawTheme = getThemeBySlug(params.theme);
  const rawTerm = getTermBySlug(params.term);
  if (!rawTheme || !rawTerm || rawTerm.themeSlug !== rawTheme.slug) notFound();
  const theme = localizeTheme(rawTheme, locale);
  const term = localizeTerm(rawTerm, locale);
  const rawCategory = getCategoryForTheme(theme.slug);
  const category = rawCategory ? localizeCategory(rawCategory, locale) : undefined;
  const translated = isEducationTermTranslated(term.slug, locale);

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
          <Link href={`/education/${theme.slug}`}>{theme.title}</Link>
          {" · "}
          {term.title}
        </nav>

        <article className={styles.fiche}>
          <span className={styles.badge}>{localizeLevelLabel(term.level, locale)}</span>
          {category && <span className={styles.badge}>{category.title}</span>}
          <span className={styles.badge}>{theme.title}</span>
          {term.source === "plateforme" && <span className={styles.badge}>{t("education.badgePlatform")}</span>}
          <h1 className={styles.h1} style={{ marginTop: 8 }}>
            {term.title}
          </h1>
          {!translated ? <p className={styles.disclaimer}>{t("education.untranslatedNotice")}</p> : null}

          <p className={styles.sectionLabel}>{t("education.definition")}</p>
          <p className={styles.sectionBody}>{term.definition}</p>

          {term.blocks && term.blocks.length > 0 ? (
            <>
              <p className={styles.sectionLabel}>{t("education.details")}</p>
              <EducationArticleBlocks blocks={term.blocks} />
            </>
          ) : term.details ? (
            <>
              <p className={styles.sectionLabel}>{t("education.details")}</p>
              <div className={styles.sectionBody}>
                {term.details.split("\n\n").map((para) => (
                  <p key={para.slice(0, 48)} style={{ margin: "0 0 10px" }}>
                    {para}
                  </p>
                ))}
              </div>
            </>
          ) : null}

          {term.illustration && (
            <>
              <p className={styles.sectionLabel}>{t("education.illustration")}</p>
              <EducationIllustration id={term.illustration} />
            </>
          )}

          <p className={styles.sectionLabel}>{t("education.example")}</p>
          <div className={styles.exampleBox}>{term.example}</div>

          {term.synonyms.length > 0 && (
            <>
              <p className={styles.sectionLabel}>{t("education.synonyms")}</p>
              <p className={styles.sectionBody}>{term.synonyms.join(" · ")}</p>
            </>
          )}

          {term.tip && (
            <>
              <p className={styles.sectionLabel}>{t("education.takeaway")}</p>
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
              <p className={styles.sectionLabel}>{t("education.sources")}</p>
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
              <p className={styles.sectionLabel}>{t("education.resource")}</p>
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
              <p className={styles.sectionLabel}>{t("education.related")}</p>
              <ul className={styles.relatedList}>
                {term.relatedSlugs.map((rel) => {
                  const other = getTermBySlug(rel);
                  if (!other) return null;
                  const localizedOther = localizeTerm(other, locale);
                  return (
                    <li key={rel}>
                      <Link
                        href={`/education/${other.themeSlug}/${other.slug}`}
                        className={styles.relatedChip}
                      >
                        {localizedOther.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </article>

        <p className={styles.disclaimer} style={{ marginTop: 18 }}>
          {t("education.articleDisclaimer")}
        </p>

        <EducationBackLink
          fallbackHref={`/education/${theme.slug}`}
          fallbackLabel={t("education.backToTheme", { title: theme.title })}
        />
      </div>
      <SiteFooter />
    </AppHeader>
  );
}
