"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  EDUCATION_CATEGORIES,
  EDUCATION_LEVEL_LABELS,
  getAllEducationTerms,
  countTermsByCategory,
  countTermsByTheme,
  themesByCategory,
  type EducationLevel,
  type EducationTerm,
} from "@/lib/education/catalog";
import {
  educationSearchSuggestions,
  rankEducationSearch,
  searchHitMeta,
} from "@/lib/education/search";
import styles from "./Education.module.css";

export default function EducationHubClient() {
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<EducationLevel | "tous">("tous");
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const ranked = useMemo(() => {
    const base = q.trim() ? rankEducationSearch(q) : getAllEducationTerms().map((t) => ({
      ...t,
      score: 0,
      matchField: "title" as const,
    }));
    if (level === "tous") return base;
    return base.filter((t) => t.level === level);
  }, [q, level]);

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

  const suggestions = educationSearchSuggestions();

  return (
    <div className={styles.page}>
      <nav className={styles.crumb} aria-label="Fil d'Ariane">
        <Link href="/">Accueil</Link> · Éducation
      </nav>
      <h1 className={styles.h1}>Éducation</h1>
      <p className={styles.lead}>
        Parcours par catégories — Bases, Analyse, Risques et Application — pour comprendre la BRVM
        et utiliser OuestBourse sans confondre pédagogie et conseil d&apos;investissement.
      </p>
      <p className={styles.disclaimer}>
        Contenu pédagogique uniquement. Les exemples sont illustratifs et ne constituent pas une
        recommandation d&apos;investissement. Vérifiez toujours les sources officielles (BRVM, états
        financiers, SGI).
      </p>

      <div className={styles.searchBlock}>
        <label className={styles.searchLabel} htmlFor="education-search">
          Rechercher un terme
        </label>
        <input
          id="education-search"
          ref={inputRef}
          className={styles.search}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ex. PER, RSI, types de portefeuille, dividende…"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={searching}
          aria-controls={listId}
          aria-activedescendant={searching && ranked[active] ? `${listId}-${ranked[active]!.slug}` : undefined}
        />
        <p className={styles.searchHint}>
          Accents ignorés · mots partiels · flèches puis Entrée pour ouvrir une fiche
        </p>
      </div>

      <div className={styles.levelRow} role="group" aria-label="Filtrer par niveau">
        {(
          [
            ["tous", "Tous niveaux"],
            ["debutant", EDUCATION_LEVEL_LABELS.debutant],
            ["intermediaire", EDUCATION_LEVEL_LABELS.intermediaire],
            ["avance", EDUCATION_LEVEL_LABELS.avance],
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
          <nav className={styles.levelRow} aria-label="Aller à une catégorie">
            {EDUCATION_CATEGORIES.map((cat) => (
              <a key={cat.slug} href={`#${cat.slug}`} className={styles.levelChip}>
                {cat.title}
              </a>
            ))}
          </nav>

          {EDUCATION_CATEGORIES.map((cat) => {
            const themes = themesByCategory(cat.slug);
            return (
              <section key={cat.slug} id={cat.slug} className={styles.categorySection}>
                <h2 className={styles.categoryHead}>{cat.title}</h2>
                <p className={styles.categoryBlurb}>{cat.blurb}</p>
                <p className={styles.categoryMeta}>
                  {themes.length} thème{themes.length > 1 ? "s" : ""} · {countTermsByCategory(cat.slug)}{" "}
                  fiche{countTermsByCategory(cat.slug) > 1 ? "s" : ""}
                </p>
                <div className={styles.themeGrid}>
                  {themes.map((theme) => (
                    <Link key={theme.slug} href={`/education/${theme.slug}`} className={styles.themeCard}>
                      <p className={styles.themeTitle}>{theme.title}</p>
                      <p className={styles.themeMeta}>{countTermsByTheme(theme.slug)} fiches</p>
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
          ? `Résultats (${ranked.length})`
          : `Toutes les fiches (${ranked.length})`}
      </h2>
      {ranked.length === 0 ? (
        <div className={styles.emptyBox} role="status">
          <p className={styles.emptyTitle}>Aucun terme ne correspond à « {q.trim()} »</p>
          <p className={styles.empty}>
            Essayez un mot plus court, un sigle (PER, RSI, VaR) ou un synonyme. Les accents ne sont
            pas obligatoires.
          </p>
          <p className={styles.emptySuggestLabel}>Suggestions</p>
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
          {ranked.map((t, i) => {
            const meta = searchHitMeta(t);
            const selected = searching && i === active;
            return (
              <li key={t.slug} role={searching ? "option" : undefined} id={`${listId}-${t.slug}`} aria-selected={selected}>
                <Link
                  href={`/education/${t.themeSlug}/${t.slug}`}
                  className={selected ? `${styles.termRow} ${styles.termRowActive}` : styles.termRow}
                  onMouseEnter={() => searching && setActive(i)}
                >
                  <span className={styles.badge}>{EDUCATION_LEVEL_LABELS[t.level]}</span>
                  {meta.categoryTitle ? <span className={styles.badge}>{meta.categoryTitle}</span> : null}
                  <span className={styles.badge}>{meta.themeTitle}</span>
                  <p className={styles.termTitle}>{t.title}</p>
                  <p className={styles.termDef}>{t.definition}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
