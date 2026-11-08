import { EDUCATION_THEMES, getAllEducationTerms } from "@/lib/education/catalog";
import { localizeTerm, localizeTheme } from "@/lib/education/localize";
import { EDUCATION_SEARCH_ALIASES } from "@/lib/education/search";
import type { SiteSearchDocument } from "@/lib/search/types";

function aliasesBySlug(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const [alias, slugs] of Object.entries(EDUCATION_SEARCH_ALIASES)) {
    for (const slug of slugs) {
      const list = map.get(slug);
      if (list) list.push(alias);
      else map.set(slug, [alias]);
    }
  }
  return map;
}

function unique(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = value?.trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

/** Glossaire, thèmes, leçons et guides (types de portefeuille inclus). */
export function educationDocuments(): SiteSearchDocument[] {
  const aliasMap = aliasesBySlug();
  const themes = new Map(EDUCATION_THEMES.map((theme) => [theme.slug, theme]));
  const docs: SiteSearchDocument[] = [
    {
      id: "education:hub",
      kind: "education",
      title: "Éducation",
      titleEn: "Education",
      subtitle: "Glossaire, leçons et guides",
      subtitleEn: "Glossary, lessons and guides",
      href: "/education",
      keywords: ["glossaire", "glossary", "lecon", "lesson", "guide", "tutoriel", "education"],
    },
  ];

  for (const theme of EDUCATION_THEMES) {
    const english = localizeTheme(theme, "en");
    docs.push({
      id: `education:theme:${theme.slug}`,
      kind: "education",
      title: theme.title,
      titleEn: english.title !== theme.title ? english.title : undefined,
      subtitle: "Éducation",
      subtitleEn: "Education",
      href: `/education/${theme.slug}`,
      keywords: unique([theme.blurb, english.blurb]),
    });
  }

  for (const term of getAllEducationTerms()) {
    const english = localizeTerm(term, "en");
    const theme = themes.get(term.themeSlug);
    const themeEn = theme ? localizeTheme(theme, "en") : undefined;
    docs.push({
      id: `education:term:${term.slug}`,
      kind: "education",
      title: term.title,
      titleEn: english.title !== term.title ? english.title : undefined,
      subtitle: theme?.title,
      subtitleEn: themeEn && theme && themeEn.title !== theme.title ? themeEn.title : undefined,
      href: `/education/${term.themeSlug}/${term.slug}`,
      keywords: unique([
        ...term.synonyms,
        ...(english.synonyms ?? []),
        english.title,
        term.definition.slice(0, 180),
        ...(aliasMap.get(term.slug) ?? []),
      ]),
    });
  }

  return docs;
}
