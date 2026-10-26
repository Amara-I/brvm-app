"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getAllEducationTerms,
  countTermsByCategory,
  countTermsByTheme,
  getCategoryForTheme,
  getThemeBySlug,
  themesByCategory,
  type EducationLevel,
  type EducationTerm,
} from "@/lib/education/catalog";
import {
  localizeCategories,
  localizeCategory,
  localizeLevelLabel,
  localizeTerm,
  localizeTheme,
  rankEducationForLocale,
} from "@/lib/education/localize";
import { useI18n } from "@/components/i18n/I18nProvider";
import styles from "./Education.module.css";

export default function EducationHubClient() {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<EducationLevel | "tous">("tous");
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const categories = localizeCategories(locale);

  const ranked = useMemo(() => {
    const base = q.trim()
      ? rankEducationForLocale(q, locale)
      : getAllEducationTerms().map((term) => ({
          ...term,
          score: 0,
          matchField: "title" as const,
        }));
    const visible = level === "tous" ? base : base.filter((term) => term.level === level);
    return visible.map((term) => ({ ...localizeTerm(term, locale), score: term.score, matchField: term.matchField }));
  }, [q, level, locale]);

  const searching = Boolean(q.trim());
  const showBrowse = !searching && level === "tous";

  useEffect(() => {
    setActive(0);
  }, [q, level]);

  const openTerm = (t: EducationTerm) => {
    router.push(`/education/${t.themeSlug}/${t.slug}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searching || ranked.length === 0) {
      if (e.key === "Escape" && q) {
        setQ("");
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(ranked.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = ranked[active] ?? ranked[0];
      if (hit) openTerm(hit);
    } else if (e.key === "Escape") {
      setQ("");
      e.preventDefault();
    }
  };

  const suggestions = [
    t("education.suggestions.per"),
    t("education.suggestions.rsi"),
    t("education.suggestions.dividend"),
    t("education.suggestions.risk"),
    t("education.suggestions.size"),
    t("education.suggestions.types"),
    t("education.suggestions.signal"),
    t("education.suggestions.var"),
  ];

  return (
    <div className={styles.page}>
      <nav className={styles.crumb} aria-label={t("education.crumbLabel")}>
        <Link href="/">{t("education.home")}</Link> · {t("education.title")}
      </nav>
      <h1 className={styles.h1}>{t("education.title")}</h1>
      <p className={styles.lead}>{t("education.hubLead")}</p>
      <p className={styles.disclaimer}>{t("education.hubDisclaimer")}</p>

      <div className={styles.searchBlock}>
        <label className={styles.searchLabel} htmlFor="education-search">
          {t("education.searchLabel")}
        </label>
        <input
          id="education-search"
          ref={inputRef}
          className={styles.search}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("education.searchPlaceholder")}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={searching}
          aria-controls={listId}
          aria-activedescendant={searching && ranked[active] ? `${listId}-${ranked[active]!.slug}` : undefined}
        />
        <p className={styles.searchHint}>{t("education.searchHint")}</p>
      </div>

      <div className={styles.levelRow} role="group" aria-label={t("education.filterLevel")}>
        {(
          [
            ["tous", t("education.allLevels")],
            ["debutant", localizeLevelLabel("debutant", locale)],
            ["intermediaire", localizeLevelLabel("intermediaire", locale)],
            ["avance", localizeLevelLabel("avance", locale)],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={level === key ? styles.levelChipOn : styles.levelChip}
            aria-pressed={level === key}
            onClick={() => setLevel(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {showBrowse && (
        <>
          <nav className={styles.levelRow} aria-label={t("education.jumpCategory")}>
            {categories.map((cat) => (
              <a key={cat.slug} href={`#${cat.slug}`} className={styles.levelChip}>
                {cat.title}
              </a>
            ))}
          </nav>

          {categories.map((cat) => {
            const themes = themesByCategory(cat.slug).map((theme) => localizeTheme(theme, locale));
            const sheetCount = countTermsByCategory(cat.slug);
            return (
              <section key={cat.slug} id={cat.slug} className={styles.categorySection}>
                <h2 className={styles.categoryHead}>{cat.title}</h2>
                <p className={styles.categoryBlurb}>{cat.blurb}</p>
                <p className={styles.categoryMeta}>
                  {t("education.categoryMeta", {
                    themes: themes.length,
                    themeWord: t(themes.length > 1 ? "education.themeMany" : "education.themeOne"),
                    sheets: sheetCount,
                    sheetWord: t(sheetCount > 1 ? "education.sheetMany" : "education.sheetOne"),
                  })}
                </p>
                <div className={styles.themeGrid}>
                  {themes.map((theme) => (
                    <Link key={theme.slug} href={`/education/${theme.slug}`} className={styles.themeCard}>
                      <p className={styles.themeTitle}>{theme.title}</p>
                      <p className={styles.themeMeta}>
                        {t(
                          countTermsByTheme(theme.slug) === 1
                            ? "education.themeCardCountOne"
                            : "education.themeCardCountMany",
                          { count: countTermsByTheme(theme.slug) }
                        )}
                      </p>
                      <p className={styles.themeBlurb}>{theme.blurb}</p>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}

      <h2 className={styles.themeTitle} style={{ marginBottom: 12 }}>
        {searching || level !== "tous"
          ? t("education.results", { count: ranked.length })
          : t("education.allSheets", { count: ranked.length })}
      </h2>
      {ranked.length === 0 ? (
        <div className={styles.emptyBox} role="status">
          <p className={styles.emptyTitle}>{t("education.emptyTitle", { query: q.trim() })}</p>
          <p className={styles.empty}>{t("education.emptyBody")}</p>
          <p className={styles.emptySuggestLabel}>{t("education.suggestionsLabel")}</p>
          <div className={styles.levelRow}>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className={styles.levelChip}
                onClick={() => {
                  setQ(s);
                  inputRef.current?.focus();
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ul className={styles.termList} id={listId} role={searching ? "listbox" : undefined}>
          {ranked.map((term, i) => {
            const rawTheme = getThemeBySlug(term.themeSlug);
            const rawCategory = getCategoryForTheme(term.themeSlug);
            const themeTitle = rawTheme ? localizeTheme(rawTheme, locale).title : term.themeSlug;
            const categoryTitle = rawCategory ? localizeCategory(rawCategory, locale).title : "";
            const selected = searching && i === active;
            return (
              <li key={term.slug} role={searching ? "option" : undefined} id={`${listId}-${term.slug}`} aria-selected={selected}>
                <Link
                  href={`/education/${term.themeSlug}/${term.slug}`}
                  className={selected ? `${styles.termRow} ${styles.termRowActive}` : styles.termRow}
                  onMouseEnter={() => searching && setActive(i)}
                >
                  <span className={styles.badge}>{localizeLevelLabel(term.level, locale)}</span>
                  {categoryTitle ? <span className={styles.badge}>{categoryTitle}</span> : null}
                  <span className={styles.badge}>{themeTitle}</span>
                  <p className={styles.termTitle}>{term.title}</p>
                  <p className={styles.termDef}>{term.definition}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
