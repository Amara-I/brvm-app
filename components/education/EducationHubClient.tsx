"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  EDUCATION_CATEGORIES,
  EDUCATION_LEVEL_LABELS,
  EDUCATION_THEMES,
  getAllEducationTerms,
  countTermsByCategory,
  countTermsByTheme,
  getCategoryForTheme,
  searchEducationTerms,
  themesByCategory,
  type EducationLevel,
} from "@/lib/education/catalog";
import styles from "./Education.module.css";

export default function EducationHubClient() {
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<EducationLevel | "tous">("tous");

  const results = useMemo(() => {
    const base = q.trim() ? searchEducationTerms(q) : getAllEducationTerms();
    if (level === "tous") return base;
    return base.filter((t) => t.level === level);
  }, [q, level]);

  const showBrowse = !q.trim() && level === "tous";

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

      <label className={styles.lead} style={{ display: "block", fontSize: "0.78rem", marginBottom: 6 }}>
        Rechercher un terme
      </label>
      <input
        className={styles.search}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ex. PER, RSI, alertes, dividende…"
        aria-label="Rechercher un terme éducatif"
      />

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
        {q.trim() || level !== "tous"
          ? `Résultats (${results.length})`
          : `Toutes les fiches (${results.length})`}
      </h2>
      {results.length === 0 ? (
        <p className={styles.empty}>Aucun terme ne correspond — essayez un autre mot-clé.</p>
      ) : (
        <ul className={styles.termList}>
          {results.map((t) => {
            const theme = EDUCATION_THEMES.find((th) => th.slug === t.themeSlug);
            const cat = getCategoryForTheme(t.themeSlug);
            return (
              <li key={t.slug}>
                <Link href={`/education/${t.themeSlug}/${t.slug}`} className={styles.termRow}>
                  <span className={styles.badge}>{EDUCATION_LEVEL_LABELS[t.level]}</span>
                  {cat && <span className={styles.badge}>{cat.title}</span>}
                  <span className={styles.badge}>{theme?.title ?? t.themeSlug}</span>
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
